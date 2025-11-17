import { Router } from 'express';

import { getCollections } from '../db/mongo';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

const generateMeetingCode = async (): Promise<string> => {
  const { rooms, scheduledRooms } = getCollections();

  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const randomSegment = (length: number) =>
    Array.from({ length })
      .map(() => charset[Math.floor(Math.random() * charset.length)])
      .join('');

  // Ensure uniqueness across instant and scheduled rooms.
  // With indexed lookups this remains efficient.
  // In the unlikely event of many collisions, we cap attempts.
  for (let i = 0; i < 10; i += 1) {
    const code = `${randomSegment(3)}-${randomSegment(4)}-${randomSegment(3)}`;
    // eslint-disable-next-line no-await-in-loop
    const [existingRoom, existingScheduled] = await Promise.all([
      rooms.findOne({ code }),
      scheduledRooms.findOne({ code })
    ]);
    if (!existingRoom && !existingScheduled) {
      return code;
    }
  }

  throw new Error('Failed to generate unique meeting code');
};

// Instant room creation (like "New meeting now") with metadata but no schedule.
router.post('/create', authMiddleware, async (req: AuthRequest, res) => {
  const { title, description, allowedEmailDomain, hostFirstJoin } = req.body as {
    title?: string;
    description?: string;
    allowedEmailDomain?: string;
    hostFirstJoin?: boolean;
  };

  if (!title) {
    return res.status(400).json({ message: 'Title is required' });
  }

  try {
    const { rooms } = getCollections();
    const roomId = await generateMeetingCode();

    await rooms.insertOne({
      code: roomId,
      hostUsername: req.user!.username ?? req.user!.email,
      createdAt: Date.now(),
      title,
      description,
      allowedEmailDomain: allowedEmailDomain || undefined,
      hostFirst: Boolean(hostFirstJoin)
    });

    return res.status(201).json({ roomId });
  } catch {
    return res.status(500).json({ message: 'Failed to create room' });
  }
});

// Schedule a future meeting with a formatted code.
router.post('/schedule', authMiddleware, async (req: AuthRequest, res) => {
  const { title, description, startTime, endTime, allowedEmailDomain, hostFirstJoin } = req.body as {
    title?: string;
    description?: string;
    startTime?: string;
    endTime?: string;
    allowedEmailDomain?: string;
    hostFirstJoin?: boolean;
  };

  if (!title || !startTime || !endTime) {
    return res.status(400).json({ message: 'Title, startTime and endTime are required' });
  }

  const start = Date.parse(startTime);
  const end = Date.parse(endTime);

  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
    return res.status(400).json({ message: 'Invalid start/end time' });
  }

  try {
    const { scheduledRooms } = getCollections();
    const code = await generateMeetingCode();

    await scheduledRooms.insertOne({
      code,
      hostUsername: req.user!.username ?? req.user!.email,
      title,
      description,
      startTime: start,
      endTime: end,
      deleted: false,
      allowedEmailDomain: allowedEmailDomain || undefined,
      hostFirst: Boolean(hostFirstJoin)
    });

    return res.status(201).json({
      roomCode: code,
      schedule: {
        code,
        title,
        description,
        startTime,
        endTime,
        allowedEmailDomain: allowedEmailDomain || undefined
      }
    });
  } catch {
    return res.status(500).json({ message: 'Failed to schedule meeting' });
  }
});

// List scheduled meetings for the current user.
router.get('/schedules', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { scheduledRooms } = getCollections();
    const now = Date.now();

    const results = await scheduledRooms
      .find({ hostUsername: req.user!.username ?? req.user!.email, deleted: false })
      .sort({ startTime: 1 })
      .toArray();

    const list = results.map((s) => ({
      code: s.code,
      title: s.title,
      description: s.description,
      startTime: new Date(s.startTime).toISOString(),
      endTime: new Date(s.endTime).toISOString(),
      expired: s.endTime <= now,
      allowedEmailDomain: s.allowedEmailDomain,
      hostFirst: s.hostFirst ?? false
    }));

    return res.json({ schedules: list });
  } catch {
    return res.status(500).json({ message: 'Failed to load schedules' });
  }
});

// Get a single schedule (for editing).
router.get('/schedules/:code', authMiddleware, async (req: AuthRequest, res) => {
  const { code } = req.params;

  try {
    const { scheduledRooms } = getCollections();
    const schedule = await scheduledRooms.findOne({
      code,
      hostUsername: req.user!.username ?? req.user!.email,
      deleted: false
    });

    if (!schedule) {
      return res.status(404).json({ message: 'Schedule not found' });
    }

    return res.json({
      schedule: {
        code: schedule.code,
        title: schedule.title,
        description: schedule.description,
        startTime: new Date(schedule.startTime).toISOString(),
        endTime: new Date(schedule.endTime).toISOString(),
        allowedEmailDomain: schedule.allowedEmailDomain,
        hostFirst: schedule.hostFirst ?? false
      }
    });
  } catch {
    return res.status(500).json({ message: 'Failed to load schedule' });
  }
});

// Edit an existing schedule.
router.put('/schedules/:code', authMiddleware, async (req: AuthRequest, res) => {
  const { code } = req.params;

  const { title, description, startTime, endTime, hostFirstJoin } = req.body as {
    title?: string;
    description?: string;
    startTime?: string;
    endTime?: string;
    hostFirstJoin?: boolean;
  };

  if (!title || !startTime || !endTime) {
    return res.status(400).json({ message: 'Title, startTime and endTime are required' });
  }

  const start = Date.parse(startTime);
  const end = Date.parse(endTime);

  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
    return res.status(400).json({ message: 'Invalid start/end time' });
  }

  try {
    const { scheduledRooms } = getCollections();

    const result = await scheduledRooms.findOneAndUpdate(
      { code, hostUsername: req.user!.username ?? req.user!.email, deleted: false },
      {
        $set: {
          title,
          description,
          startTime: start,
          endTime: end,
          hostFirst: Boolean(hostFirstJoin)
        }
      },
      { returnDocument: 'after' }
    );

    // MongoDB findOneAndUpdate with returnDocument: 'after' returns the document directly
    if (!result) {
      return res.status(404).json({ message: 'Schedule not found' });
    }
    
    const schedule = result;

    return res.json({
      schedule: {
        code: schedule.code,
        title: schedule.title,
        description: schedule.description,
        startTime,
        endTime,
        allowedEmailDomain: schedule.allowedEmailDomain,
        hostFirst: schedule.hostFirst ?? false
      }
    });
  } catch {
    return res.status(500).json({ message: 'Failed to update schedule' });
  }
});

// Delete a schedule (creator can manually expire).
router.delete('/schedules/:code', authMiddleware, async (req: AuthRequest, res) => {
  const { code } = req.params;

  try {
    const { scheduledRooms } = getCollections();

    const result = await scheduledRooms.updateOne(
      { code, hostUsername: req.user!.username ?? req.user!.email, deleted: false },
      { $set: { deleted: true } }
    );

    if (!result.matchedCount) {
      return res.status(404).json({ message: 'Schedule not found' });
    }

    return res.status(204).send();
  } catch {
    return res.status(500).json({ message: 'Failed to delete schedule' });
  }
});

// Room lookup used by the client before joining.
router.get('/:roomId', authMiddleware, async (req: AuthRequest, res) => {
  // Normalize the room code: trim whitespace and convert to uppercase
  const rawRoomId = req.params.roomId?.trim() || '';
  const roomId = rawRoomId.toUpperCase();
  const now = Date.now();

  // Validate format: XXX-XXXX-XXX
  const MEETING_CODE_REGEX = /^[A-Z0-9]{3}-[A-Z0-9]{4}-[A-Z0-9]{3}$/;
  if (!MEETING_CODE_REGEX.test(roomId)) {
    return res.status(400).json({ 
      message: 'Invalid meeting code format. Expected format: XXX-XXXX-XXX' 
    });
  }

  try {
    const { rooms, scheduledRooms } = getCollections();

    // Search for instant room - use exact case-insensitive match
    // Since codes are generated in uppercase, we search with the normalized code
    // But also try case-insensitive search as fallback
    let room = await rooms.findOne({ code: roomId });
    if (!room) {
      // Fallback: case-insensitive search (in case of data inconsistency)
      room = await rooms.findOne({ 
        code: { $regex: new RegExp(`^${roomId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
      });
    }
    
    if (room) {
      // eslint-disable-next-line no-console
      console.log(`Found instant room: ${roomId} for user: ${req.user?.email}`);
      const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
      if (room.createdAt + oneWeekMs <= now) {
        return res.status(410).json({ message: 'Meeting has ended' });
      }

      if (room.allowedEmailDomain) {
        const email = req.user?.email ?? '';
        const domain = email.split('@')[1] || '';
        if (domain.toLowerCase() !== room.allowedEmailDomain.toLowerCase()) {
          return res.status(403).json({ message: 'This meeting is in private.' });
        }
      }

      const isHost = room.hostUsername === (req.user!.username ?? req.user!.email);
      if (room.hostFirst && !isHost && !room.hostJoinedAt) {
        return res.status(403).json({ message: 'Host has not joined yet' });
      }

      if (isHost && !room.hostJoinedAt) {
        await rooms.updateOne({ _id: room._id }, { $set: { hostJoinedAt: now } });
      }

      return res.json({
        room: {
          id: room.code,
          hostUsername: room.hostUsername,
          createdAt: room.createdAt,
          title: room.title,
          description: room.description,
          allowedEmailDomain: room.allowedEmailDomain,
          hostFirst: room.hostFirst ?? false
        }
      });
    }

    // Search for scheduled room - use exact match first, then case-insensitive fallback
    let schedule = await scheduledRooms.findOne({ code: roomId, deleted: { $ne: true } });
    if (!schedule) {
      // Fallback: case-insensitive search (in case of data inconsistency)
      schedule = await scheduledRooms.findOne({ 
        code: { $regex: new RegExp(`^${roomId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
        deleted: { $ne: true }
      });
    }
    
    if (!schedule) {
      // Return 404 only if neither instant nor scheduled room exists
      // eslint-disable-next-line no-console
      console.log(`Room not found: ${roomId} for user: ${req.user?.email}`);
      return res.status(404).json({ 
        message: 'Meeting code not found. Please check the code and try again.' 
      });
    }
    
    // eslint-disable-next-line no-console
    console.log(`Found scheduled room: ${roomId} for user: ${req.user?.email}`);

    if (schedule.allowedEmailDomain) {
      const email = req.user?.email ?? '';
      const domain = email.split('@')[1] || '';
      if (domain.toLowerCase() !== schedule.allowedEmailDomain.toLowerCase()) {
        return res.status(403).json({
          message: 'This meeting is in private.'
        });
      }
    }

    if (schedule.startTime > now) {
      return res.status(403).json({ message: 'Meeting has not started yet' });
    }

    if (schedule.endTime <= now) {
      return res.status(410).json({ message: 'Meeting has ended' });
    }

    const isHost = schedule.hostUsername === (req.user!.username ?? req.user!.email);
    if (schedule.hostFirst && !isHost && !schedule.hostJoinedAt) {
      return res.status(403).json({ message: 'Host has not joined yet' });
    }

    if (isHost && !schedule.hostJoinedAt) {
      await scheduledRooms.updateOne({ _id: schedule._id }, { $set: { hostJoinedAt: now } });
    }

    return res.json({
      room: {
        id: schedule.code,
        hostUsername: schedule.hostUsername,
        title: schedule.title,
        startTime: new Date(schedule.startTime).toISOString(),
        endTime: new Date(schedule.endTime).toISOString(),
        hostFirst: schedule.hostFirst ?? false
      }
    });
  } catch {
    return res.status(500).json({ message: 'Failed to lookup room' });
  }
});

export default router;


