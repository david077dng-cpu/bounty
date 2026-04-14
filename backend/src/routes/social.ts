import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth';
import jwt from 'jsonwebtoken';

const router = express.Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret';

// Helper: get userId from cookie without blocking — returns undefined for guests
function getOptionalUserId(req: express.Request): number | undefined {
  try {
    const token = req.cookies?.jwt;
    if (!token) return undefined;
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
    return decoded.userId;
  } catch {
    return undefined;
  }
}

// GET /stats/:taskId — public, returns { likeCount, commentCount, liked }
router.get('/stats/:taskId', async (req, res) => {
  const { taskId } = req.params;
  const userId = getOptionalUserId(req);
  try {
    const [likeCount, commentCount] = await Promise.all([
      prisma.like.count({ where: { taskId } }),
      prisma.comment.count({ where: { taskId } }),
    ]);
    let liked = false;
    if (userId) {
      const existing = await prisma.like.findUnique({ where: { userId_taskId: { userId, taskId } } });
      liked = !!existing;
    }
    res.json({ success: true, likeCount, commentCount, liked });
  } catch (error) {
    console.error('Social stats error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /like/:taskId — auth required, toggle like, returns { liked, likeCount }
router.post('/like/:taskId', authMiddleware, async (req, res) => {
  const { taskId } = req.params;
  const userId = req.userId!;
  try {
    const existing = await prisma.like.findUnique({ where: { userId_taskId: { userId, taskId } } });
    let liked: boolean;
    if (existing) {
      await prisma.like.delete({ where: { userId_taskId: { userId, taskId } } });
      liked = false;
    } else {
      await prisma.like.create({ data: { userId, taskId } });
      liked = true;
    }
    const likeCount = await prisma.like.count({ where: { taskId } });
    res.json({ success: true, liked, likeCount });
  } catch (error) {
    console.error('Like toggle error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /comments/:taskId — public, returns comment list
router.get('/comments/:taskId', async (req, res) => {
  const { taskId } = req.params;
  try {
    const comments = await prisma.comment.findMany({
      where: { taskId },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { id: true, username: true } } },
    });
    res.json({
      success: true,
      comments: comments.map(c => ({
        id: c.id,
        content: c.content,
        createdAt: c.createdAt,
        user: c.user,
      })),
    });
  } catch (error) {
    console.error('Comments list error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /comments/:taskId — auth required, add comment (max 500 chars)
router.post('/comments/:taskId', authMiddleware, async (req, res) => {
  const { taskId } = req.params;
  const userId = req.userId!;
  const { content } = req.body;
  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return res.status(400).json({ error: '评论内容不能为空' });
  }
  if (content.length > 500) {
    return res.status(400).json({ error: '评论最多 500 字' });
  }
  try {
    const comment = await prisma.comment.create({
      data: { userId, taskId, content: content.trim() },
      include: { user: { select: { id: true, username: true } } },
    });
    res.json({
      success: true,
      comment: {
        id: comment.id,
        content: comment.content,
        createdAt: comment.createdAt,
        user: comment.user,
      },
    });
  } catch (error) {
    console.error('Comment create error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /comments/:id — auth required, own comment OR task author
router.delete('/comments/:id', authMiddleware, async (req, res) => {
  const commentId = parseInt(req.params.id);
  const userId = req.userId!;
  if (isNaN(commentId)) return res.status(400).json({ error: 'Invalid comment ID' });
  try {
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      include: { task: { select: { authorId: true } } },
    });
    if (!comment) return res.status(404).json({ error: 'Comment not found' });
    const isOwnComment = comment.userId === userId;
    const isTaskAuthor = comment.task.authorId === userId;
    if (!isOwnComment && !isTaskAuthor) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await prisma.comment.delete({ where: { id: commentId } });
    res.json({ success: true });
  } catch (error) {
    console.error('Comment delete error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
