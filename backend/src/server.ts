import cors from 'cors';
import cookieParser from 'cookie-parser';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';

import { ENV } from './config/env';
import { initMongo } from './db/mongo';
import authRoutes from './routes/auth';
import roomsRoutes from './routes/rooms';
import { registerSignalingHandlers } from './sockets/signaling';

const start = async () => {
  await initMongo();

  const app = express();

  app.use(
    cors({
      origin: ENV.CORS_ORIGIN,
      credentials: true
    })
  );
  app.use(express.json());
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/rooms', roomsRoutes);

  const server = http.createServer(app);

  const io = new Server(server, {
    cors: {
      origin: ENV.CORS_ORIGIN,
      credentials: true
    }
  });

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

