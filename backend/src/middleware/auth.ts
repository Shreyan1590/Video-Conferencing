import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import { ENV } from '../config/env';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    username?: string;
    fullName?: string;
  };
}

const COOKIE_NAME = 'vc_token';

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.cookies?.[COOKIE_NAME];

  if (!token) {
    return res.status(401).json({ message: 'Auth cookie missing' });
  }

  try {
    const payload = jwt.verify(token, ENV.JWT_SECRET) as {
      id: string;
      email: string;
      username?: string;
      fullName?: string;
    };
    req.user = {
      id: payload.id,
      email: payload.email,
      username: payload.username,
      fullName: payload.fullName
    };
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

export const clearAuthCookie = (res: Response) => {
  const isProduction = ENV.NODE_ENV === 'production';
  const isCrossOrigin = Boolean(ENV.CORS_ORIGIN && ENV.CORS_ORIGIN !== 'http://localhost:5173');
  
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: isCrossOrigin ? 'none' : 'lax',
    secure: isProduction || isCrossOrigin,
    path: '/'
  });
};

export const setAuthCookie = (res: Response, token: string) => {
  // For cross-origin requests, we need sameSite: 'none' and secure: true
  const isProduction = ENV.NODE_ENV === 'production';
  const isCrossOrigin = Boolean(ENV.CORS_ORIGIN && ENV.CORS_ORIGIN !== 'http://localhost:5173');
  
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: isCrossOrigin ? 'none' : 'lax', // 'none' required for cross-origin
    secure: isProduction || isCrossOrigin, // Must be true when sameSite is 'none'
    maxAge: 8 * 60 * 60 * 1000, // 8 hours
    path: '/' // Ensure cookie is available for all paths
  });
};

