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
  res.clearCookie(COOKIE_NAME);
};

export const setAuthCookie = (res: Response, token: string) => {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: ENV.NODE_ENV === 'production',
    maxAge: 8 * 60 * 60 * 1000 // 8 hours
  });
};

