import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

// Get my created tasks
router.get('/my-tasks', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId!;

    const tasks = await prisma.task.findMany({
      where: { authorId: userId },
      include: {
        category: { select: { name: true, icon: true } },
        author: { select: { username: true } },
      },
      orderBy: {
        createdAt: 'desc'
      },
    });

    res.json({
      success: true,
      tasks: tasks.map(t => ({
        id: t.id,
        name: t.name,
        tier: t.tier,
        bounty: t.bounty,
        catIcon: t.catIcon,
        category: t.category.name,
        isPublic: t.isPublic,
        author: t.author?.username,
        questionPreview: t.question.split('\n')[0].slice(0, 80) + '...',
      })),
    });
  } catch (error) {
    console.error('Get my tasks error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create new task
router.post('/task', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId!;
    const {
      id,
      name,
      tier,
      bounty,
      categoryId,
      catIcon,
      question,
      hint,
      answer,
      refAccuracy,
      refReasoning,
      refCreativity,
      refSpeed,
      steps,
      isPublic,
    } = req.body;

    if (!id || !name || !tier || !bounty || !categoryId || !catIcon || !question || !answer) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if task id already exists
    const existing = await prisma.task.findUnique({ where: { id } });
    if (existing) {
      return res.status(400).json({ error: 'Task ID already exists' });
    }

    const task = await prisma.task.create({
      data: {
        id,
        name,
        tier,
        bounty: parseInt(bounty),
        categoryId: parseInt(categoryId),
        catIcon,
        question,
        hint: hint || null,
        answer,
        refAccuracy: parseInt(refAccuracy),
        refReasoning: parseInt(refReasoning),
        refCreativity: parseInt(refCreativity),
        refSpeed: parseInt(refSpeed),
        steps: JSON.stringify(steps || []),
        authorId: userId,
        isPublic: isPublic !== false,
      },
    });

    res.json({ success: true, task });
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update my task
router.put('/task/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const data = req.body;

    // Check ownership
    const existing = await prisma.task.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Task not found' });
    }
    if (existing.authorId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const task = await prisma.task.update({
      where: { id },
      data: {
        name: data.name,
        tier: data.tier,
        bounty: data.bounty ? parseInt(data.bounty) : undefined,
        categoryId: data.categoryId ? parseInt(data.categoryId) : undefined,
        catIcon: data.catIcon,
        question: data.question,
        hint: data.hint || null,
        answer: data.answer,
        refAccuracy: data.refAccuracy ? parseInt(data.refAccuracy) : undefined,
        refReasoning: data.refReasoning ? parseInt(data.refReasoning) : undefined,
        refCreativity: data.refCreativity ? parseInt(data.refCreativity) : undefined,
        refSpeed: data.refSpeed ? parseInt(data.refSpeed) : undefined,
        steps: data.steps ? JSON.stringify(data.steps) : undefined,
        isPublic: data.isPublic,
      },
    });

    res.json({ success: true, task });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete my task
router.delete('/task/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const existing = await prisma.task.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Task not found' });
    }
    if (existing.authorId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await prisma.task.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get categories for selection
router.get('/categories', async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      select: { id: true, name: true, icon: true },
    });
    res.json({ success: true, categories });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
