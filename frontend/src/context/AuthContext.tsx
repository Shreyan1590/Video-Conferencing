import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';

import { apiClient } from '../services/api';

interface User {
  id: string;
  email: string;
  username: string;
  fullName: string;
}

interface AuthContextValue {
  user: User | null;
  login: (user: User) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const userRef = useRef<User | null>(null);
  const isLoggingInRef = useRef(false);

  // Keep ref in sync with state
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Fetch user from server to verify session
  const refreshAuth = useCallback(async () => {
    try {
      const res = await apiClient.get<{ user: User }>('/auth/me');
      setUser(res.data.user);
      return;
    } catch (err: any) {
      const status = err?.response?.status;
      
      // 401 means not authenticated - clear user
      if (status === 401) {
        setUser(null);
        return;
      }
      
      // Network errors or other issues - don't clear existing session
      // This prevents losing session on temporary network problems
      if (status === undefined || status >= 500) {
        // Network error or server error - keep existing user if we have one
        // Only log if we don't have a user (first load)
        if (!userRef.current) {
          // eslint-disable-next-line no-console
          console.warn('Network error during auth check, will retry:', err?.message);
        }
        return;
      }
      
      // Other client errors (400, 403, etc.) - log but don't clear session
      if (status && status !== 401) {
        // eslint-disable-next-line no-console
        console.error('Failed to fetch user:', status, err?.response?.data || err?.message);
      }
    }
  }, []);

  // Initial auth check on mount
  useEffect(() => {
    const initializeAuth = async () => {
      // Don't initialize if we're in the middle of logging in
      if (isLoggingInRef.current) {
        return;
      }
      setLoading(true);
      await refreshAuth();
      setInitialized(true);
      setLoading(false);
    };

    void initializeAuth();
  }, [refreshAuth]);

  // Periodically refresh auth to catch token expiration
  useEffect(() => {
    if (!initialized || !user) return;

    // Refresh auth every 5 minutes to catch token expiration
    const interval = setInterval(() => {
      void refreshAuth();
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [initialized, user, refreshAuth]);

  const login = useCallback(async (newUser: User) => {
    // Set flag to prevent initial auth check from interfering
    isLoggingInRef.current = true;
    
    try {
      // Verify the session is actually valid by fetching from server FIRST
      // This ensures the cookie was set correctly before we set user state
      // Retry a few times in case cookie isn't immediately available
      let verified = false;
      let attempts = 0;
      const maxAttempts = 5; // Increased retries for cross-origin cookie delays
      
      while (!verified && attempts < maxAttempts) {
        try {
          const res = await apiClient.get<{ user: User }>('/auth/me');
          // Only set user if verification succeeds
          setUser(res.data.user);
          verified = true;
        } catch (err: any) {
          const status = err?.response?.status;
          attempts++;
          
          if (status === 401 && attempts >= maxAttempts) {
            // If all retries fail with 401, cookie wasn't set properly
            setUser(null);
            throw new Error('Failed to verify session after login. Cookie may not have been set.');
          }
          
          // For non-401 errors or if we haven't exhausted retries, wait and retry
          if (attempts < maxAttempts) {
            // Exponential backoff: 100ms, 200ms, 400ms, 800ms, 1600ms
            await new Promise((resolve) => setTimeout(resolve, 100 * Math.pow(2, attempts - 1)));
          } else {
            // Last attempt failed
            setUser(null);
            throw new Error('Failed to verify session after login');
          }
        }
      }
      
      // Fallback: if we somehow get here without verification, use the provided user
      // This should not happen, but provides a safety net
      if (!verified && newUser) {
        setUser(newUser);
      }
    } finally {
      // Clear flag after login completes
      isLoggingInRef.current = false;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // ignore network errors on logout - clear user anyway
    }
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, refreshAuth }}>{children}</AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
};


