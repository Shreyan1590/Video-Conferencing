import cors from 'cors';
import cookieParser from 'cookie-parser';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';

import { ENV } from './config/env';
import { initMongo } from './db/mongo';
import authRoutes from './routes/auth';
import roomsRoutes from './routes/rooms';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
  registerSignalingHandlers
} from './sockets/signaling';

const start = async () => {
  await initMongo();

  const app = express();

  // Handle CORS - support both single origin string or array
  const corsOrigin = ENV.CORS_ORIGIN.includes(',')
    ? ENV.CORS_ORIGIN.split(',').map((o) => o.trim())
    : ENV.CORS_ORIGIN;

  app.use(
    cors({
      origin: corsOrigin,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    })
  );
  app.use(express.json());
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Diagnostic endpoint to check CORS and cookie configuration
  app.get('/api/auth/debug', (req, res) => {
    res.json({
      corsOrigin: ENV.CORS_ORIGIN,
      nodeEnv: ENV.NODE_ENV,
      isProduction: ENV.NODE_ENV === 'production',
      requestOrigin: req.headers.origin,
      cookiesReceived: Object.keys(req.cookies || {}),
      cookiePresent: Boolean(req.cookies?.vc_token)
    });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/rooms', roomsRoutes);

  const server = http.createServer(app);

  const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(
    server,
    {
      cors: {
        origin: ENV.CORS_ORIGIN,
        credentials: true
      }
    }
  );

  registerSignalingHandlers(io);

  server.listen(ENV.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Backend listening on port ${ENV.PORT}`);
  });
};

// eslint-disable-next-line no-console
start().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});

