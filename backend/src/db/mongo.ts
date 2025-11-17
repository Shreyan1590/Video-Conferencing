import { Collection, Db, MongoClient } from 'mongodb';

import { ENV } from '../config/env';

let client: MongoClient | null = null;
let db: Db | null = null;

export interface UserDocument {
  _id?: unknown;
  email: string;
  username: string;
  fullName: string;
  passwordHash: string;
  createdAt: Date;
}

export interface RoomDocument {
  _id?: unknown;
  code: string;
  hostUsername: string;
  createdAt: number;
  title?: string;
  description?: string;
  allowedEmailDomain?: string;
  hostFirst?: boolean;
  hostJoinedAt?: number;
  meetingStartAt?: Date;
  meetingEndAt?: Date;
}

export interface ScheduledRoomDocument {
  _id?: unknown;
  code: string;
  hostUsername: string;
  title: string;
  description?: string;
  startTime: number;
  endTime: number;
  deleted: boolean;
  allowedEmailDomain?: string;
  hostFirst?: boolean;
  hostJoinedAt?: number;
  meetingStartAt?: Date;
  meetingEndAt?: Date;
}

export interface EmailOtpDocument {
  _id?: unknown;
  email: string;
  otp: string;
  createdAt: Date;
  expiresAt: Date;
  verified: boolean;
  fullName?: string;
  username?: string;
}

export interface MeetingParticipantDocument {
  _id?: unknown;
  roomId: string;
  userId: string;
  fullName: string;
  username?: string;
  joinedAt: Date;
  leftAt?: Date;
  isHost: boolean;
  muted: boolean;
  videoEnabled: boolean;
  screenSharing: boolean;
  socketId?: string;
}

export const initMongo = async () => {
  if (client && db) {
    return db;
  }

  const uri = ENV.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set');
  }

  client = new MongoClient(uri);
  await client.connect();
  db = client.db(ENV.MONGODB_DB_NAME);

  await ensureIndexes(db);

  return db;
};

const ensureIndexes = async (database: Db) => {
  const users = database.collection<UserDocument>('users');
  const rooms = database.collection<RoomDocument>('rooms');
  const scheduledRooms = database.collection<ScheduledRoomDocument>('scheduledRooms');
  const emailOtps = database.collection<EmailOtpDocument>('emailOtps');
  const meetingParticipants = database.collection<MeetingParticipantDocument>('meetingParticipants');

  const createSafeIndexes = async (collection: Collection<any>, indexSpecs: any) => {
    try {
      await collection.createIndexes(indexSpecs);
    } catch (err) {
      // Ignore index conflicts when an index with same name already exists
      // but with different key specs (codes 85 and 86).
      if (
        !(
          err &&
          typeof err === 'object' &&
          'code' in (err as any) &&
          ((err as any).code === 85 || (err as any).code === 86)
        )
      ) {
        throw err;
      }
    }
  };

  // Users: unique email and username for fast lookup.
  await createSafeIndexes(users, [
    { key: { email: 1 }, name: 'users_email_unique', unique: true },
    { key: { username: 1 }, name: 'users_username_unique', unique: true }
  ]);

  // Instant rooms: ensure unique code and fast host lookup.
  await createSafeIndexes(rooms, [
    { key: { code: 1 }, name: 'rooms_code_unique', unique: true },
    { key: { hostUsername: 1, createdAt: -1 }, name: 'rooms_host_created_idx' }
  ]);

  // Scheduled rooms: unique code, host listings, and endTime for time-based queries.
  await createSafeIndexes(scheduledRooms, [
    { key: { code: 1 }, name: 'scheduled_code_unique', unique: true },
    { key: { hostUsername: 1, startTime: 1 }, name: 'scheduled_host_start_idx' },
    { key: { endTime: 1 }, name: 'scheduled_end_idx' }
  ]);

  // Email OTPs: lookup by email and expire quickly.
  await createSafeIndexes(emailOtps, [
    { key: { email: 1 }, name: 'email_otp_email_idx' },
    { key: { expiresAt: 1 }, name: 'email_otp_expires_idx' }
  ]);

  // Meeting Participants: fast lookup by roomId and userId, cleanup old entries
  await createSafeIndexes(meetingParticipants, [
    { key: { roomId: 1, userId: 1 }, name: 'participants_room_user_idx', unique: true },
    { key: { roomId: 1, joinedAt: 1 }, name: 'participants_room_joined_idx' },
    { key: { leftAt: 1 }, name: 'participants_left_idx' }
  ]);
};

export const getCollections = () => {
  if (!db) {
    throw new Error('MongoDB not initialized. Call initMongo() first.');
  }

  return {
    users: db.collection<UserDocument>('users'),
    rooms: db.collection<RoomDocument>('rooms'),
    scheduledRooms: db.collection<ScheduledRoomDocument>('scheduledRooms'),
    emailOtps: db.collection<EmailOtpDocument>('emailOtps'),
    meetingParticipants: db.collection<MeetingParticipantDocument>('meetingParticipants')
  };
};


