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
      include: { category: true }
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Get weights based on category
    let weights = { accuracy: 0.25, reasoning: 0.25, creativity: 0.25, speed: 0.25 };
    const catName = task.category.name;
    
    if (['悬疑推理', '逻辑能力', '批判性思维'].includes(catName)) {
      weights = { accuracy: 0.3, reasoning: 0.5, creativity: 0.1, speed: 0.1 };
    } else if (['综合联想'].includes(catName)) {
      weights = { accuracy: 0.2, reasoning: 0.2, creativity: 0.5, speed: 0.1 };
    } else if (['代码能力', '数学基础'].includes(catName)) {
      weights = { accuracy: 0.4, reasoning: 0.4, creativity: 0.0, speed: 0.2 };
    } else if (['自然科学', '心理学效应', '进化博弈'].includes(catName)) {
      weights = { accuracy: 0.3, reasoning: 0.3, creativity: 0.2, speed: 0.2 };
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
      (finalScores.accuracy * weights.accuracy) + 
      (finalScores.reasoning * weights.reasoning) + 
      (finalScores.creativity * weights.creativity) + 
      (finalScores.speed * weights.speed)
    );

    // Calculate grade
    let grade;
    let gradeMultiplier = 1.0;
    if (totalScore >= 90) {
      grade = 'S';
      gradeMultiplier = 1.2;
    } else if (totalScore >= 80) {
      grade = 'A';
      gradeMultiplier = 1.1;
    } else if (totalScore >= 70) {
      grade = 'B';
      gradeMultiplier = 1.0;
    } else if (totalScore >= 60) {
      grade = 'C';
      gradeMultiplier = 0.8;
    } else {
      grade = 'D';
      gradeMultiplier = 0.5;
    }

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

    // Dynamic multiplier based on tier
    let tierMultiplier = 12;
    if (task.tier === 'easy') tierMultiplier = 10;
    else if (task.tier === 'medium') tierMultiplier = 15;
    else if (task.tier === 'hard') tierMultiplier = 20;

    const scoreContribution = Math.round(totalScore * tierMultiplier * gradeMultiplier);
    const newTotalScore = user.totalScore + scoreContribution + bountyEarned;
    const newTotalBounty = user.totalBounty + bountyEarned;
    const newTasksCompleted = user.tasksCompleted + 1;

    // Update tier based on score
    let newTier = user.tier;
    if (newTotalScore > 12000) newTier = 'Master';
    else if (newTotalScore > 8000) newTier = 'Expert';
    else if (newTotalScore > 2000) newTier = 'Apprentice';
    else newTier = 'Novice';

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
