import express from 'express';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const router = express.Router();
const prisma = new PrismaClient();

const ARK_BASE_URL = process.env.VOLC_ARK_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3';
const ARK_API_KEY = process.env.VOLC_ARK_API_KEY;
const ARK_MODEL_ID = process.env.VOLC_ARK_MODEL_ID || 'doubao-1.5-pro-256k';

const inFlight = new Set<string>();

const STYLE_MAP: Record<string, string> = {
  M: '案发现场平面图或时间线图',
  A: '概念关系网络图',
  L: '命题关系图或真值表',
  N: '公式推导流程图',
  C: '算法流程图',
  S: '概念示意图',
  E: '博弈矩阵或策略树',
};

function buildSystemPrompt(taskId: string): string {
  const prefix = taskId[0].toUpperCase();
  const style = STYLE_MAP[prefix] ?? '概念示意图';
  return `你是一个SVG图示专家。根据任务描述生成一张解释性插图。

要求：
- 只输出纯SVG代码，不要markdown代码块，不要任何解释文字
- 开头必须是 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400" width="600" height="400">
- 深色背景 (#1a1a2e)，使用浅色文字和高对比度线条
- 图示风格：${style}
- 保持简洁，突出核心概念，不要堆砌细节`;
}

// GET /api/tasks/:id/illustration — public, no auth required
router.get('/tasks/:id/illustration', async (req, res) => {
  try {
    const { id } = req.params;

    const task = await prisma.task.findUnique({
      where: { id },
      include: { category: { select: { name: true } } },
    });

    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    // Return cached illustration
    if (task.illustration) {
      return res.json({ success: true, data: { svg: task.illustration } });
    }

    // No ARK key configured
    if (!ARK_API_KEY) {
      console.warn('[illustration] VOLC_ARK_API_KEY not set');
      return res.json({ success: true, data: { svg: null } });
    }

    // Prevent duplicate concurrent generation for same task
    if (inFlight.has(id)) {
      return res.json({ success: true, data: { svg: null } });
    }
    inFlight.add(id);

    // Generate via ARK
    const systemPrompt = buildSystemPrompt(task.id);
    const userPrompt = `任务名：${task.name}\n类别：${task.category.name}\n描述：${task.question}`;

    let svgContent: string | null = null;

    try {
      const response = await axios.post(
        `${ARK_BASE_URL}/chat/completions`,
        {
          model: ARK_MODEL_ID,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          stream: false,
          max_tokens: 4096,
        },
        {
          headers: {
            Authorization: `Bearer ${ARK_API_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );

      const raw: string = response.data?.choices?.[0]?.message?.content ?? '';
      const trimmed = raw.trim();

      const DANGEROUS_SVG = /<script|on\w+\s*=|javascript:|<foreignObject|<animate/i;
      if (trimmed.toLowerCase().startsWith('<svg') && !DANGEROUS_SVG.test(trimmed)) {
        svgContent = trimmed;
        // Cache in DB
        await prisma.task.update({
          where: { id: task.id },
          data: { illustration: svgContent },
        });
      } else {
        console.warn(`[illustration] Non-SVG response for task ${id}:`, trimmed.slice(0, 100));
      }
    } catch (err: any) {
      console.error(`[illustration] ARK call failed for task ${id}:`, err.message);
    } finally {
      inFlight.delete(id);
    }

    return res.json({ success: true, data: { svg: svgContent } });
  } catch (error) {
    console.error('[illustration] Route error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

export default router;
