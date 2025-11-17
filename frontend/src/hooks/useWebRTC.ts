import React, { useCallback, useEffect, useRef, useState } from 'react';

import { useSocket } from '../context/SocketContext';

interface RemoteStreamInfo {
  userId: string;
  fullName: string;
  stream: MediaStream;
  muted?: boolean;
  videoEnabled?: boolean;
  screenSharing?: boolean;
}

interface ParticipantInfo {
  userId: string;
  fullName: string;
  username?: string;
  isHost: boolean;
  muted: boolean;
  videoEnabled: boolean;
  screenSharing: boolean;
  joinedAt: number;
  stream?: MediaStream;
}

type PeerConnectionState = 'new' | 'connecting' | 'connected' | 'disconnected' | 'failed' | 'closed';

interface PeerConnectionInfo {
  pc: RTCPeerConnection;
  state: PeerConnectionState;
  isInitiator: boolean;
  pendingOffer?: RTCSessionDescriptionInit;
  pendingAnswer?: RTCSessionDescriptionInit;
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
  const [allParticipants, setAllParticipants] = useState<Map<string, ParticipantInfo>>(new Map());
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
  const peersRef = useRef<Map<string, PeerConnectionInfo>>(new Map());
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
      peersRef.current.forEach((info) => {
        if (info.pc.connectionState !== 'closed') {
          info.pc.close();
        }
      });
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

    const createPeerConnection = (peerId: string, isInitiator: boolean = false): PeerConnectionInfo => {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

      // Add local tracks to the peer connection immediately
      // This ensures all participants receive our stream
      if (localStream) {
        localStream.getTracks().forEach((track) => {
          try {
            // Check if track is already added to avoid duplicates
            const existingSender = pc.getSenders().find((s) => s.track?.id === track.id);
            if (!existingSender) {
              pc.addTrack(track, localStream);
            }
          } catch (err) {
            // Track might already be added, ignore
            // eslint-disable-next-line no-console
            console.warn('Failed to add track to peer connection:', err);
          }
        });
      }

      pc.ontrack = (event) => {
        const [stream] = event.streams;
        if (!stream || stream.getTracks().length === 0) return;
        
        // Update remote streams
        setRemoteStreams((prev) => {
          const existing = prev.find((s) => s.userId === peerId);
          if (existing) {
            return prev.map((s) => (s.userId === peerId ? { ...s, stream } : s));
          }
          // If stream doesn't exist yet, check if we have participant info
          const participant = allParticipants.get(peerId);
          return [
            ...prev,
            {
              userId: peerId,
              fullName: participant?.fullName ?? peerId,
              stream,
              muted: participant?.muted ?? false,
              videoEnabled: participant?.videoEnabled ?? true,
              screenSharing: participant?.screenSharing ?? false
            }
          ];
        });
        
        // Also update participant info with stream
        setAllParticipants((prev) => {
          const participant = prev.get(peerId);
          if (participant) {
            const updated = new Map(prev);
            updated.set(peerId, { ...participant, stream });
            return updated;
          }
          return prev;
        });
      };

      pc.onconnectionstatechange = () => {
        const info = peersRef.current.get(peerId);
        if (info) {
          info.state = pc.connectionState as PeerConnectionState;
          
          // Update overall connection status based on all peer connections
          const allStates = Array.from(peersRef.current.values()).map((i) => i.pc.connectionState);
          const hasConnected = allStates.some((s) => s === 'connected');
          const hasConnecting = allStates.some((s) => s === 'connecting' || s === 'checking');
          
          if (hasConnected) {
            setConnectionStatus('connected');
          } else if (hasConnecting || allStates.length > 0) {
            setConnectionStatus('connecting');
          }
          
          if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected' || pc.connectionState === 'closed') {
            setRemoteStreams((prev) => prev.filter((s) => s.userId !== peerId));
          }
        }
      };

      return {
        pc,
        state: 'new',
        isInitiator
      };
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
      // Store all participants in state (including self for completeness)
      const participantsMap = new Map<string, ParticipantInfo>();
      participants.forEach((p) => {
        participantsMap.set(p.userId, {
          userId: p.userId,
          fullName: p.fullName,
          username: p.username,
          isHost: p.isHost,
          muted: p.muted,
          videoEnabled: p.videoEnabled,
          screenSharing: p.screenSharing,
          joinedAt: p.joinedAt
        });
      });
      setAllParticipants(participantsMap);

      // Create peer connections for all existing participants (except self)
      // Use deterministic initiator selection (lower userId creates offer)
      const otherParticipants = participants.filter((p) => p.userId !== userId);

      for (const participant of otherParticipants) {
        const existing = peersRef.current.get(participant.userId);
        if (existing && existing.pc.connectionState !== 'closed') continue;

        // Determine who should be initiator (lower userId)
        const shouldBeInitiator = userId < participant.userId;
        const info = createPeerConnection(participant.userId, shouldBeInitiator);
        peersRef.current.set(participant.userId, info);

        // Set up ICE candidate handler (will be used after setLocalDescription)
        info.pc.onicecandidate = (event) => {
          if (event.candidate && info.pc.connectionState !== 'closed' && info.pc.localDescription) {
            socket.emit('signal', {
              roomId,
              to: participant.userId,
              from: userId,
              signal: { candidate: event.candidate }
            });
          }
        };

        // Only create offer if we're the initiator
        if (shouldBeInitiator) {
          try {
            const offer = await info.pc.createOffer();
            await info.pc.setLocalDescription(offer);
            info.state = 'connecting';

            socket.emit('signal', {
              roomId,
              to: participant.userId,
              from: userId,
              signal: { sdp: offer }
            });

          // Add to remote streams even without stream yet (will be updated when track arrives)
          setRemoteStreams((prev) => {
            const exists = prev.find((s) => s.userId === participant.userId);
            if (!exists) {
              return [
                ...prev,
                {
                  userId: participant.userId,
                  fullName: participant.fullName,
                  stream: new MediaStream(),
                  muted: participant.muted,
                  videoEnabled: participant.videoEnabled,
                  screenSharing: participant.screenSharing
                }
              ];
            }
            return prev;
          });
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('Failed to create offer for participant:', participant.userId, err);
          peersRef.current.delete(participant.userId);
        }
      }
      
      // Update connection status
      setConnectionStatus('connected');
    };

    const handleUserJoined = async ({
      userId: remoteId,
      fullName: remoteFullName,
      username: remoteUsername,
      isHost: remoteIsHost
    }: {
      userId: string;
      fullName: string;
      username?: string;
      isHost: boolean;
    }) => {
      // Add to participants list immediately so UI updates instantly
      setAllParticipants((prev) => {
        const updated = new Map(prev);
        updated.set(remoteId, {
          userId: remoteId,
          fullName: remoteFullName,
          username: remoteUsername,
          isHost: remoteIsHost,
          muted: false,
          videoEnabled: true,
          screenSharing: false,
          joinedAt: Date.now()
        });
        return updated;
      });

      // Add to remote streams immediately (stream will be updated when track arrives)
      setRemoteStreams((prev) => {
        const exists = prev.find((s) => s.userId === remoteId);
        if (!exists) {
          return [
            ...prev,
            {
              userId: remoteId,
              fullName: remoteFullName,
              stream: new MediaStream(),
              muted: false,
              videoEnabled: true,
              screenSharing: false
            }
          ];
        }
        return prev;
      });

      const existing = peersRef.current.get(remoteId);
      if (existing && existing.pc.connectionState !== 'closed') {
        // Connection already exists, just update participant info
        return;
      }

      // Determine who should be the initiator based on userId comparison
      // This prevents both sides from creating offers simultaneously
      // Lower userId becomes initiator
      const shouldBeInitiator = userId < remoteId;

      // When a new user joins, create peer connection
      // We become the initiator if our userId is lower (deterministic)
      const info = createPeerConnection(remoteId, shouldBeInitiator);
      peersRef.current.set(remoteId, info);

      // Set up ICE candidate handler AFTER creating offer
      let iceCandidateHandler: ((event: RTCPeerConnectionIceEvent) => void) | null = null;

      // Only create offer if we're the initiator
      if (shouldBeInitiator) {
        try {
          const offer = await info.pc.createOffer();
          await info.pc.setLocalDescription(offer);
          info.state = 'connecting';

          // Now set up ICE candidate handler - only after setLocalDescription
          iceCandidateHandler = (event: RTCPeerConnectionIceEvent) => {
            if (event.candidate && info.pc.connectionState !== 'closed' && info.pc.localDescription) {
              socket.emit('signal', {
                roomId,
                to: remoteId,
                from: userId,
                signal: { candidate: event.candidate }
              });
            }
          };
          info.pc.onicecandidate = iceCandidateHandler;

          socket.emit('signal', { roomId, to: remoteId, from: userId, signal: { sdp: offer } });
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('Failed to create offer for new participant:', remoteId, err);
          peersRef.current.delete(remoteId);
        }
      } else {
        // We're the responder - wait for offer from the other side
        // ICE candidate handler will be set up when we receive the offer and create answer
        info.pc.onicecandidate = (event) => {
          if (event.candidate && info.pc.connectionState !== 'closed' && info.pc.localDescription) {
            socket.emit('signal', {
              roomId,
              to: remoteId,
              from: userId,
              signal: { candidate: event.candidate }
            });
          }
        };
      }
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

      let info = peersRef.current.get(from);
      if (!info) {
        // If we receive a signal from someone we don't have a connection with,
        // they're the initiator, so we become the responder
        info = createPeerConnection(from, false);
        peersRef.current.set(from, info);
        
        // ICE candidate handler will be set up after we set local description (in answer)
      }

      const pc = info.pc;

      // Check if connection is closed
      if (pc.connectionState === 'closed') {
        return;
      }

      if (signal.sdp) {
        try {
          // Prevent duplicate SDP processing
          const currentRemoteDesc = pc.remoteDescription;
          if (currentRemoteDesc && signal.sdp.type === currentRemoteDesc.type) {
            // Already processed this type of SDP, ignore
            return;
          }

          // Check if we're in the right state
          if (signal.sdp.type === 'offer') {
            // We're receiving an offer, so we need to be in 'stable' or 'have-local-offer' state
            // If we already have a local offer, we should ignore this (or handle renegotiation)
            if (pc.signalingState === 'have-local-offer') {
              // We already sent an offer, this might be a duplicate or renegotiation
              // For now, ignore duplicate offers
              return;
            }

            await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            info.state = 'connecting';
            
            // Set up ICE candidate handler AFTER setLocalDescription
            pc.onicecandidate = (event) => {
              if (event.candidate && pc.connectionState !== 'closed' && pc.localDescription) {
                socket.emit('signal', {
                  roomId,
                  to: from,
                  from: userId,
                  signal: { candidate: event.candidate }
                });
              }
            };
            
            socket.emit('signal', { roomId, to: from, from: userId, signal: { sdp: answer } });
          } else if (signal.sdp.type === 'answer') {
            // We're receiving an answer to our offer
            // We should be in 'have-local-offer' state
            if (pc.signalingState !== 'have-local-offer' && pc.signalingState !== 'have-remote-offer') {
              // Wrong state, might be a duplicate answer
              return;
            }

            await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
            info.state = 'connecting';
          }
        } catch (err: any) {
          // eslint-disable-next-line no-console
          console.error('Failed to process SDP:', err?.message, 'State:', pc.signalingState);
          // If it's an InvalidStateError, the connection might be in the wrong state
          // This can happen with duplicate messages, so we'll just ignore it
        }
      } else if (signal.candidate) {
        try {
          // Only add ICE candidate if we have remote description set
          if (pc.remoteDescription) {
            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
          } else {
            // Store candidate for later if we don't have remote description yet
            // This is handled automatically by the browser in most cases
          }
        } catch (err) {
          // Ignore ICE candidate errors (duplicates, invalid candidates, etc.)
          // eslint-disable-next-line no-console
          console.warn('Failed to add ICE candidate:', err);
        }
      }
    };

    const handleUserLeft = ({ userId: remoteId }: { userId: string }) => {
      const info = peersRef.current.get(remoteId);
      if (info) {
        if (info.pc.connectionState !== 'closed') {
          info.pc.close();
        }
        peersRef.current.delete(remoteId);
      }
      setRemoteStreams((prev) => prev.filter((s) => s.userId !== remoteId));
      // Remove from participants list
      setAllParticipants((prev) => {
        const updated = new Map(prev);
        updated.delete(remoteId);
        return updated;
      });
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
        peersRef.current.forEach((info) => {
          if (info.pc.connectionState !== 'closed') {
            info.pc.close();
          }
        });
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
      // Update participant info
      setAllParticipants((prev) => {
        const participant = prev.get(remoteId);
        if (participant) {
          const updated = new Map(prev);
          updated.set(remoteId, {
            ...participant,
            muted: remoteMuted ?? participant.muted,
            videoEnabled: remoteVideoEnabled ?? participant.videoEnabled,
            screenSharing: remoteScreenSharing ?? participant.screenSharing
          });
          return updated;
        }
        return prev;
      });

      // Update remote streams
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

  // Update all peer connections when localStream changes (e.g., when tracks are added/removed)
  useEffect(() => {
    if (!localStream) return;

    peersRef.current.forEach((info, peerId) => {
      if (info.pc.connectionState === 'closed') return;

      // Ensure all local tracks are added to this peer connection
      localStream.getTracks().forEach((track) => {
        const existingSender = info.pc.getSenders().find((s) => s.track?.id === track.id);
        if (!existingSender) {
          try {
            info.pc.addTrack(track, localStream);
          } catch (err) {
            // Track might already be added or connection in wrong state
            // eslint-disable-next-line no-console
            console.warn('Failed to add track to peer connection:', peerId, err);
          }
        }
      });
    });
  }, [localStream]);

  // Merge participant info with stream info for complete participant list
  const participants = React.useMemo(() => {
    const merged = new Map<string, ParticipantInfo>();
    
    // Start with all participants from database
    allParticipants.forEach((participant, id) => {
      merged.set(id, { ...participant });
    });
    
    // Update with stream information
    remoteStreams.forEach((streamInfo) => {
      const existing = merged.get(streamInfo.userId);
      if (existing) {
        merged.set(streamInfo.userId, {
          ...existing,
          stream: streamInfo.stream,
          muted: streamInfo.muted ?? existing.muted,
          videoEnabled: streamInfo.videoEnabled ?? existing.videoEnabled,
          screenSharing: streamInfo.screenSharing ?? existing.screenSharing
        });
      } else {
        // Participant with stream but not in database list (shouldn't happen, but handle it)
        merged.set(streamInfo.userId, {
          userId: streamInfo.userId,
          fullName: streamInfo.fullName,
          isHost: false,
          muted: streamInfo.muted ?? false,
          videoEnabled: streamInfo.videoEnabled ?? true,
          screenSharing: streamInfo.screenSharing ?? false,
          joinedAt: Date.now(),
          stream: streamInfo.stream
        });
      }
    });
    
    return Array.from(merged.values()).filter((p) => p.userId !== userId);
  }, [allParticipants, remoteStreams, userId]);

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

      peersRef.current.forEach((info) => {
        if (info.pc.connectionState !== 'closed') {
          const sender = info.pc.getSenders().find((s) => s.track && s.track.kind === 'video');
          if (sender) {
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            sender.replaceTrack(screenTrack);
          }
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
    peersRef.current.forEach((info) => {
      if (info.pc.connectionState !== 'closed') {
        const sender = info.pc.getSenders().find((s) => s.track && s.track.kind === 'video');
        const cameraTrack = cameraTracksRef.current[0];
        if (sender && cameraTrack) {
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          sender.replaceTrack(cameraTrack);
        }
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
    participants, // Complete participant list with all info
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


