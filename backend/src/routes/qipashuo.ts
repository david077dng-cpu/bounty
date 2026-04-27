import express from 'express';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

// Use existing VOLC ARK configuration
const ARK_BASE_URL = process.env.VOLC_ARK_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3';
const ARK_API_KEY = process.env.VOLC_ARK_API_KEY;
const ARK_MODEL_ID = process.env.VOLC_ARK_MODEL_ID || 'doubao-1.5-pro-256k';

// POST /api/qipashuo/debate - Proxy debate request to VOLC ARK API
router.post('/debate', async (req, res) => {
  try {
    const { systemPrompt, task, max_tokens = 1000 } = req.body;

    if (!ARK_API_KEY) {
      return res.json({
        success: false,
        error: 'VOLC_ARK_API_KEY not configured on server'
      });
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: task }
    ];

    const response = await axios.post(
      `${ARK_BASE_URL}/chat/completions`,
      {
        model: ARK_MODEL_ID,
        messages,
        max_tokens,
      },
      {
        headers: {
          'Authorization': `Bearer ${ARK_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 60000, // 1 minute
      }
    );

    if (response.data && response.data.choices && response.data.choices[0] && response.data.choices[0].message) {
      return res.json({
        success: true,
        text: response.data.choices[0].message.content
      });
    }

    res.json({
      success: false,
      error: 'No text content in response'
    });
  } catch (error: any) {
    console.error('Qipashuo debate error:', error);
    res.json({
      success: false,
      error: error.message || 'Server error'
    });
  }
});

// POST /api/qipashuo/save - Save completed debate to history (requires auth)
router.post('/save', authMiddleware, async (req, res) => {
  try {
    const { topic, fullContent } = req.body;
    const userId = req.user?.id;

    const debate = await prisma.debateHistory.create({
      data: {
        userId,
        topic,
        fullContent: JSON.stringify(fullContent),
        speakerCount: fullContent.length,
      },
    });

    res.json({
      success: true,
      id: debate.id,
      message: 'Debate saved successfully',
    });
  } catch (error: any) {
    console.error('Qipashuo save error:', error);
    res.json({
      success: false,
      error: error.message || 'Server error',
    });
  }
});

// GET /api/qipashuo/history - Get user's debate history
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const [debates, total] = await Promise.all([
      prisma.debateHistory.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          topic: true,
          speakerCount: true,
          createdAt: true,
        },
      }),
      prisma.debateHistory.count({ where: { userId } }),
    ]);

    res.json({
      success: true,
      debates,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    console.error('Qipashuo history error:', error);
    res.json({
      success: false,
      error: error.message || 'Server error',
    });
  }
});

// GET /api/qipashuo/:id - Get a specific debate
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id;
    const debateId = parseInt(req.params.id);

    const debate = await prisma.debateHistory.findFirst({
      where: { id: debateId, userId },
    });

    if (!debate) {
      return res.json({
        success: false,
        error: 'Debate not found',
      });
    }

    res.json({
      success: true,
      debate: {
        ...debate,
        fullContent: JSON.parse(debate.fullContent),
      },
    });
  } catch (error: any) {
    console.error('Qipashuo get error:', error);
    res.json({
      success: false,
      error: error.message || 'Server error',
    });
  }
});

// DELETE /api/qipashuo/:id - Delete a debate
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id;
    const debateId = parseInt(req.params.id);

    const debate = await prisma.debateHistory.findFirst({
      where: { id: debateId, userId },
    });

    if (!debate) {
      return res.json({
        success: false,
        error: 'Debate not found',
      });
    }

    await prisma.debateHistory.delete({
      where: { id: debateId },
    });

    res.json({
      success: true,
      message: 'Debate deleted',
    });
  } catch (error: any) {
    console.error('Qipashuo delete error:', error);
    res.json({
      success: false,
      error: error.message || 'Server error',
    });
  }
});

export default router;
