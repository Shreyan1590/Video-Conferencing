import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../services/api';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError('Email and password are required');
      return;
    }

    try {
      setLoading(true);
      const res = await apiClient.post('/auth/login', { email, password });
      
      // Wait for login to complete and session to be verified
      // This will retry up to 5 times to ensure cookie is available
      // The login function will throw if verification fails
      await login(res.data.user);
      
      // Small delay to ensure state updates propagate to all components
      await new Promise((resolve) => setTimeout(resolve, 150));
      
      // Get the redirect path from URL params or default to home
      const params = new URLSearchParams(window.location.search);
      const redirectTo = params.get('redirect') || '/';
      navigate(redirectTo, { replace: true });
    } catch (err: any) {
      // Handle different error types
      if (err?.message?.includes('verify session') || err?.message?.includes('Cookie may not have been set')) {
        setError('Login successful but session verification failed. Please check your browser settings and try again.');
      } else {
        setError('Invalid credentials');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-layout">
      <div className="auth-card">
        <h1>Sign in</h1>
        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </label>
          {error && <p className="error-text">{error}</p>}
          <button type="submit" disabled={loading} className="auth-cta">
            <span>{loading ? 'Signing in...' : 'Sign in'}</span>
            {!loading && <span className="auth-cta-dot" />}
          </button>
        </form>
        <p className="auth-footer">
          No account? <Link to="/register">Create one</Link>
        </p>
      </div>
    </div>
  );
};


