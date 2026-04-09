import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

// List all tasks with optional category filtering
router.get('/', authMiddleware, async (req, res) => {
  try {
    const category = req.query.category as string;
    const userId = req.userId!;

    let where = {};
    if (category && category !== '全部') {
      const cat = await prisma.category.findUnique({
        where: { name: category },
      });
      if (cat) {
        where = { categoryId: cat.id };
      }
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        category: {
          select: {
            name: true,
            icon: true,
          },
        },
      },
      orderBy: {
        id: 'asc',
      },
    });

    // Get all completed tasks for this user
    const completedSubmissions = await prisma.submission.findMany({
      where: { userId },
      select: { taskId: true },
    });
    const completedTaskIds = new Set(completedSubmissions.map(s => s.taskId));

    const categories = await prisma.category.findMany({
      select: {
        id: true,
        name: true,
        icon: true,
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
        questionPreview: t.question.split('\n')[0].slice(0, 80) + '...',
        completed: completedTaskIds.has(t.id),
      })),
      categories: categories.map(c => ({
        id: c.id,
        name: c.name,
        icon: c.icon,
      })),
    });
  } catch (error) {
    console.error('Tasks list error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single task by id
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        category: {
          select: {
            name: true,
            icon: true,
          },
        },
      },
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({
      success: true,
      task: {
        id: task.id,
        name: task.name,
        tier: task.tier,
        bounty: task.bounty,
        catIcon: task.catIcon,
        category: task.category.name,
        question: task.question,
        hint: task.hint,
        answer: task.answer,
        steps: JSON.parse(task.steps),
        refAccuracy: task.refAccuracy,
        refReasoning: task.refReasoning,
        refCreativity: task.refCreativity,
        refSpeed: task.refSpeed,
      },
    });
  } catch (error) {
    console.error('Task get error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
