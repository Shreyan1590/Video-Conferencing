import { useCallback, useEffect, useRef, useState } from 'react';

import { useSocket } from '../context/SocketContext';

interface RemoteStreamInfo {
  userId: string;
  fullName: string;
  stream: MediaStream;
}
const ICE_SERVERS: RTCIceServer[] = [
  {
    urls: ['stun:stun.l.google.com:19302']
  }
  // For production, inject TURN via env, e.g. import.meta.env.VITE_TURN_URL
];

export const useWebRTC = (
  roomId: string,
  userId: string,
  fullName: string,
  options?: {
    isHost?: boolean;
    initialStream?: MediaStream | null;
    onMeetingEnded?: (info: { endTime: number; durationMs: number }) => void;
    username?: string;
  }
) => {
  const { socket } = useSocket();
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<RemoteStreamInfo[]>([]);
  const [muted, setMuted] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected'>(
    'idle'
  );
  const [meetingStartTime, setMeetingStartTime] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const [screenSharing, setScreenSharing] = useState(false);
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);
  const cameraTracksRef = useRef<MediaStreamTrack[]>([]);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!socket) return;

    let isCancelled = false;

    const start = async () => {
      setConnectionStatus('connecting');
      let stream = options?.initialStream ?? null;
      if (!stream) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        } catch {
          // Permission denied or device error – do not join the room.
          setConnectionStatus('idle');
          return;
        }
      }

      if (isCancelled) {
        stream?.getTracks().forEach((t) => t.stop());
        return;
      }

      setLocalStream(stream);
      socket.emit('join-room', { roomId, userId, fullName, username: options?.username });
      setConnectionStatus('connected');
    };

    void start();

    return () => {
      isCancelled = true;
      localStream?.getTracks().forEach((t) => t.stop());
      peersRef.current.forEach((peer) => peer.close());
      peersRef.current.clear();
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (socket) {
        socket.emit('leave-room', { roomId, userId });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, userId, socket, options?.initialStream]);

  useEffect(() => {
    if (!socket) return;

    const createPeerConnection = (peerId: string) => {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

      if (localStream) {
        localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
      }

      pc.ontrack = (event) => {
        const [stream] = event.streams;
        setRemoteStreams((prev) =>
          prev.map((s) => (s.userId === peerId ? { ...s, stream } : s))
        );
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          setRemoteStreams((prev) => prev.filter((s) => s.userId !== peerId));
        }
      };

      return pc;
    };

    const handleParticipantsList = async ({
      participants
    }: {
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
    }) => {
      // Create peer connections for all existing participants (except self)
      const otherParticipants = participants.filter((p) => p.userId !== userId);

      for (const participant of otherParticipants) {
        const already = peersRef.current.get(participant.userId);
        if (already) continue;

        const pc = createPeerConnection(participant.userId);
        peersRef.current.set(participant.userId, pc);

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit('signal', {
              roomId,
              to: participant.userId,
              from: userId,
              signal: { candidate: event.candidate }
            });
          }
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socket.emit('signal', {
          roomId,
          to: participant.userId,
          from: userId,
          signal: { sdp: offer }
        });

        setRemoteStreams((prev) => [
          ...prev,
          { userId: participant.userId, fullName: participant.fullName, stream: new MediaStream() }
        ]);
      }
    };

    const handleUserJoined = async ({
      userId: remoteId,
      fullName: remoteFullName
    }: {
      userId: string;
      fullName: string;
      username?: string;
      isHost: boolean;
    }) => {
      const already = peersRef.current.get(remoteId);
      if (already) return;

      const pc = createPeerConnection(remoteId);
      peersRef.current.set(remoteId, pc);

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('signal', {
            roomId,
            to: remoteId,
            from: userId,
            signal: { candidate: event.candidate }
          });
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit('signal', { roomId, to: remoteId, from: userId, signal: { sdp: offer } });

      setRemoteStreams((prev) => [...prev, { userId: remoteId, fullName: remoteFullName, stream: new MediaStream() }]);
    };

    const handleSignal = async ({
      from,
      to,
      signal
    }: {
      from: string;
      to: string;
      signal: { sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit };
    }) => {
      if (to !== userId) return;

      let pc = peersRef.current.get(from);
      if (!pc) {
        pc = createPeerConnection(from);
        peersRef.current.set(from, pc);
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit('signal', {
              roomId,
              to: from,
              from: userId,
              signal: { candidate: event.candidate }
            });
          }
        };
      }

      if (signal.sdp) {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        if (signal.sdp.type === 'offer') {
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('signal', { roomId, to: from, from: userId, signal: { sdp: answer } });
        }
      } else if (signal.candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        } catch {
          // Ignore ICE candidate errors for now
        }
      }
    };

    const handleUserLeft = ({ userId: remoteId }: { userId: string }) => {
      const pc = peersRef.current.get(remoteId);
      if (pc) {
        pc.close();
        peersRef.current.delete(remoteId);
      }
      setRemoteStreams((prev) => prev.filter((s) => s.userId !== remoteId));
    };

    const handleMeetingStart = ({ startTime }: { roomId: string; startTime: number }) => {
      setMeetingStartTime(startTime);
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
      }
      timerRef.current = window.setInterval(() => {
        setElapsedMs(Date.now() - startTime);
      }, 1000);
    };

    const handleMeetingEnd = (data: { roomId: string; endTime: number; durationMs: number }) => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setMeetingStartTime(null);
      setElapsedMs(data.durationMs);
      if (options?.onMeetingEnded) {
        options.onMeetingEnded({ endTime: data.endTime, durationMs: data.durationMs });
      }
    };

    const handleHostCommand = (data: {
      type: 'mute' | 'stopVideo' | 'muteAll' | 'stopVideoAll' | 'endMeeting' | 'removeUser' | 'banUser';
      targetUserId?: string;
    }) => {
      const target = data.targetUserId;
      const isTarget = !target || target === userId;

      if ((data.type === 'muteAll' || data.type === 'stopVideoAll') && options?.isHost) {
        // Host retains independent control; don't apply global host commands to self.
        return;
      }

      if (!isTarget) return;

      if (data.type === 'mute' || data.type === 'muteAll') {
        if (localStream) {
          localStream.getAudioTracks().forEach((t) => {
            // eslint-disable-next-line no-param-reassign
            t.enabled = false;
          });
          setMuted(true);
        }
      }

      if (data.type === 'stopVideo' || data.type === 'stopVideoAll') {
        if (localStream) {
          localStream.getVideoTracks().forEach((t) => {
            // eslint-disable-next-line no-param-reassign
            t.enabled = false;
          });
          setVideoEnabled(false);
        }
      }

      if (data.type === 'endMeeting') {
        if (timerRef.current) {
          window.clearInterval(timerRef.current);
          timerRef.current = null;
        }
        if (options?.onMeetingEnded) {
          options.onMeetingEnded({ endTime: Date.now(), durationMs: elapsedMs });
        }
      }

      if ((data.type === 'removeUser' || data.type === 'banUser') && isTarget) {
        // Force this client out of the room.
        if (timerRef.current) {
          window.clearInterval(timerRef.current);
        }
        localStream?.getTracks().forEach((t) => t.stop());
        peersRef.current.forEach((peer) => peer.close());
        peersRef.current.clear();
        window.location.href = '/';
      }
    };

    const handleParticipantStatusUpdate = ({
      userId: remoteId,
      muted: remoteMuted,
      videoEnabled: remoteVideoEnabled,
      screenSharing: remoteScreenSharing
    }: {
      userId: string;
      muted?: boolean;
      videoEnabled?: boolean;
      screenSharing?: boolean;
    }) => {
      // Update remote participant status in UI if needed
      // This is mainly for UI indicators, actual media streams are handled by WebRTC
      setRemoteStreams((prev) =>
        prev.map((s) => {
          if (s.userId === remoteId) {
            return {
              ...s,
              muted: remoteMuted ?? s.muted,
              videoEnabled: remoteVideoEnabled ?? s.videoEnabled,
              screenSharing: remoteScreenSharing ?? s.screenSharing
            };
          }
          return s;
        })
      );
    };

    socket.on('participants-list', handleParticipantsList);
    socket.on('user-joined', handleUserJoined);
    socket.on('participant-status-update', handleParticipantStatusUpdate);
    socket.on('signal', handleSignal);
    socket.on('user-left', handleUserLeft);
    socket.on('meeting-start', handleMeetingStart);
    socket.on('meeting-end', handleMeetingEnd);
    socket.on('host-command', handleHostCommand);

    return () => {
      socket.off('participants-list', handleParticipantsList);
      socket.off('user-joined', handleUserJoined);
      socket.off('participant-status-update', handleParticipantStatusUpdate);
      socket.off('signal', handleSignal);
      socket.off('user-left', handleUserLeft);
      socket.off('meeting-start', handleMeetingStart);
      socket.off('meeting-end', handleMeetingEnd);
      socket.off('host-command', handleHostCommand);
    };
    }, [elapsedMs, localStream, options, roomId, socket, userId]);

  const toggleMute = useCallback(() => {
    if (!localStream || !socket) return;
    const newMuted = !muted;
    localStream.getAudioTracks().forEach((t) => {
      // eslint-disable-next-line no-param-reassign
      t.enabled = !newMuted; // enabled is opposite of muted
    });
    setMuted(newMuted);
    // Broadcast status update
    socket.emit('participant-status-update', { roomId, userId, muted: newMuted });
  }, [localStream, socket, muted, roomId, userId]);

  const toggleVideo = useCallback(() => {
    if (!localStream || !socket) return;
    const newVideoEnabled = !videoEnabled;
    localStream.getVideoTracks().forEach((t) => {
      // eslint-disable-next-line no-param-reassign
      t.enabled = newVideoEnabled;
    });
    setVideoEnabled(newVideoEnabled);
    // Broadcast status update
    socket.emit('participant-status-update', { roomId, userId, videoEnabled: newVideoEnabled });
  }, [localStream, socket, videoEnabled, roomId, userId]);

  const startScreenShare = async () => {
    if (!localStream || screenSharing || !socket) return;
    try {
      const screenStream = await (navigator.mediaDevices as any).getDisplayMedia({
        video: true,
        audio: false
      });
      const screenTrack = screenStream.getVideoTracks()[0];
      if (!screenTrack) return;

      cameraTracksRef.current = localStream.getVideoTracks();
      cameraTracksRef.current.forEach((t) => {
        localStream.removeTrack(t);
      });
      localStream.addTrack(screenTrack);
      screenTrackRef.current = screenTrack;
      setScreenSharing(true);

      // Broadcast status update
      socket.emit('participant-status-update', { roomId, userId, screenSharing: true });

      peersRef.current.forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
        if (sender) {
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          sender.replaceTrack(screenTrack);
        }
      });

      screenTrack.onended = () => {
        stopScreenShare();
      };
    } catch {
      // ignore
    }
  };

  const stopScreenShare = () => {
    if (!localStream || !screenSharing || !socket) return;
    const screenTrack = screenTrackRef.current;
    if (screenTrack) {
      localStream.removeTrack(screenTrack);
      screenTrack.stop();
      screenTrackRef.current = null;
    }
    cameraTracksRef.current.forEach((t) => {
      localStream.addTrack(t);
    });
    peersRef.current.forEach((pc) => {
      const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
      const cameraTrack = cameraTracksRef.current[0];
      if (sender && cameraTrack) {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        sender.replaceTrack(cameraTrack);
      }
    });
    setScreenSharing(false);
    // Broadcast status update
    socket.emit('participant-status-update', { roomId, userId, screenSharing: false });
  };

  const sendHostCommand = (data: {
    type: 'mute' | 'stopVideo' | 'muteAll' | 'stopVideoAll' | 'endMeeting' | 'removeUser' | 'banUser';
    targetUserId?: string;
  }) => {
    if (!socket || !options?.isHost) return;
    socket.emit('host-command', { roomId, ...data });
  };

  return {
    localStream,
    remoteStreams,
    muted,
    videoEnabled,
    connectionStatus,
    toggleMute,
    toggleVideo,
    meetingStartTime,
    elapsedMs,
    sendHostCommand,
    screenSharing,
    startScreenShare,
    stopScreenShare
  };
};


