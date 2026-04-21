import express from 'express';
import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';

const router = express.Router();
const prisma = new PrismaClient();

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');
const inFlight = new Set<string>();
const MYSTERY_CATEGORY = '悬疑推理';

const IMAGE_DIR = path.join(__dirname, '../../../../frontend/public/images/tasks');

// Ensure directory exists
if (!fs.existsSync(IMAGE_DIR)) {
  fs.mkdirSync(IMAGE_DIR, { recursive: true });
}

// CATEGORY_STYLE: prompts for different task categories
const CATEGORY_PROMPTS: Record<string, string> = {
  '悬疑推理': 'mysterious detective crime scene, dark atmospheric, digital illustration themed as a murder mystery puzzle',
  '综合联想': 'abstract creative concept map, soft flowing connections between different ideas, minimalist digital art',
  '代码能力': 'computer code algorithm flowchart, tech minimalist dark theme, programming concept visualization',
  '数学基础': 'mathematical concept diagram, clean geometric composition, abstract math art',
  '自然科学': 'scientific concept illustration, clear explanation visualization, educational style',
  '逻辑能力': 'logical puzzle diagram, clean reasoning structure, abstract geometric problem',
  '进化博弈': 'game theory interaction matrix, evolutionary strategy visualization, biological competition concept',
  '批判性思维': 'critical thinking analysis diagram, magnifying glass examining arguments, philosophical concept',
};

function getPromptForTask(task: any): string {
  const categoryName = task.category?.name || '综合联想';
  const categoryStyle = CATEGORY_PROMPTS[categoryName] || CATEGORY_PROMPTS['综合联想'];

  return `Generate a cover illustration for a puzzle task named "${task.name}". ${categoryStyle}. Task description: ${task.question.slice(0, 200)}. Style: clean modern digital art, fit for a card thumbnail (16:9 aspect ratio), dark theme compatible with a dark website. Do not add too much text, just the visual concept.`;
}

// GET /api/tasks/:id/gemini-image — get existing PNG image path, generate on-demand for mystery category
router.get('/tasks/:id/gemini-image', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if image already exists on disk
    const imagePath = path.join(IMAGE_DIR, `${id}.png`);
    if (fs.existsSync(imagePath)) {
      const imageUrl = `/images/tasks/${id}.png`;
      return res.json({ success: true, data: { imageUrl, exists: true } });
    }

    // Fetch task to check category
    const task = await prisma.task.findUnique({
      where: { id },
      include: { category: { select: { name: true } } },
    });

    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    // Only generate on-demand for mystery category
    const categoryName = task.category?.name || '';
    if (categoryName !== MYSTERY_CATEGORY) {
      return res.json({ success: false, error: 'Image not yet generated' });
    }

    // Check if generation is already in progress
    if (inFlight.has(id)) {
      return res.json({ success: false, error: 'Image generation in progress' });
    }

    // Check if API key is configured
    if (!process.env.GOOGLE_API_KEY) {
      console.warn('[gemini-image] GOOGLE_API_KEY not set');
      return res.json({ success: false, error: 'Image generation not configured' });
    }

    inFlight.add(id);

    try {
      // Generate image via Gemini
      const prompt = getPromptForTask(task);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp-image-generation' });

      const result = await model.generateContent([prompt]);
      const response = result.response;
      const candidates = response.candidates;

      if (!candidates || candidates.length === 0) {
        throw new Error('No candidates in response');
      }

      let imageGenerated = false;
      for (const candidate of candidates) {
        if (!candidate.content || !candidate.content.parts) continue;

        for (const part of candidate.content.parts) {
          if (part.inlineData) {
            const buffer = Buffer.from(part.inlineData.data, 'base64');
            fs.writeFileSync(imagePath, buffer);
            imageGenerated = true;
            break;
          }
        }
        if (imageGenerated) break;
      }

      if (imageGenerated) {
        const imageUrl = `/images/tasks/${id}.png`;
        return res.json({ success: true, data: { imageUrl, exists: true } });
      } else {
        throw new Error('No image found in response parts');
      }
    } catch (err: any) {
      console.error(`[gemini-image] Generation failed for task ${id}:`, err.message);
      return res.json({ success: false, error: 'Image generation failed: ' + err.message });
    } finally {
      inFlight.delete(id);
    }

  } catch (error: any) {
    console.error('[gemini-image] Route error:', error);
    res.status(500).json({ success: false, error: 'Server error: ' + error.message });
  }
});

export default router;
