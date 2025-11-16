import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { useAuthedApi } from '../../services/api';

export const WaitingRoomPage: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const api = useAuthedApi();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'waiting' | 'ready' | 'ended' | 'error'>('waiting');
  const [message, setMessage] = useState<string>('Waiting for host to join…');

  useEffect(() => {
    if (!roomId) return;

    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;
      try {
        const res = await api.get(`/rooms/${roomId}`);
        if (cancelled) return;
        if (res.status === 200) {
          setStatus('ready');
          navigate(`/room/${roomId}`, { state: { validated: true } });
        }
      } catch (err) {
        if (!err || typeof err !== 'object' || !('response' in (err as any))) {
          setStatus('error');
          setMessage('Unable to contact the server. Please try again.');
          return;
        }
        const response = (err as any).response;
        const m: string | undefined = response?.data?.message;
        if (response?.status === 410 || m === 'Meeting has ended') {
          setStatus('ended');
          setMessage('This meeting has ended.');
          return;
        }
        if (m === 'This meeting is in private.') {
          setStatus('error');
          setMessage('This meeting is in private.');
          return;
        }
        if (m === 'Host has not joined yet') {
          // remain waiting and poll again
          setStatus('waiting');
          setMessage('Waiting for host to join…');
        } else if (m === 'Meeting has not started yet') {
          setStatus('waiting');
          setMessage('This meeting has not started yet.');
        } else {
          setStatus('error');
          setMessage('Unable to join this meeting.');
          return;
        }
      }
      if (!cancelled) {
        window.setTimeout(poll, 5000);
      }
    };

    void poll();

    return () => {
      cancelled = true;
    };
  }, [api, navigate, roomId]);

  if (!roomId) {
    return null;
  }

  return (
    <div className="page-layout">
      <header className="top-bar">
        <div className="logo">Cliqtrix - ProVeloce</div>
        <div className="top-bar-right">
          <span className="connection-pill">Code: {roomId.toUpperCase()}</span>
          <button className="secondary-btn" onClick={() => navigate('/')}>
            Back to lobby
          </button>
        </div>
      </header>
      <main className="lobby-main">
        <section className="lobby-card">
          <h1>Waiting room</h1>
          <p className="schedule-empty">{message}</p>
          {status === 'waiting' && <div className="spinner-ring" />}
        </section>
      </main>
    </div>
  );
};



