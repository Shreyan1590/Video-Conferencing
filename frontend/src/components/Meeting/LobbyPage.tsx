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

  // Format meeting code as user types: XXX-XXXX-XXX
  const formatMeetingCode = (value: string): string => {
    // Remove all non-alphanumeric characters and convert to uppercase
    const cleaned = value.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    
    // Limit to 10 characters (3+4+3)
    const limited = cleaned.slice(0, 10);
    
    // Add dashes at positions 3 and 7
    if (limited.length <= 3) {
      return limited;
    } else if (limited.length <= 7) {
      return `${limited.slice(0, 3)}-${limited.slice(3)}`;
    } else {
      return `${limited.slice(0, 3)}-${limited.slice(3, 7)}-${limited.slice(7)}`;
    }
  };

  const handleCodeInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatMeetingCode(e.target.value);
    setJoinRoomId(formatted);
    // Clear error when user starts typing
    if (error) {
      setError(null);
    }
  };

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
    } catch (err: any) {
      setJoining(false);
      
      if (err?.response) {
        const response = err.response;
        const status = response?.status;
        const message: string | undefined = response?.data?.message;
        
        // Handle specific messages
        if (message === 'Host has not joined yet') {
          navigate(`/waiting/${raw}`);
          return;
        }
        
        // Use backend error message if available, otherwise use status-based messages
        if (message) {
          setError(message);
        } else if (status === 400) {
          setError('Invalid meeting code format. Please check the code and try again.');
        } else if (status === 401) {
          setError('Please sign in to join a meeting.');
        } else if (status === 403) {
          setError('You do not have permission to join this meeting.');
        } else if (status === 404) {
          setError('Meeting code not found. Please check the code and try again.');
        } else if (status === 410) {
          setError('This meeting has ended.');
        } else if (status >= 500) {
          setError('Server error. Please try again later.');
        } else {
          setError('Failed to join meeting. Please try again.');
        }
      } else {
        // Network error or other issue
        setError('Unable to connect to server. Please check your connection and try again.');
      }
      
      triggerShake();
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
    } catch (err: any) {
      setStartingCode(null);
      
      if (err?.response) {
        const response = err.response;
        const status = response?.status;
        const message: string | undefined = response?.data?.message;
        
        // Handle specific messages
        if (message === 'Host has not joined yet') {
          navigate(`/waiting/${normalized}`);
          return;
        }
        
        // Use backend error message if available, otherwise use status-based messages
        if (message) {
          setError(message);
        } else if (status === 400) {
          setError('Invalid meeting code format. Please check the code and try again.');
        } else if (status === 401) {
          setError('Please sign in to start the meeting.');
        } else if (status === 403) {
          setError('You do not have permission to start this meeting.');
        } else if (status === 404) {
          setError('Meeting code not found. Please check the code and try again.');
        } else if (status === 410) {
          setError('This meeting has ended.');
        } else if (status >= 500) {
          setError('Server error. Please try again later.');
        } else {
          setError('Failed to start meeting. Please try again.');
        }
      } else {
        // Network error or other issue
        setError('Unable to connect to server. Please check your connection and try again.');
      }
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
                placeholder="XXX-XXXX-XXX"
                value={joinRoomId}
                onChange={handleCodeInputChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    void handleJoinRoom();
                  }
                }}
                maxLength={12}
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


