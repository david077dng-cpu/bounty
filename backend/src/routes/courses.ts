import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

// List all courses with user progress
router.get('/', authMiddleware, async (req, res) => {
  try {
    const courses = await prisma.course.findMany({
      include: {
        lessons: {
          include: {
            task: true,
          },
          orderBy: {
            order: 'asc',
          },
        },
      },
      orderBy: {
        order: 'asc',
      },
    });

    // Get user progress
    const progress = await prisma.userProgress.findMany({
      where: { userId: req.userId! },
    });

    const completedLessonIds = new Set(progress.map(p => p.lessonId));

    // For each lesson, check if it's unlocked
    const coursesWithUnlock = courses.map(course => ({
      ...course,
      lessons: course.lessons.map(lesson => {
        const isUnlocked = !lesson.requiresLessonId || completedLessonIds.has(lesson.requiresLessonId);
        return {
          ...lesson,
          completed: completedLessonIds.has(lesson.id),
          unlocked: isUnlocked,
        };
      }),
    }));

    res.json({
      success: true,
      courses: coursesWithUnlock,
      difficultyTiers: [
        { key: 'beginner', name: '入门 Beginner', description: '基础概念和简单练习' },
        { key: 'intermediate', name: '进阶 Intermediate', description: '复杂工具组合和推理' },
        { key: 'advanced', name: '高级 Advanced', description: '真实世界复杂问题' },
      ],
    });
  } catch (error) {
    console.error('List courses error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single course with details
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const course = await prisma.course.findUnique({
      where: { id: parseInt(id) },
      include: {
        lessons: {
          include: {
            task: true,
          },
          orderBy: {
            order: 'asc',
          },
        },
      },
    });

    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const progress = await prisma.userProgress.findMany({
      where: { userId: req.userId! },
    });

    const completedLessonIds = new Set(progress.map(p => p.lessonId));

    const lessonsWithUnlock = course.lessons.map(lesson => {
      const isUnlocked = !lesson.requiresLessonId || completedLessonIds.has(lesson.requiresLessonId);
      return {
        ...lesson,
        completed: completedLessonIds.has(lesson.id),
        unlocked: isUnlocked,
      };
    });

    res.json({
      success: true,
      course: {
        ...course,
        lessons: lessonsWithUnlock,
      },
    });
  } catch (error) {
    console.error('Get course error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
