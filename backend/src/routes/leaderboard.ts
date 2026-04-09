import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// Get public leaderboard (top 50)
router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;

    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        tier: true,
        totalScore: true,
        totalBounty: true,
        tasksCompleted: true,
      },
      orderBy: {
        totalScore: 'desc',
      },
      take: limit,
    });

    res.json({
      success: true,
      leaderboard: users,
    });
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
