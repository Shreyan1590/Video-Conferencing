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
    // Set user immediately for optimistic UI
    setUser(newUser);
    
    // Verify the session is actually valid by fetching from server
    // This ensures the cookie was set correctly
    try {
      await refreshAuth();
    } catch {
      // If verification fails, the user will be cleared by refreshAuth
      // This handles cases where cookie wasn't set properly
    }
  }, [refreshAuth]);

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


