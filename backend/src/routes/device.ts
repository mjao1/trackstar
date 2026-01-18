import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

export const deviceRouter = Router();

// All device routes require authentication
deviceRouter.use(authenticateToken);

// Validation schemas
const claimSchema = z.object({
  deviceId: z.string(),
  secret: z.string(),
});

const stateSchema = z.object({
  state: z.enum(['IDLE', 'WATCH']),
});

const alarmSchema = z.object({
  active: z.boolean(),
});

// POST /api/device/claim - Claim a device with QR code data
deviceRouter.post('/claim', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { deviceId, secret } = claimSchema.parse(req.body);

    // Check if device exists
    let device = await prisma.device.findUnique({ where: { id: deviceId } });

    if (!device) {
      // Create device if it doesn't exist (for development/testing)
      device = await prisma.device.create({
        data: { id: deviceId, secret },
      });
    } else if (device.secret !== secret) {
      res.status(403).json({ error: 'Invalid device secret' });
      return;
    } else if (device.userId && device.userId !== req.userId) {
      res.status(400).json({ error: 'Device already claimed by another user' });
      return;
    }

    // Check if user already has a device
    const existingDevice = await prisma.device.findUnique({
      where: { userId: req.userId },
    });

    if (existingDevice && existingDevice.id !== deviceId) {
      res.status(400).json({ error: 'You already have a device paired. Unpair it first.' });
      return;
    }

    // Claim the device
    const claimedDevice = await prisma.device.update({
      where: { id: deviceId },
      data: { userId: req.userId },
    });

    res.json({
      device: {
        id: claimedDevice.id,
        state: claimedDevice.state,
        alarmActive: claimedDevice.alarmActive,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
      return;
    }
    console.error('Claim device error:', error);
    res.status(500).json({ error: 'Failed to claim device' });
  }
});

// DELETE /api/device/unclaim - Unclaim the user's device
deviceRouter.delete('/unclaim', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const device = await prisma.device.findUnique({
      where: { userId: req.userId },
    });

    if (!device) {
      res.status(404).json({ error: 'No device paired' });
      return;
    }

    await prisma.device.update({
      where: { id: device.id },
      data: { userId: null, state: 'IDLE', alarmActive: false },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Unclaim device error:', error);
    res.status(500).json({ error: 'Failed to unclaim device' });
  }
});

// GET /api/device/status - Get user's device status
deviceRouter.get('/status', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const device = await prisma.device.findUnique({
      where: { userId: req.userId },
    });

    if (!device) {
      res.json({ device: null });
      return;
    }

    res.json({
      device: {
        id: device.id,
        state: device.state,
        alarmActive: device.alarmActive,
        lastMotionAt: device.lastMotionAt,
        lastLatitude: device.lastLatitude,
        lastLongitude: device.lastLongitude,
        lastGpsUpdate: device.lastGpsUpdate,
      },
    });
  } catch (error) {
    console.error('Get status error:', error);
    res.status(500).json({ error: 'Failed to get device status' });
  }
});

// POST /api/device/state - Set device state (IDLE or WATCH)
deviceRouter.post('/state', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { state } = stateSchema.parse(req.body);

    const device = await prisma.device.findUnique({
      where: { userId: req.userId },
    });

    if (!device) {
      res.status(404).json({ error: 'No device paired' });
      return;
    }

    // Always turn off alarm when changing to IDLE or WATCH
    const updateData: { state: 'IDLE' | 'WATCH'; alarmActive: boolean } = { 
      state, 
      alarmActive: false 
    };
    
    // When going to IDLE, also clear motion events
    if (state === 'IDLE') {
      await prisma.motionEvent.deleteMany({
        where: { deviceId: device.id },
      });
    }

    const updatedDevice = await prisma.device.update({
      where: { id: device.id },
      data: updateData,
    });

    res.json({
      device: {
        id: updatedDevice.id,
        state: updatedDevice.state,
        alarmActive: updatedDevice.alarmActive,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
      return;
    }
    console.error('Set state error:', error);
    res.status(500).json({ error: 'Failed to set device state' });
  }
});

// POST /api/device/alarm - Toggle alarm on/off
deviceRouter.post('/alarm', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { active } = alarmSchema.parse(req.body);

    const device = await prisma.device.findUnique({
      where: { userId: req.userId },
    });

    if (!device) {
      res.status(404).json({ error: 'No device paired' });
      return;
    }

    const updatedDevice = await prisma.device.update({
      where: { id: device.id },
      data: { alarmActive: active },
    });

    res.json({
      device: {
        id: updatedDevice.id,
        state: updatedDevice.state,
        alarmActive: updatedDevice.alarmActive,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
      return;
    }
    console.error('Set alarm error:', error);
    res.status(500).json({ error: 'Failed to toggle alarm' });
  }
});

// GET /api/device/events - Get motion events for current session
deviceRouter.get('/events', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const device = await prisma.device.findUnique({
      where: { userId: req.userId },
    });

    if (!device) {
      res.status(404).json({ error: 'No device paired' });
      return;
    }

    const events = await prisma.motionEvent.findMany({
      where: { deviceId: device.id },
      orderBy: { timestamp: 'desc' },
      take: 50,
    });

    res.json({ events });
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ error: 'Failed to get events' });
  }
});

// GET /api/device/gps - Get latest GPS location
deviceRouter.get('/gps', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const device = await prisma.device.findUnique({
      where: { userId: req.userId },
    });

    if (!device) {
      res.status(404).json({ error: 'No device paired' });
      return;
    }

    if (!device.lastLatitude || !device.lastLongitude) {
      res.status(404).json({ error: 'No GPS location available' });
      return;
    }

    res.json({
      latitude: device.lastLatitude,
      longitude: device.lastLongitude,
      lastGpsUpdate: device.lastGpsUpdate,
    });
  } catch (error) {
    console.error('Get GPS error:', error);
    res.status(500).json({ error: 'Failed to get GPS location' });
  }
});
