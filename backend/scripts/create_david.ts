import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  const username = 'david';
  const password = '123456';
  const hashedPassword = await bcrypt.hash(password, 10);
  const apiKey = `sb_${crypto.randomBytes(24).toString('hex')}`;

  try {
    const user = await prisma.user.upsert({
      where: { username },
      update: {
        password: hashedPassword,
        apiKey: apiKey
      },
      create: {
        username,
        password: hashedPassword,
        apiKey: apiKey,
        tier: 'Expert',
        totalBounty: 5000,
        totalScore: 4500,
        tasksCompleted: 15
      }
    });
    console.log(`✅ User 'david' created/updated successfully!`);
    console.log(`Username: ${username}`);
    console.log(`Password: ${password}`);
    console.log(`API Key: ${apiKey}`);
  } catch (error) {
    console.error('Error creating user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
