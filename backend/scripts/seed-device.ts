/**
 * Seed script to create a test device for development
 * Run with: npx tsx scripts/seed-device.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create a test device
  const device = await prisma.device.upsert({
    where: { id: 'TEST-DEVICE-001' },
    update: {},
    create: {
      id: 'TEST-DEVICE-001',
      secret: 'test-secret-123',
    },
  });

  console.log('Created test device:', device);
  console.log('\nQR Code URL:');
  console.log(`https://pair.trackstar/dev?d=${device.id}&s=${device.secret}`);
  console.log('\nTest with curl:');
  console.log(`curl -H "x-device-id: ${device.id}" -H "x-device-secret: ${device.secret}" http://localhost:3000/api/esp32/poll`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

