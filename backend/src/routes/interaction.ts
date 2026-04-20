import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth';
import { callArkCompletion } from '../utils/ark';
import type { Message } from '../utils/ark';
import { notifyAgent } from '../websocket';

const router = express.Router();
const prisma = new PrismaClient();

// Get existing interaction history for this user + task
router.get('/history/:taskId', authMiddleware, async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.userId!;

    // Get the latest session for this user+task
    const latestRound = await prisma.interactionRound.findFirst({
      where: { userId, taskId },
      orderBy: { timestamp: 'desc' },
    });

    if (!latestRound) {
      return res.json({
        success: true,
        hasHistory: false,
        history: [],
        currentRound: 0,
      });
    }

    // Get all rounds from this session, ordered by round number
    const rounds = await prisma.interactionRound.findMany({
      where: { userId, taskId, sessionId: latestRound.sessionId },
      orderBy: { roundNumber: 'asc' },
    });

    res.json({
      success: true,
      hasHistory: true,
      sessionId: latestRound.sessionId,
      currentRound: latestRound.roundNumber,
      history: rounds.map(r => ({
        roundNumber: r.roundNumber,
        userInput: r.userInput,
        systemResponse: r.systemResponse,
        gameState: r.gameState ? JSON.parse(r.gameState) : null,
        timestamp: r.timestamp,
      })),
      latestGameState: latestRound.gameState ? JSON.parse(latestRound.gameState) : null,
    });
  } catch (error) {
    console.error('Get interaction history error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Start a new interactive session
router.post('/start/:taskId', authMiddleware, async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.userId!;

    // Check task exists and is interactive
    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (!task.isInteractive) {
      return res.status(400).json({ error: 'This task is not interactive' });
    }

    const config = task.interactionConfig ? JSON.parse(task.interactionConfig) : null;
    const initialMessage = config?.initialMessage || task.question;

    // Generate new session ID
    const sessionId = `${userId}-${taskId}-${Date.now()}`;

    // Create first round - initial prompt
    const firstRound = await prisma.interactionRound.create({
      data: {
        userId,
        taskId,
        sessionId,
        roundNumber: 1,
        userInput: null, // First round is system's opening
        systemResponse: initialMessage,
      },
    });

    res.json({
      success: true,
      sessionId,
      roundNumber: 1,
      systemResponse: initialMessage,
      interactionType: task.interactionType,
      config: config,
    });
  } catch (error) {
    console.error('Start interaction error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Submit user action and get system/AI response
router.post('/step/:taskId', authMiddleware, async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.userId!;
    const { sessionId, userInput, gameState } = req.body;

    // Get current session info
    const lastRound = await prisma.interactionRound.findFirst({
      where: { userId, taskId, sessionId },
      orderBy: { roundNumber: 'desc' },
    });

    if (!lastRound) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const nextRound = lastRound.roundNumber + 1;

    // Get task for system prompt
    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task || !task.isInteractive) {
      return res.status(400).json({ error: 'Invalid task' });
    }

    const config = task.interactionConfig ? JSON.parse(task.interactionConfig) : null;

    // For dialogue-type interactions, use ARK to generate AI response
    let systemResponse = '';
    if (task.interactionType === 'dialogue' || task.interactionType === 'puzzle') {
      // Build conversation history
      const history = await prisma.interactionRound.findMany({
        where: { userId, taskId, sessionId },
        orderBy: { roundNumber: 'asc' },
      });

      const systemPrompt = config?.systemPrompt || `${task.question}\n\n你正在和用户进行一个互动问答游戏。请根据用户的每一轮回答，给出回应、提示或者下一步问题。保持回答简洁，不超过300字。`;

      const messages: Message[] = [
        {
          role: 'system' as const,
          content: systemPrompt,
        },
        ...history.flatMap(r => {
          const msgs: Message[] = [];
          if (r.userInput) {
            msgs.push({ role: 'user' as const, content: r.userInput });
          }
          if (r.systemResponse) {
            msgs.push({ role: 'assistant' as const, content: r.systemResponse });
          }
          return msgs;
        }),
        { role: 'user' as const, content: userInput },
      ];

      try {
        const completion = await callArkCompletion(messages);
        systemResponse = completion;
      } catch (arkError) {
        console.error('ARK completion error:', arkError);
        systemResponse = '抱歉，AI生成回应失败了，请再试一次。';
      }
    } else if (task.interactionType === 'game') {
      // For games, the gameState already contains everything needed
      // Frontend handles game logic, just store it
      systemResponse = '回合已更新';
    } else {
      systemResponse = '收到你的回应，请继续。';
    }

    // Save the new round
    const newRound = await prisma.interactionRound.create({
      data: {
        userId,
        taskId,
        sessionId,
        roundNumber: nextRound,
        userInput,
        systemResponse,
        gameState: gameState ? JSON.stringify(gameState) : null,
      },
    });

    // Notify connected Agent via WebSocket
    notifyAgent(userId, 'interaction_step', {
      taskId,
      sessionId,
      roundNumber: nextRound,
      systemResponse,
      gameState,
    });

    res.json({
      success: true,
      roundNumber: nextRound,
      systemResponse,
      gameState: gameState,
    });
  } catch (error) {
    console.error('Interaction step error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Finish interaction and submit for scoring
router.post('/finish/:taskId', authMiddleware, async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.userId!;
    const { sessionId } = req.body;

    // Get all rounds from the session
    const rounds = await prisma.interactionRound.findMany({
      where: { userId, taskId, sessionId },
      orderBy: { roundNumber: 'asc' },
    });

    // Compile all interaction into the final answer
    const fullAnswer = rounds
      .map(r => {
        let entry = '';
        if (r.userInput) entry += `回合 ${r.roundNumber} - 用户: ${r.userInput}\n`;
        if (r.systemResponse) entry += `回合 ${r.roundNumber} - 系统: ${r.systemResponse}\n`;
        return entry;
      })
      .join('\n');

    // Get task reference scores
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

    // Calculate scores with random variation like regular tasks
    const scores = {
      accuracy: Math.min(100, Math.max(50, task.refAccuracy + Math.floor(Math.random() * 20) - 10)),
      reasoning: Math.min(100, Math.max(50, task.refReasoning + Math.floor(Math.random() * 20) - 10)),
      creativity: Math.min(100, Math.max(50, task.refCreativity + Math.floor(Math.random() * 20) - 10)),
      speed: Math.min(100, Math.max(50, task.refSpeed + Math.floor(Math.random() * 20) - 10)),
    };

    const totalScore = Math.round(
      (scores.accuracy * weights.accuracy) + 
      (scores.reasoning * weights.reasoning) + 
      (scores.creativity * weights.creativity) + 
      (scores.speed * weights.speed)
    );

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

    const bountyEarned = Math.round(task.bounty * (totalScore / 100));

    // Dynamic multiplier based on tier
    let tierMultiplier = 12;
    if (task.tier === 'easy') tierMultiplier = 10;
    else if (task.tier === 'medium') tierMultiplier = 15;
    else if (task.tier === 'hard') tierMultiplier = 20;

    const scoreContribution = Math.round(totalScore * tierMultiplier * gradeMultiplier);

    // Create submission
    const submission = await prisma.submission.create({
      data: {
        userId,
        taskId,
        userAnswer: fullAnswer,
        accuracy: scores.accuracy,
        reasoning: scores.reasoning,
        creativity: scores.creativity,
        speed: scores.speed,
        totalScore,
        bountyEarned,
        grade,
      },
    });

    // Update user stats
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (user) {
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
        where: { id: userId },
        data: {
          totalScore: newTotalScore,
          totalBounty: newTotalBounty,
          tasksCompleted: newTasksCompleted,
          tier: newTier,
        },
      });
    }

    res.json({
      success: true,
      submission: {
        id: submission.id,
        bountyEarned,
        totalScore,
        grade,
        scores,
      },
      fullAnswer,
    });
  } catch (error) {
    console.error('Finish interaction error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Reset/restart the interaction
router.post('/reset/:taskId', authMiddleware, async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.userId!;

    // Just start a new session, old history remains for records
    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task || !task.isInteractive) {
      return res.status(400).json({ error: 'Invalid task' });
    }

    const sessionId = `${userId}-${taskId}-${Date.now()}`;
    const firstRound = await prisma.interactionRound.create({
      data: {
        userId,
        taskId,
        sessionId,
        roundNumber: 1,
        userInput: null,
        systemResponse: task.question,
      },
    });

    res.json({
      success: true,
      sessionId,
      roundNumber: 1,
      systemResponse: task.question,
    });
  } catch (error) {
    console.error('Reset interaction error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;