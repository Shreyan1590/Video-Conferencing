import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';

import { ENV } from '../config/env';
import { getCollections } from '../db/mongo';
import { authMiddleware, setAuthCookie, clearAuthCookie, AuthRequest } from '../middleware/auth';
import { sendOtpEmail } from '../services/mailer';

const router = Router();

router.post('/send-otp', async (req, res) => {
  const { email, fullName, username } = req.body as {
    email?: string;
    fullName?: string;
    username?: string;
  };

  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  try {
    const { emailOtps } = getCollections();

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes

    await emailOtps.updateOne(
      { email },
      {
        $set: {
          email,
          otp,
          createdAt: now,
          expiresAt,
          verified: false,
          fullName,
          username
        }
      },
      { upsert: true }
    );

    try {
      await sendOtpEmail(email, otp);
      return res.json({ message: 'OTP sent to your email.' });
    } catch (emailError) {
      // eslint-disable-next-line no-console
      console.error('Email sending failed:', emailError);
      // Still return success to user (security: don't reveal if email exists)
      // But log the error for debugging
      return res.json({ 
        message: 'OTP sent to your email if it exists.',
        warning: 'Email service may not be configured. Check server logs for details.'
      });
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('OTP generation failed:', error);
    return res.status(500).json({ message: 'Failed to generate OTP' });
  }
});

router.post('/verify-otp', async (req, res) => {
  const { email, otp } = req.body as { email?: string; otp?: string };

  if (!email || !otp) {
    return res.status(400).json({ message: 'Email and OTP are required' });
  }

  try {
    const { emailOtps } = getCollections();
    const record = await emailOtps.findOne({ email });
    const now = new Date();

    if (!record || record.expiresAt < now || record.otp !== otp) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    await emailOtps.updateOne({ email }, { $set: { verified: true } });

    return res.json({ message: 'Email verified successfully.' });
  } catch {
    return res.status(500).json({ message: 'Failed to verify OTP' });
  }
});

router.post('/register', async (req, res) => {
  const { email, password, username, fullName } = req.body as {
    email?: string;
    password?: string;
    username?: string;
    fullName?: string;
  };

  if (!email || !password || !username || !fullName) {
    return res
      .status(400)
      .json({ message: 'Email, password, username and fullName are required' });
  }

  try {
    const { users, emailOtps } = getCollections();

    const otpRecord = await emailOtps.findOne({ email });
    const nowDate = new Date();
    if (!otpRecord || !otpRecord.verified || otpRecord.expiresAt < nowDate) {
      return res.status(400).json({ message: 'Please verify your email with the OTP first' });
    }

    const existingByEmail = await users.findOne({ email });
    if (existingByEmail) {
      return res.status(409).json({ message: 'User with this email already exists' });
    }

    const existingByUsername = await users.findOne({ username });
    if (existingByUsername) {
      return res.status(409).json({ message: 'Username is already taken' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const now = new Date();
    const result = await users.insertOne({
      _id: new ObjectId(),
      email,
      username,
      fullName,
      passwordHash,
      createdAt: now
    });

    if (!result.acknowledged) {
      return res.status(500).json({ message: 'Failed to create user' });
    }

    const id = result.insertedId.toString();
    const token = jwt.sign({ id, email, username, fullName }, ENV.JWT_SECRET, { expiresIn: '8h' });

    setAuthCookie(res, token);
    
    // eslint-disable-next-line no-console
    console.log('Registration successful, cookie set for user:', email);

    // Keep the OTP record with verified=true for audit/reference instead of deleting it.
    return res.status(201).json({ user: { id, email, username, fullName } });
  } catch (err) {
    // Handle unique index race condition gracefully.
    if (err && typeof err === 'object' && 'code' in (err as any) && (err as any).code === 11000) {
      return res.status(409).json({ message: 'User with these credentials already exists' });
    }

    return res.status(500).json({ message: 'Failed to register user' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    const { users } = getCollections();

    const user = await users.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const id = (user._id as ObjectId).toString();
    const token = jwt.sign(
      { id, email: user.email, username: user.username, fullName: user.fullName },
      ENV.JWT_SECRET,
      { expiresIn: '8h' }
    );

    setAuthCookie(res, token);
    
    // eslint-disable-next-line no-console
    console.log('Login successful, cookie set for user:', user.email);

    return res.json({
      user: { id, email: user.email, username: user.username, fullName: user.fullName }
    });
  } catch {
    return res.status(500).json({ message: 'Failed to log in' });
  }
});

router.post('/logout', (_req, res) => {
  clearAuthCookie(res);
  return res.status(204).send();
});

router.get('/me', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { users } = getCollections();
    let mongoId: ObjectId;
    try {
      mongoId = new ObjectId(req.user!.id);
    } catch {
      // Stale or invalid token id - clear cookie and force re-auth.
      clearAuthCookie(res);
      return res.status(401).json({ message: 'Invalid session. Please sign in again.' });
    }

    const user = await users.findOne({ _id: mongoId });
    if (!user) {
      clearAuthCookie(res);
      return res.status(401).json({ message: 'User not found' });
    }

    return res.json({
      user: { id: req.user!.id, email: user.email, username: user.username, fullName: user.fullName }
    });
  } catch {
    clearAuthCookie(res);
    return res.status(401).json({ message: 'Invalid session. Please sign in again.' });
  }
});

export default router;


