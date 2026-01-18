import { Router, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticateDevice, DeviceAuthRequest } from '../middleware/deviceAuth.js';
import { sendMotionAlert } from '../services/push.js';

export const esp32Router = Router();

// All ESP32 routes require device authentication
esp32Router.use(authenticateDevice);

// POST /api/esp32/motion - Report motion detected
esp32Router.post('/motion', async (req: DeviceAuthRequest, res: Response): Promise<void> => {
  try {
    const deviceId = req.deviceId!;

    // Get device with user
    const device = await prisma.device.findUnique({
      where: { id: deviceId },
      include: { user: true },
    });

    if (!device) {
      res.status(404).json({ error: 'Device not found' });
      return;
    }

    // Only process motion events when in WATCH or THEFT_DETECTED state
    if (device.state !== 'WATCH' && device.state !== 'THEFT_DETECTED') {
      res.json({ processed: false, reason: 'Device not in watch mode' });
      return;
    }

    // Only log and notify on state transition from WATCH to THEFT_DETECTED
    const isNewTheft = device.state === 'WATCH';
    
    if (isNewTheft) {
      // Create motion event only on state transition
      await prisma.motionEvent.create({
        data: { deviceId },
      });
    }

    // Update device state and lastMotionAt
    await prisma.device.update({
      where: { id: deviceId },
      data: { 
        state: 'THEFT_DETECTED',
        lastMotionAt: new Date(),
      },
    });

    // Send push notification only on new theft detection
    let notificationSent = false;
    if (isNewTheft) {
      if (device.user?.pushToken) {
        console.log('Sending push notification to:', device.user.pushToken);
        notificationSent = await sendMotionAlert(device.user.pushToken, deviceId);
        console.log('Push notification result:', notificationSent);
      } else {
        console.log('No push token for user:', device.userId);
      }
    }

    res.json({ 
      processed: true, 
      notificationSent,
      state: 'THEFT_DETECTED',
    });
  } catch (error) {
    console.error('Motion event error:', error);
    res.status(500).json({ error: 'Failed to process motion event' });
  }
});

// GET /api/esp32/poll - Device polls for state and commands
esp32Router.get('/poll', async (req: DeviceAuthRequest, res: Response): Promise<void> => {
  try {
    const deviceId = req.deviceId!;

    const device = await prisma.device.findUnique({
      where: { id: deviceId },
    });

    if (!device) {
      res.status(404).json({ error: 'Device not found' });
      return;
    }

    // If in THEFT_DETECTED state with no recent motion, auto-return to WATCH and turn off alarm
    if (device.state === 'THEFT_DETECTED' && device.lastMotionAt) {
      const timeSinceMotion = Date.now() - device.lastMotionAt.getTime();
      if (timeSinceMotion > 10000) {
        await prisma.device.update({
          where: { id: deviceId },
          data: { state: 'WATCH', alarmActive: false },
        });
        
        res.json({
          state: 'WATCH',
          alarm: false,
        });
        return;
      }
    }

    res.json({
      state: device.state,
      alarm: device.alarmActive,
    });
  } catch (error) {
    console.error('Poll error:', error);
    res.status(500).json({ error: 'Poll failed' });
  }
});

// POST /api/esp32/gps - Receive GPS coordinates from device
esp32Router.post('/gps', async (req: DeviceAuthRequest, res: Response): Promise<void> => {
  try {
    const deviceId = req.deviceId!;
    const { latitude, longitude } = req.body;

    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      res.status(400).json({ error: 'Invalid GPS coordinates' });
      return;
    }

    const device = await prisma.device.findUnique({
      where: { id: deviceId },
    });

    if (!device) {
      res.status(404).json({ error: 'Device not found' });
      return;
    }

    // Update device with GPS coordinates
    await prisma.device.update({
      where: { id: deviceId },
      data: {
        lastLatitude: latitude,
        lastLongitude: longitude,
        lastGpsUpdate: new Date(),
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('GPS update error:', error);
    res.status(500).json({ error: 'Failed to update GPS coordinates' });
  }
});
