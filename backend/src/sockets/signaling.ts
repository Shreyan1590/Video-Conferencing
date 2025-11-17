import { Server, Socket } from 'socket.io';
import { ObjectId } from 'mongodb';

import { getCollections, type MeetingParticipantDocument } from '../db/mongo';

export interface ServerToClientEvents {
  'user-joined': (data: { userId: string; fullName: string; username?: string; isHost: boolean }) => void;
  'user-left': (data: { userId: string }) => void;
  'participants-list': (data: {
    participants: Array<{
      userId: string;
      fullName: string;
      username?: string;
      isHost: boolean;
      muted: boolean;
      videoEnabled: boolean;
      screenSharing: boolean;
      joinedAt: number;
    }>;
  }) => void;
  'participant-status-update': (data: {
    userId: string;
    muted?: boolean;
    videoEnabled?: boolean;
    screenSharing?: boolean;
  }) => void;
  'signal': (data: { from: string; to: string; signal: unknown }) => void;
  'chat-message': (data: {
    userId: string;
    fullName: string;
    message: string;
    timestamp: number;
    targetUserId?: string;
  }) => void;
  'system-message': (data: { message: string; timestamp: number }) => void;
  'meeting-start': (data: { roomId: string; startTime: number }) => void;
  'meeting-end': (data: { roomId: string; endTime: number; durationMs: number }) => void;
  'host-command': (data: {
    type: 'mute' | 'stopVideo' | 'muteAll' | 'stopVideoAll' | 'endMeeting' | 'removeUser' | 'banUser';
    targetUserId?: string;
  }) => void;
  reaction: (data: { userId: string; fullName: string; emoji: string; timestamp: number }) => void;
}

export interface ClientToServerEvents {
  'join-room': (data: { roomId: string; userId: string; fullName: string; username?: string }) => void;
  'leave-room': (data: { roomId: string; userId: string }) => void;
  'participant-status-update': (data: {
    roomId: string;
    userId: string;
    muted?: boolean;
    videoEnabled?: boolean;
    screenSharing?: boolean;
  }) => void;
  'signal': (data: { roomId: string; to: string; from: string; signal: unknown }) => void;
  'chat-message': (data: {
    roomId: string;
    userId: string;
    fullName: string;
    message: string;
    targetUserId?: string;
  }) => void;
  'host-command': (data: {
    roomId: string;
    type: 'mute' | 'stopVideo' | 'muteAll' | 'stopVideoAll' | 'endMeeting' | 'removeUser' | 'banUser';
    targetUserId?: string;
  }) => void;
  reaction: (data: { roomId: string; userId: string; fullName: string; emoji: string }) => void;
}

export type SocketData = {
  roomId?: string;
  userId?: string;
};

type RoomState = {
  participants: Set<string>;
  startTime?: number;
};

const roomsState = new Map<string, RoomState>();
const roomUserSockets = new Map<string, Map<string, string>>();
const roomBans = new Map<string, Set<string>>();

export const registerSignalingHandlers = (
  io: Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>
) => {
  io.on('connection', (socket: Socket<ClientToServerEvents, ServerToClientEvents, never, SocketData>) => {
    socket.on('join-room', async ({ roomId, userId, fullName, username }) => {
      socket.join(roomId);
      socket.data.roomId = roomId;
      socket.data.userId = userId;

      const banned = roomBans.get(roomId);
      if (banned && banned.has(userId)) {
        socket.leave(roomId);
        return;
      }

      const { meetingParticipants, rooms, scheduledRooms, users } = getCollections();

      // Determine if user is host by checking room/scheduledRoom
      const room = await rooms.findOne({ code: roomId });
      const scheduledRoom = await scheduledRooms.findOne({ code: roomId });
      const isHost = room?.hostUsername === username || scheduledRoom?.hostUsername === username;

      // Check if participant already exists (rejoin scenario)
      const existingParticipant = await meetingParticipants.findOne({
        roomId,
        userId,
        leftAt: { $exists: false }
      });

      const now = new Date();
      let participant: MeetingParticipantDocument;

      if (existingParticipant) {
        // Rejoin: update socketId and unset leftAt
        await meetingParticipants.updateOne(
          { _id: existingParticipant._id },
          {
            $set: {
              socketId: socket.id
            },
            $unset: {
              leftAt: ''
            }
          }
        );
        participant = { ...existingParticipant, socketId: socket.id };
        delete participant.leftAt;
      } else {
        // New join: create participant record
        participant = {
          roomId,
          userId,
          fullName,
          username,
          joinedAt: now,
          isHost,
          muted: false,
          videoEnabled: true,
          screenSharing: false,
          socketId: socket.id
        };
        await meetingParticipants.insertOne(participant);
      }

      // Load all existing participants (excluding those who left)
      const allParticipants = await meetingParticipants
        .find({
          roomId,
          leftAt: { $exists: false }
        })
        .sort({ joinedAt: 1 })
        .toArray();

      // Update in-memory state
      let state = roomsState.get(roomId);
      if (!state) {
        state = { participants: new Set<string>() };
        roomsState.set(roomId, state);
      }
      state.participants.add(userId);

      let userSockets = roomUserSockets.get(roomId);
      if (!userSockets) {
        userSockets = new Map<string, string>();
        roomUserSockets.set(roomId, userSockets);
      }
      userSockets.set(userId, socket.id);

      // Handle meeting start time
      if (!state.startTime) {
        const startTime = Date.now();
        state.startTime = startTime;
        io.to(roomId).emit('meeting-start', { roomId, startTime: state.startTime });

        // Persist canonical start time on first join
        void rooms.updateOne({ code: roomId }, { $set: { meetingStartAt: new Date(startTime) } });
        void scheduledRooms.updateOne({ code: roomId }, { $set: { meetingStartAt: new Date(startTime) } });
      }

      // Send existing meeting start time to newly joined user
      if (state.startTime) {
        socket.emit('meeting-start', { roomId, startTime: state.startTime });
      }

      // Send full participant list to the newly joined user
      socket.emit('participants-list', {
        participants: allParticipants.map((p) => ({
          userId: p.userId,
          fullName: p.fullName,
          username: p.username,
          isHost: p.isHost,
          muted: p.muted,
          videoEnabled: p.videoEnabled,
          screenSharing: p.screenSharing,
          joinedAt: p.joinedAt.getTime()
        }))
      });

      // Notify others about the new user (only if it's a new join, not a rejoin)
      if (!existingParticipant) {
        socket.to(roomId).emit('user-joined', {
          userId,
          fullName,
          username,
          isHost
        });
        io.to(roomId).emit('system-message', {
          message: `${fullName} joined the room`,
          timestamp: Date.now()
        });
      }
    });

    socket.on('leave-room', async ({ roomId, userId }) => {
      socket.leave(roomId);

      const { meetingParticipants, rooms, scheduledRooms } = getCollections();

      // Mark participant as left in database
      await meetingParticipants.updateOne(
        { roomId, userId, leftAt: { $exists: false } },
        { $set: { leftAt: new Date() } }
      );

      const state = roomsState.get(roomId);
      if (state) {
        state.participants.delete(userId);
        if (state.participants.size === 0 && state.startTime) {
          const endTime = Date.now();
          const durationMs = endTime - state.startTime;
          io.to(roomId).emit('meeting-end', { roomId, endTime, durationMs });

          // Persist canonical end time when the last participant leaves
          void rooms.updateOne({ code: roomId }, { $set: { meetingEndAt: new Date(endTime) } });
          void scheduledRooms.updateOne(
            { code: roomId },
            { $set: { meetingEndAt: new Date(endTime) } }
          );

          // Clean up all participants for this room
          void meetingParticipants.updateMany(
            { roomId, leftAt: { $exists: false } },
            { $set: { leftAt: new Date(endTime) } }
          );

          roomsState.delete(roomId);
        }
      }

      const userSockets = roomUserSockets.get(roomId);
      if (userSockets) {
        userSockets.delete(userId);
        if (userSockets.size === 0) {
          roomUserSockets.delete(roomId);
        }
      }

      socket.to(roomId).emit('user-left', { userId });
      io.to(roomId).emit('system-message', {
        message: `A participant left the room`,
        timestamp: Date.now()
      });
    });

    socket.on('signal', ({ roomId, to, from, signal }) => {
      socket.to(roomId).emit('signal', { from, to, signal });
    });

    socket.on('chat-message', ({ roomId, userId, fullName, message, targetUserId }) => {
      const payload = { userId, fullName, message, timestamp: Date.now(), targetUserId };

      if (targetUserId) {
        const userSockets = roomUserSockets.get(roomId);
        const targetSocketId = userSockets?.get(targetUserId);

        if (targetSocketId) {
          io.to(targetSocketId).emit('chat-message', payload);
          socket.emit('chat-message', payload);
          return;
        }
      }

      io.to(roomId).emit('chat-message', payload);
    });

    socket.on('host-command', ({ roomId, type, targetUserId }) => {
      if (type === 'banUser' && targetUserId) {
        let banned = roomBans.get(roomId);
        if (!banned) {
          banned = new Set<string>();
          roomBans.set(roomId, banned);
        }
        banned.add(targetUserId);
      }

      io.to(roomId).emit('host-command', { type, targetUserId });

      if ((type === 'removeUser' || type === 'banUser') && targetUserId) {
        const userSockets = roomUserSockets.get(roomId);
        const targetSocketId = userSockets?.get(targetUserId);
        if (targetSocketId) {
          const targetSocket = io.sockets.sockets.get(targetSocketId);
          targetSocket?.leave(roomId);
        }
      }
    });

    socket.on('participant-status-update', async ({ roomId, userId, muted, videoEnabled, screenSharing }) => {
      const { meetingParticipants } = getCollections();

      // Update participant status in database
      const updateFields: Partial<MeetingParticipantDocument> = {};
      if (muted !== undefined) updateFields.muted = muted;
      if (videoEnabled !== undefined) updateFields.videoEnabled = videoEnabled;
      if (screenSharing !== undefined) updateFields.screenSharing = screenSharing;

      if (Object.keys(updateFields).length > 0) {
        await meetingParticipants.updateOne(
          { roomId, userId, leftAt: { $exists: false } },
          { $set: updateFields }
        );

        // Broadcast status update to all participants
        io.to(roomId).emit('participant-status-update', {
          userId,
          muted,
          videoEnabled,
          screenSharing
        });
      }
    });

    socket.on('reaction', ({ roomId, userId, fullName, emoji }) => {
      const payload = { userId, fullName, emoji, timestamp: Date.now() };
      io.to(roomId).emit('reaction', payload);
    });

    socket.on('disconnect', async () => {
      const { roomId, userId } = socket.data;
      if (roomId && userId) {
        const { meetingParticipants, rooms, scheduledRooms } = getCollections();

        // Mark participant as left in database
        await meetingParticipants.updateOne(
          { roomId, userId, leftAt: { $exists: false } },
          { $set: { leftAt: new Date() } }
        );

        const state = roomsState.get(roomId);
        if (state) {
          state.participants.delete(userId);
          if (state.participants.size === 0 && state.startTime) {
            const endTime = Date.now();
            const durationMs = endTime - state.startTime;
            io.to(roomId).emit('meeting-end', { roomId, endTime, durationMs });

            // Persist canonical end time
            void rooms.updateOne({ code: roomId }, { $set: { meetingEndAt: new Date(endTime) } });
            void scheduledRooms.updateOne(
              { code: roomId },
              { $set: { meetingEndAt: new Date(endTime) } }
            );

            // Clean up all participants for this room
            void meetingParticipants.updateMany(
              { roomId, leftAt: { $exists: false } },
              { $set: { leftAt: new Date(endTime) } }
            );

            roomsState.delete(roomId);
          }
        }

        const userSockets = roomUserSockets.get(roomId);
        if (userSockets) {
          userSockets.delete(userId);
          if (userSockets.size === 0) {
            roomUserSockets.delete(roomId);
          }
        }

        socket.to(roomId).emit('user-left', { userId });
      }
    });
  });
};


