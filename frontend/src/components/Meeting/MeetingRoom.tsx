import React from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';
import { ChatPanel } from './ChatPanel';
import { ParticipantList } from './ParticipantList';
import { useAuthedApi } from '../../services/api';
import { useWebRTC } from '../../hooks/useWebRTC';
import { useSocket } from '../../context/SocketContext';

export const MeetingRoom: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const api = useAuthedApi();
  const [roomValid, setRoomValid] = React.useState<boolean | null>(null);
  const [roomError, setRoomError] = React.useState<string | null>(null);
  const [checking, setChecking] = React.useState<boolean>(true);
  const [normalizedCode, setNormalizedCode] = React.useState<string | null>(null);
  const [isHost, setIsHost] = React.useState<boolean>(false);
  const [meetingDurationLabel, setMeetingDurationLabel] = React.useState<string | null>(null);
  const [permissionsGranted, setPermissionsGranted] = React.useState(false);
  const [permissionError, setPermissionError] = React.useState<string | null>(null);
  const [requestingPermissions, setRequestingPermissions] = React.useState(false);
  const [preacquiredStream, setPreacquiredStream] = React.useState<MediaStream | null>(null);
  const MEETING_CODE_REGEX = /^[A-Z0-9]{3}-[A-Z0-9]{4}-[A-Z0-9]{3}$/;
  const validatedFromLobby =
    location.state && typeof location.state === 'object'
      ? (location.state as { validated?: boolean }).validated === true
      : false;

  React.useEffect(() => {
    if (!roomId || !user) {
      navigate('/');
      return;
    }

    // If we just came from creating/joining via lobby/instant form,
    // treat the code as already validated to avoid an extra "checking" step for the host.
    if (validatedFromLobby) {
      const normalized = roomId.toUpperCase();
      setNormalizedCode(normalized);
      setIsHost(true);
      setRoomValid(true);
      setRoomError(null);
      setChecking(false);
      return;
    }

    const checkRoom = async () => {
      try {
        setChecking(true);
        const normalized = roomId.toUpperCase();
        if (!MEETING_CODE_REGEX.test(normalized)) {
          setRoomValid(false);
          setRoomError('Meeting code must be in the format ABC-1234-XYZ.');
          setChecking(false);
          return;
        }
        const res = await api.get(`/rooms/${normalized}`);
        const room = (res.data as any).room;
        setIsHost(room?.hostUsername === user.username);
        setRoomValid(true);
        setRoomError(null);
        setNormalizedCode(normalized);
      } catch (err: any) {
        setRoomValid(false);
        
        if (err?.response) {
          const response = err.response;
          const status = response?.status;
          const message: string | undefined = response?.data?.message;
          
          // Use the backend error message if available
          if (message) {
            setRoomError(message);
          } else if (status === 400) {
            setRoomError('Invalid meeting code format. Expected format: XXX-XXXX-XXX');
          } else if (status === 401) {
            setRoomError('Please sign in to join a meeting.');
          } else if (status === 403) {
            setRoomError('You do not have permission to join this meeting.');
          } else if (status === 404) {
            setRoomError('Meeting code not found. Please check the code and try again.');
          } else if (status === 410) {
            setRoomError('This meeting has ended.');
          } else if (status >= 500) {
            setRoomError('Server error. Please try again later.');
          } else {
            setRoomError('Failed to validate meeting code. Please try again.');
          }
        } else {
          // Network error
          setRoomError('Unable to connect to server. Please check your connection and try again.');
        }
        
        setChecking(false);
      }
    };
    void checkRoom();
  }, [MEETING_CODE_REGEX, api, navigate, roomId, user, validatedFromLobby]);

  if (!roomId || !user) {
    return null;
  }

  const effectiveCode = normalizedCode ?? roomId.toUpperCase();

  const handleRequestPermissions = async () => {
    setPermissionError(null);
    setRequestingPermissions(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setPreacquiredStream(stream);
      setPermissionsGranted(true);
    } catch (err) {
      setPermissionsGranted(false);
      setPermissionError(
        'Camera and microphone access are required to join this meeting. Please allow permissions and try again.'
      );
    } finally {
      setRequestingPermissions(false);
    }
  };

  return (
    <div className="page-layout meeting-layout">
      <header className="top-bar">
        <div className="logo">Cliqtrix - ProVeloce</div>
        <div className="top-bar-right">
          <span className="connection-pill">Code: {effectiveCode}</span>
          {checking && <span className="connection-pill">Checking meeting…</span>}
          {!checking && meetingDurationLabel && (
            <span className="connection-pill">{meetingDurationLabel}</span>
          )}
          <button className="secondary-btn leave-btn" onClick={() => navigate('/')}>
            Leave
          </button>
        </div>
      </header>

      {checking && (
        <main className="meeting-main">
          <div className="centered-message">Checking your meeting code…</div>
        </main>
      )}

      {!checking && roomValid === false && (
        <main className="meeting-main">
          <div className="centered-message error-card">
            <p className="error-text">{roomError ?? 'Unable to join this meeting.'}</p>
            <button className="primary-btn" onClick={() => navigate('/')}>
              Back to lobby
            </button>
          </div>
        </main>
      )}

      {!checking && roomValid && normalizedCode && !permissionsGranted && (
        <main className="meeting-main">
          <div className="centered-message">
            <div className="auth-card">
              <h1>Allow camera and microphone</h1>
              <p className="schedule-empty">
                To join this meeting, please grant access to your camera and microphone. You won&apos;t
                be able to enter until permissions are enabled.
              </p>
              {permissionError && <p className="error-text">{permissionError}</p>}
              <button
                className="auth-cta"
                type="button"
                onClick={handleRequestPermissions}
                disabled={requestingPermissions}
              >
                <span>{requestingPermissions ? 'Requesting…' : 'Enable camera & mic'}</span>
              </button>
            </div>
          </div>
        </main>
      )}

      {!checking && roomValid && normalizedCode && permissionsGranted && (
        <MeetingRoomInner
          roomCode={normalizedCode}
          userId={user.id}
          isHost={isHost}
          onLeave={() => navigate('/')}
          setMeetingDurationLabel={setMeetingDurationLabel}
          initialStream={preacquiredStream}
        />
      )}
    </div>
  );
};

interface MeetingRoomInnerProps {
  roomCode: string;
  userId: string;
  isHost: boolean;
  onLeave: () => void;
  setMeetingDurationLabel: (label: string | null) => void;
  initialStream: MediaStream | null;
}

const MeetingRoomInner: React.FC<MeetingRoomInnerProps> = ({
  roomCode,
  userId,
  isHost,
  onLeave,
  setMeetingDurationLabel,
  initialStream
}) => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [reactions, setReactions] = React.useState<
    { id: string; emoji: string; fullName: string; userId: string }[]
  >([]);
  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const recordedChunksRef = React.useRef<BlobPart[]>([]);
  const [recording, setRecording] = React.useState(false);
  const formatDuration = (ms: number) => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const parts = [
      h > 0 ? String(h).padStart(2, '0') : null,
      String(m).padStart(2, '0'),
      String(s).padStart(2, '0')
    ].filter((p) => p !== null);
    return parts.join(':');
  };

  const {
    localStream,
    remoteStreams,
    muted,
    videoEnabled,
    screenSharing,
    connectionStatus,
    toggleMute,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
    meetingStartTime,
    elapsedMs,
    sendHostCommand
  } = useWebRTC(roomCode, userId, user?.fullName ?? userId, {
    isHost,
    initialStream,
    onMeetingEnded: ({ durationMs }) => {
      setMeetingDurationLabel(`Ended · ${formatDuration(durationMs)}`);
    }
  });

  React.useEffect(() => {
    if (!socket) return;

    const handleReaction = (data: {
      userId: string;
      fullName: string;
      emoji: string;
      timestamp: number;
    }) => {
      const id = `${data.userId}-${data.timestamp}`;
      setReactions((prev) => [...prev, { id, emoji: data.emoji, fullName: data.fullName, userId: data.userId }]);
      window.setTimeout(() => {
        setReactions((prev) => prev.filter((r) => r.id !== id));
      }, 2500);
    };

    socket.on('reaction', handleReaction);
    return () => {
      socket.off('reaction', handleReaction);
    };
  }, [socket]);

  const sendReaction = (emoji: string) => {
    if (!socket || !user) return;
    socket.emit('reaction', {
      roomId: roomCode,
      userId,
      fullName: user.fullName,
      emoji
    });
  };

  const startRecording = () => {
    if (recording || !user) return;
    const tracksStream = new MediaStream();
    if (localStream) {
      localStream.getTracks().forEach((t) => tracksStream.addTrack(t));
    }
    remoteStreams.forEach((rs) => {
      rs.stream.getTracks().forEach((t) => tracksStream.addTrack(t));
    });
    if (tracksStream.getTracks().length === 0) return;

    try {
      const recorder = new MediaRecorder(tracksStream);
      recordedChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };
      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `meeting-${roomCode}-${Date.now()}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
    } catch {
      // ignore recorder errors for now
    }
  };

  const stopRecording = () => {
    if (!recording || !recorderRef.current) return;
    recorderRef.current.stop();
    recorderRef.current = null;
    setRecording(false);
  };

  React.useEffect(() => {
    if (meetingStartTime != null) {
      setMeetingDurationLabel(`Live · ${formatDuration(elapsedMs)}`);
    }
  }, [elapsedMs, meetingStartTime, setMeetingDurationLabel]);

  const connectionLabel =
    connectionStatus === 'connected'
      ? 'Connected'
      : connectionStatus === 'connecting'
      ? 'Connecting…'
      : 'Idle';

  return (
    <>
      <main className="meeting-main">
        <section className="video-section">
          <div className="video-grid">
            <VideoTile label={user?.fullName ?? 'You'} stream={localStream} mutedMirror />
            {remoteStreams.map((s) => (
              <VideoTile key={s.userId} label={s.fullName ?? s.userId} stream={s.stream} />
            ))}
            <div className="reactions-layer">
              {reactions.map((r) => (
                <div key={r.id} className="reaction-bubble">
                  <span className="reaction-emoji">{r.emoji}</span>
                  <span className="reaction-name">{r.fullName}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="controls-bar">
            <div className="controls-group">
              <button
                className={muted ? 'control-btn mute-green' : 'control-btn mute-red'}
                onClick={toggleMute}
              >
                {muted ? 'Unmute' : 'Mute'}
              </button>
              <button
                className={videoEnabled ? 'control-btn video-red' : 'control-btn video-green'}
                onClick={toggleVideo}
              >
                {videoEnabled ? 'Stop video' : 'Start video'}
              </button>
              <button
                className={screenSharing ? 'control-btn off' : 'control-btn'}
                onClick={screenSharing ? stopScreenShare : startScreenShare}
              >
                {screenSharing ? 'Stop sharing' : 'Share screen'}
              </button>
              <div className="reactions-bar">
                <button
                  type="button"
                  className="control-btn"
                  onClick={() => sendReaction('👍')}
                >
                  👍
                </button>
                <button
                  type="button"
                  className="control-btn"
                  onClick={() => sendReaction('🎉')}
                >
                  🎉
                </button>
                <button
                  type="button"
                  className="control-btn"
                  onClick={() => sendReaction('❤️')}
                >
                  ❤️
                </button>
              </div>
            </div>
            {isHost && (
              <div className="host-controls">
                <span className="host-controls-label">Host controls</span>
                <div className="host-controls-buttons">
                  <button
                    className="control-btn host-cta"
                    onClick={() => sendHostCommand({ type: 'muteAll' })}
                  >
                    Mute all
                  </button>
                  <button
                    className="control-btn host-cta"
                    onClick={() => sendHostCommand({ type: 'stopVideoAll' })}
                  >
                    Stop all videos
                  </button>
                  <button
                    className="control-btn host-cta"
                    onClick={recording ? stopRecording : startRecording}
                  >
                    {recording ? 'Stop recording' : 'Start recording'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
        <aside className="side-panel">
          <ParticipantList
            localUserId={userId}
            localFullName={user?.fullName ?? userId}
            remoteParticipants={remoteStreams.map((s) => ({
              userId: s.userId,
              fullName: s.fullName ?? s.userId
            }))}
            isHost={isHost}
            onAction={(targetUserId, action) => {
              if (!isHost) return;
              if (action === 'mute') {
                sendHostCommand({ type: 'mute', targetUserId });
              } else if (action === 'stopVideo') {
                sendHostCommand({ type: 'stopVideo', targetUserId });
              } else if (action === 'remove') {
                sendHostCommand({ type: 'removeUser', targetUserId });
              } else if (action === 'ban') {
                sendHostCommand({ type: 'banUser', targetUserId });
              }
            }}
          />
          <ChatPanel
            roomId={roomCode}
            userId={userId}
            fullName={user?.fullName ?? userId}
            participants={[
              { userId, fullName: user?.fullName ?? userId },
              ...remoteStreams.map((s) => ({
                userId: s.userId,
                fullName: s.fullName ?? s.userId
              }))
            ]}
          />
        </aside>
      </main>
    </>
  );
};

interface VideoTileProps {
  label: string;
  stream: MediaStream | null;
  mutedMirror?: boolean;
}

const VideoTile: React.FC<VideoTileProps> = ({ label, stream, mutedMirror }) => {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);

  React.useEffect(() => {
    if (videoRef.current && stream) {
      // eslint-disable-next-line no-param-reassign
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="video-tile">
      {stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={mutedMirror}
          className={mutedMirror ? 'mirror' : ''}
        />
      ) : (
        <div className="video-placeholder">Waiting for video…</div>
      )}
      <div className="video-label">{label}</div>
    </div>
  );
};


