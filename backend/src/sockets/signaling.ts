import { Server, Socket } from 'socket.io';

import { getCollections } from '../db/mongo';

export interface ServerToClientEvents {
  'user-joined': (data: { userId: string; fullName: string }) => void;
  'user-left': (data: { userId: string }) => void;
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
  'join-room': (data: { roomId: string; userId: string; fullName: string }) => void;
  'leave-room': (data: { roomId: string; userId: string }) => void;
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
    socket.on('join-room', ({ roomId, userId, fullName }) => {
      socket.join(roomId);
      socket.data.roomId = roomId;
      socket.data.userId = userId;

      const banned = roomBans.get(roomId);
      if (banned && banned.has(userId)) {
        socket.leave(roomId);
        return;
      }

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

      if (!state.startTime) {
        const now = Date.now();
        state.startTime = now;
        io.to(roomId).emit('meeting-start', { roomId, startTime: state.startTime });

        // Persist canonical start time on first join.
        const { rooms, scheduledRooms } = getCollections();
        void rooms.updateOne({ code: roomId }, { $set: { meetingStartAt: new Date(now) } });
        void scheduledRooms.updateOne({ code: roomId }, { $set: { meetingStartAt: new Date(now) } });
      }

      // Ensure newly joined client also gets the existing meeting start time,
      // so timer does not reset on refresh/rejoin.
      if (state.startTime) {
        socket.emit('meeting-start', { roomId, startTime: state.startTime });
      }

      socket.to(roomId).emit('user-joined', { userId, fullName });
      io.to(roomId).emit('system-message', {
        message: `${fullName} joined the room`,
        timestamp: Date.now()
      });
    });

    socket.on('leave-room', ({ roomId, userId }) => {
      socket.leave(roomId);

      const state = roomsState.get(roomId);
      if (state) {
        state.participants.delete(userId);
        if (state.participants.size === 0 && state.startTime) {
          const endTime = Date.now();
          const durationMs = endTime - state.startTime;
          io.to(roomId).emit('meeting-end', { roomId, endTime, durationMs });

          // Persist canonical end time when the last participant leaves.
          const { rooms, scheduledRooms } = getCollections();
          void rooms.updateOne({ code: roomId }, { $set: { meetingEndAt: new Date(endTime) } });
          void scheduledRooms.updateOne(
            { code: roomId },
            { $set: { meetingEndAt: new Date(endTime) } }
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

    socket.on('reaction', ({ roomId, userId, fullName, emoji }) => {
      const payload = { userId, fullName, emoji, timestamp: Date.now() };
      io.to(roomId).emit('reaction', payload);
    });

    socket.on('disconnect', () => {
      const { roomId, userId } = socket.data;
      if (roomId && userId) {
        const state = roomsState.get(roomId);
        if (state) {
          state.participants.delete(userId);
          if (state.participants.size === 0 && state.startTime) {
            const endTime = Date.now();
            const durationMs = endTime - state.startTime;
            io.to(roomId).emit('meeting-end', { roomId, endTime, durationMs });
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


