import React, { createContext, useContext, useEffect, useState } from 'react';

import { apiClient } from '../services/api';

interface User {
  id: string;
  email: string;
  username: string;
  fullName: string;
}

interface AuthContextValue {
  user: User | null;
  login: (user: User) => void;
  logout: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMe = async () => {
      try {
        const res = await apiClient.get<{ user: User }>('/auth/me');
        setUser(res.data.user);
      } catch (err: any) {
        // 401 is expected when not logged in - don't log it as an error
        if (err?.response?.status !== 401) {
          // eslint-disable-next-line no-console
          console.error('Failed to fetch user:', err);
        }
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    void fetchMe();
  }, []);

  const login = (newUser: User) => {
    setUser(newUser);
  };

  const logout = async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // ignore network errors on logout
    }
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>{children}</AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
};


