import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

// Get my submissions
router.get('/my', authMiddleware, async (req, res) => {
  try {
    const submissions = await prisma.submission.findMany({
      where: { userId: req.userId! },
      include: {
        task: {
          select: {
            id: true,
            name: true,
            catIcon: true,
            bounty: true,
            tier: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json({
      success: true,
      submissions: submissions.map(s => ({
        id: s.id,
        task: s.task,
        userAnswer: s.userAnswer,
        accuracy: s.accuracy,
        reasoning: s.reasoning,
        creativity: s.creativity,
        speed: s.speed,
        totalScore: s.totalScore,
        bountyEarned: s.bountyEarned,
        grade: s.grade,
        createdAt: s.createdAt,
      })),
    });
  } catch (error) {
    console.error('My submissions error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Submit a completed task
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { taskId, userAnswer, scores } = req.body;

    if (!taskId) {
      return res.status(400).json({ error: 'taskId is required' });
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Calculate total score
    let finalScores;
    if (scores) {
      // Use provided scores (from manual submission with slight randomization)
      finalScores = {
        accuracy: scores.accuracy || task.refAccuracy,
        reasoning: scores.reasoning || task.refReasoning,
        creativity: scores.creativity || task.refCreativity,
        speed: scores.speed || task.refSpeed,
      };
    } else {
      // Use reference scores (auto demonstration)
      finalScores = {
        accuracy: task.refAccuracy,
        reasoning: task.refReasoning,
        creativity: task.refCreativity,
        speed: task.refSpeed,
      };
    }

    const totalScore = Math.round(
      (finalScores.accuracy + finalScores.reasoning + finalScores.creativity + finalScores.speed) / 4
    );

    // Calculate grade
    let grade;
    if (totalScore >= 90) grade = 'S';
    else if (totalScore >= 80) grade = 'A';
    else if (totalScore >= 70) grade = 'B';
    else if (totalScore >= 60) grade = 'C';
    else grade = 'D';

    const bountyEarned = task.bounty;

    // Create submission
    const submission = await prisma.submission.create({
      data: {
        userId: req.userId!,
        taskId,
        userAnswer: userAnswer || null,
        accuracy: finalScores.accuracy,
        reasoning: finalScores.reasoning,
        creativity: finalScores.creativity,
        speed: finalScores.speed,
        totalScore,
        bountyEarned,
        grade,
      },
    });

    // Update user stats
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const newTotalScore = user.totalScore + totalScore * 12 + bountyEarned;
    const newTotalBounty = user.totalBounty + bountyEarned;
    const newTasksCompleted = user.tasksCompleted + 1;

    // Update tier based on score (evolution stage)
    let newTier = user.tier;
    if (newTotalScore > 12000) newTier = '究极体';
    else if (newTotalScore > 8000) newTier = '成熟期';
    else if (newTotalScore > 2000) newTier = '成长期';
    else newTier = '幼年期';

    await prisma.user.update({
      where: { id: req.userId! },
      data: {
        totalScore: newTotalScore,
        totalBounty: newTotalBounty,
        tasksCompleted: newTasksCompleted,
        tier: newTier,
      },
    });

    res.json({
      success: true,
      submission: {
        id: submission.id,
        accuracy: finalScores.accuracy,
        reasoning: finalScores.reasoning,
        creativity: finalScores.creativity,
        speed: finalScores.speed,
        totalScore,
        bountyEarned,
        grade,
        answer: task.answer, // Send back the reference answer
      },
      userStats: {
        totalScore: newTotalScore,
        totalBounty: newTotalBounty,
        tasksCompleted: newTasksCompleted,
        tier: newTier,
      },
    });
  } catch (error) {
    console.error('Submit error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
