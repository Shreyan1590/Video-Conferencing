import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { useAuthedApi } from '../../services/api';

interface FormState {
  title: string;
  description: string;
  start: string; // datetime-local value
  end: string; // datetime-local value
  allowedEmailDomain: string;
  hostFirstJoin: boolean;
}

export const ScheduleMeetingPage: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const editing = Boolean(code);
  const api = useAuthedApi();
  const navigate = useNavigate();

  const [form, setForm] = useState<FormState>({
    title: '',
    description: '',
    start: '',
    end: '',
    allowedEmailDomain: '',
    hostFirstJoin: false
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdCode, setCreatedCode] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!editing || !code) return;
      try {
        const res = await api.get(`/rooms/schedules/${code}`);
        const s = res.data.schedule as {
          title: string;
          description?: string;
          startTime: string;
          endTime: string;
          allowedEmailDomain?: string;
          hostFirst?: boolean;
        };
        setForm({
          title: s.title,
          description: s.description ?? '',
          start: toLocalDateTimeInput(s.startTime),
          end: toLocalDateTimeInput(s.endTime),
          allowedEmailDomain: s.allowedEmailDomain ?? '',
          hostFirstJoin: Boolean(s.hostFirst)
        });
      } catch {
        setError('Failed to load schedule');
      }
    };
    void load();
  }, [api, code, editing]);

  const handleChange = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.title || !form.start || !form.end) {
      setError('Title, start and end time are required');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        title: form.title,
        description: form.description || undefined,
        startTime: new Date(form.start).toISOString(),
        endTime: new Date(form.end).toISOString(),
        allowedEmailDomain: form.allowedEmailDomain || undefined,
        hostFirstJoin: form.hostFirstJoin
      };

      if (editing && code) {
        await api.put(`/rooms/schedules/${code}`, payload);
        navigate('/');
      } else {
        const res = await api.post('/rooms/schedule', payload);
        setCreatedCode(res.data.roomCode as string);
      }
    } catch {
      setError('Failed to save schedule');
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    navigate('/');
  };

  const displayedCode = createdCode ?? code ?? undefined;

  return (
    <div className="page-layout">
      <header className="top-bar">
        <div className="logo">Cliqtrix - ProVeloce</div>
        <div className="top-bar-right">
          {displayedCode && <span className="connection-pill">Code: {displayedCode}</span>}
          <button className="secondary-btn" onClick={handleBack}>
            Back
          </button>
        </div>
      </header>
      <main className="lobby-main">
        <section className="lobby-card">
          <h1>{editing ? 'Edit scheduled meeting' : 'Schedule a meeting'}</h1>
          <form className="schedule-form" onSubmit={handleSubmit}>
            <label>
              Title
              <input
                type="text"
                value={form.title}
                onChange={(e) => handleChange('title', e.target.value)}
                required
              />
            </label>
            <label>
              Description (optional)
              <textarea
                value={form.description}
                onChange={(e) => handleChange('description', e.target.value)}
                rows={3}
              />
            </label>
            <div className="schedule-time-row">
              <label>
                Start time
                <input
                  type="datetime-local"
                  value={form.start}
                  onChange={(e) => handleChange('start', e.target.value)}
                  required
                />
              </label>
              <label>
                End time
                <input
                  type="datetime-local"
                  value={form.end}
                  onChange={(e) => handleChange('end', e.target.value)}
                  required
                />
              </label>
            </div>
            <label>
              Restrict to email domain (optional)
              <input
                type="text"
                placeholder="e.g. xyz.com"
                value={form.allowedEmailDomain}
                onChange={(e) => handleChange('allowedEmailDomain', e.target.value)}
              />
            </label>
            <label>
              <span>Participants can join only after the Host joins</span>
              <input
                type="checkbox"
                checked={form.hostFirstJoin}
                onChange={(e) => setForm((prev) => ({ ...prev, hostFirstJoin: e.target.checked }))}
              />
            </label>
            {error && <p className="error-text">{error}</p>}
            <div className="schedule-form-actions">
              <button type="button" className="secondary-btn" onClick={handleBack}>
                Cancel
              </button>
              <button type="submit" className="primary-btn" disabled={saving}>
                {saving ? 'Saving…' : editing ? 'Save changes' : 'Create schedule'}
              </button>
            </div>
          </form>
          {createdCode && (
            <div className="schedule-result">
              <p>Your meeting code:</p>
              <div className="schedule-code-large">{createdCode}</div>
              <button
                className="secondary-btn"
                type="button"
                onClick={() => void navigator.clipboard.writeText(createdCode)}
              >
                Copy code
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

const toLocalDateTimeInput = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, '0');
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
};


