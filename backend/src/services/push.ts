import { Expo, ExpoPushMessage } from 'expo-server-sdk';

const expo = new Expo();

export interface PushNotification {
  pushToken: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export async function sendPushNotification(notification: PushNotification): Promise<boolean> {
  const { pushToken, title, body, data } = notification;

  // Check that the push token is valid
  if (!Expo.isExpoPushToken(pushToken)) {
    console.error(`Invalid Expo push token: ${pushToken}`);
    return false;
  }

  const message: ExpoPushMessage = {
    to: pushToken,
    sound: 'default',
    title,
    body,
    data: data || {},
    priority: 'high',
  };

  try {
    const chunks = expo.chunkPushNotifications([message]);
    
    for (const chunk of chunks) {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      
      for (const ticket of ticketChunk) {
        if (ticket.status === 'error') {
          console.error(`Push notification error: ${ticket.message}`);
          if (ticket.details?.error) {
            console.error(`Error details: ${ticket.details.error}`);
          }
          return false;
        }
      }
    }

    return true;
  } catch (error) {
    console.error('Failed to send push notification:', error);
    return false;
  }
}

export async function sendMotionAlert(pushToken: string, deviceId: string): Promise<boolean> {
  return sendPushNotification({
    pushToken,
    title: '⚠️ Motion Detected!',
    body: 'Your bike is being moved. Tap to check.',
    data: { type: 'motion', deviceId },
  });
}

