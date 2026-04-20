import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth';
import axios from 'axios';

const router = express.Router();
const prisma = new PrismaClient();

const ARK_BASE_URL = process.env.VOLC_ARK_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3';
const ARK_API_KEY = process.env.VOLC_ARK_API_KEY;
const ARK_MODEL_ID = process.env.VOLC_ARK_MODEL_ID || 'doubao-1.5-pro-256k';

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
      isInteractive,
      interactionType,
      interactionConfig,
      rounds,
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
        isInteractive: isInteractive === true,
        interactionType: interactionType || null,
        interactionConfig: interactionConfig ? JSON.stringify(interactionConfig) : null,
        rounds: rounds ? parseInt(rounds) : null,
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

    const updateData: any = {
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
    };

    // Add interactive fields if provided
    if ('interactiveType' in data) {
      updateData.interactiveType = data.interactiveType || null;
    }
    if ('interactiveConfig' in data && data.interactiveConfig !== undefined) {
      updateData.interactiveConfig = data.interactiveConfig ? JSON.stringify(data.interactiveConfig) : null;
    }

    const task = await prisma.task.update({
      where: { id },
      data: updateData,
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

// Fetch URL content and strip HTML
router.post('/fetch-url', authMiddleware, async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    try { new URL(url); } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    const response = await axios.get(url, {
      timeout: 15000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SkillBounty/1.0)' },
      maxContentLength: 2 * 1024 * 1024,
      responseType: 'text',
    });

    let text: string = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);

    // Strip HTML
    text = text
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();

    if (text.length > 8000) text = text.slice(0, 8000) + '...';

    res.json({ success: true, text, length: text.length });
  } catch (error: any) {
    console.error('Fetch URL error:', error);
    res.status(500).json({ error: `Failed to fetch URL: ${error.message}` });
  }
});

// Generate tasks from source text using ARK LLM
router.post('/generate-tasks', authMiddleware, async (req, res) => {
  try {
    if (!ARK_API_KEY) {
      return res.status(500).json({ error: 'ARK API key not configured. Please set VOLC_ARK_API_KEY in .env' });
    }

    const { sourceText, count = 3, tier = 'medium' } = req.body;
    if (!sourceText || !sourceText.trim()) {
      return res.status(400).json({ error: 'sourceText is required' });
    }

    const taskCount = Math.min(Math.max(1, parseInt(count) || 3), 5);
    const truncatedText = sourceText.slice(0, 6000);

    const prompt = `你是一位专业的AI技能训练平台任务设计师。请根据以下来源材料，生成${taskCount}道独立的训练挑战任务。

要求：
- 每道任务应考察不同的知识点或能力
- 难度设置为"${tier}"级别（easy=简单, medium=中等, hard=困难）
- 任务类型可包括：推理分析、概念理解、问题解决、创意应用等
- 返回格式必须是JSON数组，不包含任何Markdown代码块标记

每道任务的JSON对象格式如下：
{
  "name": "任务名称（10-20字）",
  "question": "任务描述和问题（50-200字，清晰说明任务要求）",
  "hint": "提示（可选，20-50字）",
  "answer": "参考答案（50-200字，完整清晰的解答）",
  "steps": "think:分析思路\\ncalc:具体步骤\\nok:结论",
  "refAccuracy": 参考准确性分数(60-95),
  "refReasoning": 参考推理性分数(60-95),
  "refCreativity": 参考创造性分数(60-95),
  "refSpeed": 参考速度分数(60-95),
  "suggestedTier": "${tier}",
  "suggestedCatIcon": "相关emoji图标"
}

steps字段格式：每行"类型:内容"，类型可选: think(思考), calc(计算/推导), ok(结论), warn(警告), step(步骤)，行间用\\n分隔。

来源材料：
${truncatedText}

请直接返回JSON数组，不要包含任何其他文字或Markdown标记。`;

    const response = await axios.post(
      `${ARK_BASE_URL}/chat/completions`,
      {
        model: ARK_MODEL_ID,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
        temperature: 0.7,
        max_tokens: 4000,
      },
      {
        headers: {
          Authorization: `Bearer ${ARK_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 60000,
        proxy: false,
      }
    );

    const content: string = response.data.choices?.[0]?.message?.content || '';

    let tasks: any[];
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('No JSON array in response');
      tasks = JSON.parse(jsonMatch[0]);
    } catch {
      console.error('LLM response parse failed:', content.slice(0, 500));
      return res.status(500).json({ error: 'Failed to parse AI response', raw: content.slice(0, 300) });
    }

    if (!Array.isArray(tasks)) {
      return res.status(500).json({ error: 'AI response is not an array' });
    }

    res.json({ success: true, tasks });
  } catch (error: any) {
    console.error('Generate tasks error:', error);
    res.status(500).json({ error: `Failed to generate tasks: ${error.message}` });
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
