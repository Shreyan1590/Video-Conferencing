import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuthedApi } from '../../services/api';

interface FormState {
  title: string;
  description: string;
  allowedEmailDomain: string;
  hostFirstJoin: boolean;
}

export const CreateInstantMeetingPage: React.FC = () => {
  const api = useAuthedApi();
  const navigate = useNavigate();

  const [form, setForm] = useState<FormState>({
    title: '',
    description: '',
    allowedEmailDomain: '',
    hostFirstJoin: false
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.title) {
      setError('Title is required');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        title: form.title,
        description: form.description || undefined,
        allowedEmailDomain: form.allowedEmailDomain || undefined,
        hostFirstJoin: form.hostFirstJoin
      };

      const res = await api.post('/rooms/create', payload);
      const { roomId } = res.data as { roomId: string };
      navigate(`/room/${roomId}`, { state: { validated: true } });
    } catch {
      setError('Failed to create meeting');
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    navigate('/');
  };

  return (
    <div className="page-layout">
      <header className="top-bar">
        <div className="logo">Cliqtrix - ProVeloce</div>
        <div className="top-bar-right">
          <button className="secondary-btn" onClick={handleBack}>
            Back
          </button>
        </div>
      </header>
      <main className="lobby-main">
        <section className="lobby-card">
          <h1>New instant meeting</h1>
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
                onChange={(e) => handleChange('hostFirstJoin', e.target.checked as unknown as string)}
              />
            </label>
            {error && <p className="error-text">{error}</p>}
            <div className="schedule-form-actions">
              <button type="button" className="secondary-btn" onClick={handleBack}>
                Cancel
              </button>
              <button type="submit" className="primary-btn" disabled={saving}>
                {saving ? 'Starting…' : 'Start meeting'}
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
};


