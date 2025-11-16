import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { apiClient } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpMessage, setOtpMessage] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpLoading, setOtpLoading] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const handleSendOtp = async () => {
    if (!email) {
      setOtpError('Enter your email first');
      return;
    }
    try {
      setOtpError(null);
      setOtpMessage(null);
      setOtpLoading(true);
      await apiClient.post('/auth/send-otp', { email, fullName, username });
      setOtpSent(true);
      setOtpMessage('OTP sent to your email.');
    } catch {
      setOtpError('Failed to send OTP. Please try again.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!email || !otp.trim()) {
      setOtpError('Enter the OTP sent to your email');
      return;
    }
    try {
      setOtpError(null);
      setOtpMessage(null);
      setOtpLoading(true);
      await apiClient.post('/auth/verify-otp', { email, otp: otp.trim() });
      setOtpVerified(true);
      setOtpMessage('Email verified successfully.');
    } catch (err) {
      setOtpVerified(false);
      const message =
        err && typeof err === 'object' && 'response' in (err as any)
          ? (err as any).response?.data?.message ?? 'Invalid or expired OTP.'
          : 'Invalid or expired OTP.';
      setOtpError(message);
    } finally {
      setOtpLoading(false);
    }
  };

  const handleStep1Continue = () => {
    setError(null);
    if (!fullName || !username) {
      setError('Full name and username are required');
      return;
    }
    setStep(2);
  };

  const handleStep2Continue = () => {
    setError(null);
    if (!email) {
      setError('Email is required');
      return;
    }
    if (!otpVerified) {
      setError('Please verify your email with the OTP before continuing');
      return;
    }
    setStep(3);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName || !username || !email || !password) {
      setError('Full name, username, email and password are required');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!otpVerified) {
      setError('Please verify your email with the OTP before creating an account');
      return;
    }

    try {
      setLoading(true);
      const res = await apiClient.post('/auth/register', {
        fullName,
        username,
        email,
        password
      });
      login(res.data.user);
      navigate('/');
    } catch (err) {
      setError('Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-layout">
      <div className="auth-card">
        <h1>Create account</h1>
        <form onSubmit={handleSubmit} className="auth-form">
          {step === 1 && (
            <>
              <label>
                Full name
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </label>
              <label>
                Username (unique)
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </label>
              {error && <p className="error-text">{error}</p>}
              <button type="button" className="auth-cta" onClick={handleStep1Continue}>
                <span>Continue</span>
                <span className="auth-cta-dot" />
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <label>
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>
              <div className="auth-form" style={{ marginTop: '0.25rem', marginBottom: '0.25rem' }}>
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={handleSendOtp}
                  disabled={otpLoading || otpVerified}
                >
                  {otpLoading ? 'Sending OTP…' : otpVerified ? 'Email verified' : 'Send OTP'}
                </button>
              </div>
              {otpSent && !otpVerified && (
                <label>
                  Enter OTP
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    maxLength={6}
                  />
                </label>
              )}
              {otpSent && !otpVerified && (
                <div className="auth-form" style={{ marginTop: '0.25rem' }}>
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={handleVerifyOtp}
                    disabled={otpLoading}
                  >
                    {otpLoading ? 'Verifying…' : 'Verify OTP'}
                  </button>
                </div>
              )}
              {otpMessage && <p className="schedule-empty">{otpMessage}</p>}
              {otpError && <p className="error-text">{otpError}</p>}
              {error && <p className="error-text">{error}</p>}
              <button type="button" className="auth-cta" onClick={handleStep2Continue}>
                <span>Continue</span>
                <span className="auth-cta-dot" />
              </button>
            </>
          )}

          {step === 3 && (
            <>
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
              <label>
                Confirm Password
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={6}
                  required
                />
              </label>
              {error && <p className="error-text">{error}</p>}
              <button type="submit" disabled={loading} className="auth-cta">
                <span>{loading ? 'Creating...' : 'Create account'}</span>
                {!loading && <span className="auth-cta-dot" />}
              </button>
            </>
          )}
        </form>
        <p className="auth-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
};


