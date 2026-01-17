import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';

export interface DeviceAuthRequest extends Request {
  deviceId?: string;
}

/**
 * Authenticate ESP32 device using deviceId + deviceSecret
 * Expects headers: x-device-id and x-device-secret
 */
export async function authenticateDevice(
  req: DeviceAuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const deviceId = req.headers['x-device-id'] as string;
  const deviceSecret = req.headers['x-device-secret'] as string;

  if (!deviceId || !deviceSecret) {
    res.status(401).json({ error: 'Device credentials required' });
    return;
  }

  try {
    const device = await prisma.device.findUnique({
      where: { id: deviceId },
    });

    if (!device || device.secret !== deviceSecret) {
      res.status(403).json({ error: 'Invalid device credentials' });
      return;
    }

    req.deviceId = deviceId;
    next();
  } catch (error) {
    console.error('Device auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
    return;
  }
}

