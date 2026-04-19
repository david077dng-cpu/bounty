import express from 'express';
import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';

const router = express.Router();
const prisma = new PrismaClient();

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');

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

// GET /api/tasks/:id/gemini-image — get existing PNG image path
router.get('/tasks/:id/gemini-image', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if image exists on disk
    const imagePath = path.join(IMAGE_DIR, `${id}.png`);
    if (fs.existsSync(imagePath)) {
      const imageUrl = `/images/tasks/${id}.png`;
      return res.json({ success: true, data: { imageUrl, exists: true } });
    }

    // No image found, just return failure without generating
    return res.json({ success: false, error: 'Image not yet generated' });

  } catch (error: any) {
    console.error('[gemini-image] Route error:', error);
    res.status(500).json({ success: false, error: 'Server error: ' + error.message });
  }
});

export default router;
