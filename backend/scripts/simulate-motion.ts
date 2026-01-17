/**
 * Simulate ESP32 motion events for testing
 * Run with: npx tsx scripts/simulate-motion.ts
 */

const API_URL = process.env.API_URL || 'http://localhost:3000';
const DEVICE_ID = process.env.DEVICE_ID || 'TEST-DEVICE-001';
const DEVICE_SECRET = process.env.DEVICE_SECRET || 'test-secret-123';

async function poll() {
  const response = await fetch(`${API_URL}/api/esp32/poll`, {
    headers: {
      'x-device-id': DEVICE_ID,
      'x-device-secret': DEVICE_SECRET,
    },
  });
  const data = await response.json();
  console.log('[POLL]', data);
  return data;
}

async function reportMotion() {
  const response = await fetch(`${API_URL}/api/esp32/motion`, {
    method: 'POST',
    headers: {
      'x-device-id': DEVICE_ID,
      'x-device-secret': DEVICE_SECRET,
      'Content-Type': 'application/json',
    },
  });
  const data = await response.json();
  console.log('[MOTION]', data);
  return data;
}

async function main() {
  console.log('=== Trackstar Device Simulator ===');
  console.log(`Device: ${DEVICE_ID}`);
  console.log(`API: ${API_URL}`);
  console.log('');

  // Initial poll
  console.log('1. Initial poll...');
  let state = await poll();

  if (state.state === 'IDLE') {
    console.log('\nDevice is IDLE. Set it to WATCH mode in the app first!');
    console.log('Then run this script again.\n');
    return;
  }

  console.log('\n2. Device is in WATCH mode. Simulating motion...');
  await reportMotion();

  console.log('\n3. Polling for updated state...');
  state = await poll();

  console.log('\n4. Check your phone for a push notification!');
  console.log('   You should see "Motion Detected!" alert.\n');

  // Keep polling to show state changes
  console.log('5. Polling every 2 seconds (Ctrl+C to stop)...\n');
  setInterval(async () => {
    await poll();
  }, 2000);
}

main().catch(console.error);

