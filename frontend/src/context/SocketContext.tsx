import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface SocketContextValue {
  socket: Socket | null;
}

const SocketContext = createContext<SocketContextValue | undefined>(undefined);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    // Normalize URL (remove trailing slashes)
    const rawUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000';
    const socketUrl = rawUrl.replace(/\/+$/, ''); // Remove trailing slashes
    const s = io(socketUrl, {
      path: '/socket.io',
      transports: ['websocket'],
      withCredentials: true
    });
    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, []);

  return <SocketContext.Provider value={{ socket }}>{children}</SocketContext.Provider>;
};

export const useSocket = () => {
  const ctx = useContext(SocketContext);
  if (!ctx) {
    throw new Error('useSocket must be used within SocketProvider');
  }
  return ctx;
};


