import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';
import { useAuthedApi } from '../../services/api';

interface Schedule {
  code: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  expired: boolean;
  allowedEmailDomain?: string;
}

export const LobbyPage: React.FC = () => {
  const navigate = useNavigate();
  const api = useAuthedApi();
  const { user, logout } = useAuth();

  const [joinRoomId, setJoinRoomId] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [joinInputShake, setJoinInputShake] = useState(false);
  const [joining, setJoining] = useState(false);
  const [startingCode, setStartingCode] = useState<string | null>(null);

  const MEETING_CODE_REGEX = /^[A-Z0-9]{3}-[A-Z0-9]{4}-[A-Z0-9]{3}$/;

  useEffect(() => {
    // Only load schedules if user is authenticated
    if (!user) {
      return;
    }

    const load = async () => {
      try {
        setLoadingSchedules(true);
        const res = await api.get('/rooms/schedules');
        setSchedules(res.data.schedules as Schedule[]);
      } catch (err: any) {
        // 401 is expected if not authenticated - ignore it
        if (err?.response?.status !== 401) {
          // eslint-disable-next-line no-console
          console.error('Failed to load schedules:', err);
        }
      } finally {
        setLoadingSchedules(false);
      }
    };
    void load();
  }, [api, user]);

  const handleCreateRoom = () => {
    navigate('/instant');
  };

  const handleJoinRoom = async () => {
    const raw = joinRoomId.trim().toUpperCase();
    if (!raw) {
      setError('Enter a meeting code to join');
      triggerShake();
      return;
    }
    if (!MEETING_CODE_REGEX.test(raw)) {
      setError('Meeting code must be in the format ABC-1234-XYZ');
      triggerShake();
      return;
    }

    try {
      setError(null);
      setJoining(true);
      // Validate against backend so MeetingRoom can connect immediately.
      await api.get(`/rooms/${raw}`);
      navigate(`/room/${raw}`, { state: { validated: true } });
    } catch (err) {
      if (err && typeof err === 'object' && 'response' in (err as any)) {
        const response = (err as any).response;
        const message: string | undefined = response?.data?.message;
        if (message === 'Meeting has not started yet') {
          setError('This meeting has not started yet.');
          triggerShake();
          setJoining(false);
          return;
        }
        if (message === 'Meeting has ended') {
          setError('This meeting has ended.');
          triggerShake();
          setJoining(false);
          return;
        }
        if (message === 'This meeting is in private.') {
          setError('This meeting is in private.');
          triggerShake();
          setJoining(false);
          return;
        }
        if (message === 'Host has not joined yet') {
          setJoining(false);
          navigate(`/waiting/${raw}`);
          return;
        }
        if (response?.status === 404) {
          setError('This meeting code does not exist.');
          triggerShake();
          setJoining(false);
          return;
        }
      }
      setError('This meeting code is invalid or has expired.');
      triggerShake();
      setJoining(false);
    }
  };

  const handleDeleteSchedule = async (code: string) => {
    try {
      await api.delete(`/rooms/schedules/${code}`);
      setSchedules((prev) => prev.filter((s) => s.code !== code));
    } catch {
      // could surface error
    }
  };

  const handleStartScheduled = async (code: string) => {
    const normalized = code.toUpperCase();
    try {
      setError(null);
      setStartingCode(normalized);
      await api.get(`/rooms/${normalized}`);
      navigate(`/room/${normalized}`, { state: { validated: true } });
    } catch (err) {
      if (err && typeof err === 'object' && 'response' in (err as any)) {
        const response = (err as any).response;
        const message: string | undefined = response?.data?.message;
        if (message === 'Meeting has not started yet') {
          setError('This meeting has not started yet.');
          setStartingCode(null);
          return;
        }
        if (message === 'Meeting has ended') {
          setError('This meeting has ended.');
          setStartingCode(null);
          return;
        }
         if (message === 'This meeting is in private.') {
          setError('This meeting is in private.');
          setStartingCode(null);
          return;
        }
        if (message === 'Host has not joined yet') {
          setStartingCode(null);
          navigate(`/waiting/${normalized}`);
          return;
        }
        if (response?.status === 404) {
          setError('This meeting code does not exist.');
          setStartingCode(null);
          return;
        }
      }
      setError('This meeting code is invalid or has expired.');
      setStartingCode(null);
    }
  };

  const triggerShake = () => {
    setJoinInputShake(true);
    window.setTimeout(() => setJoinInputShake(false), 400);
  };

  return (
    <div className="page-layout">
      <header className="top-bar">
        <div className="logo">Cliqtrix - ProVeloce</div>
        <div className="top-bar-right">
          <span className="user-pill">{user?.fullName}</span>
          <button className="secondary-btn" onClick={logout}>
            Sign out
          </button>
        </div>
      </header>
      <main className="lobby-main">
        <section className="lobby-card">
          <h1>Start or join a meeting</h1>
          <div className="lobby-actions">
            <button className="primary-btn" onClick={handleCreateRoom} disabled={creating}>
              {creating ? 'Creating…' : 'New meeting'}
            </button>
            <button className="secondary-btn" onClick={() => navigate('/schedule')}>
              Schedule meeting
            </button>
            <div className="join-row">
              <input
                type="text"
                placeholder="Enter a code or link"
                value={joinRoomId}
                onChange={(e) => setJoinRoomId(e.target.value)}
                className={joinInputShake ? 'join-input input-error shake' : 'join-input'}
              />
              <button className="secondary-btn" onClick={handleJoinRoom} disabled={joining}>
                {joining ? 'Joining…' : 'Join'}
              </button>
            </div>
          </div>
          {error && <p className="error-text">{error}</p>}
          <div className="schedule-list">
            <div className="schedule-list-header">
              <h2>Scheduled meetings</h2>
              {loadingSchedules && <span className="schedule-loading">Loading…</span>}
            </div>
            {schedules.length === 0 && !loadingSchedules && (
              <p className="schedule-empty">No upcoming meetings yet.</p>
            )}
            {schedules.length > 0 && (
              <ul>
                {schedules.map((s) => (
                  <li key={s.code} className="schedule-item">
                    <div className="schedule-main">
                      <div className="schedule-title">{s.title}</div>
                      <div className="schedule-meta">
                        <span>
                          {new Date(s.startTime).toLocaleString()} –{' '}
                          {new Date(s.endTime).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                        <span className="schedule-code">{s.code}</span>
                        {s.allowedEmailDomain && (
                          <span className="schedule-code">
                            Domain: {s.allowedEmailDomain}
                          </span>
                        )}
                        {s.expired && <span className="schedule-expired">Expired</span>}
                      </div>
                    </div>
                    <div className="schedule-actions">
                      <button
                        className="secondary-btn"
                        onClick={() => navigate(`/schedule/${s.code}`)}
                      >
                        Edit
                      </button>
                      <button
                        className="secondary-btn"
                        onClick={() => handleDeleteSchedule(s.code)}
                      >
                        Delete
                      </button>
                      <button
                        className="primary-btn"
                        disabled={s.expired || startingCode === s.code}
                        onClick={() => handleStartScheduled(s.code)}
                      >
                        {startingCode === s.code ? 'Starting…' : 'Start'}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};


