import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');

const IMAGE_DIR = path.join(__dirname, '../../../frontend/public/images/tasks');

// Ensure directory exists
if (!fs.existsSync(IMAGE_DIR)) {
  fs.mkdirSync(IMAGE_DIR, { recursive: true });
}

const CATEGORY_PROMPTS: Record<string, string> = {
  '悬疑推理': 'mysterious detective crime scene, dark atmospheric, digital illustration themed as a murder mystery puzzle',
  '综合联想': 'abstract creative concept map, soft flowing connections between different ideas, minimalist digital art',
  '代码能力': 'computer code algorithm flowchart, tech minimalist dark theme, programming concept visualization',
  '数学基础': 'mathematical concept diagram, clean geometric composition, abstract math art',
  '自然科学': 'scientific concept illustration, clear explanation visualization, educational style',
  '逻辑能力': 'logical puzzle diagram, clean reasoning structure, abstract geometric problem',
  '进化博弈': 'game theory interaction matrix, evolutionary strategy visualization, biological competition concept',
  '批判性思维': 'critical thinking analysis diagram, magnifying glass examining arguments, philosophical concept',
  '心理学效应': 'psychological concept visualization, human mind abstract art, soft conceptual style',
};

function getPromptForTask(task: any): string {
  const categoryName = task.category?.name || '综合联想';
  const categoryStyle = CATEGORY_PROMPTS[categoryName] || CATEGORY_PROMPTS['综合联想'];
  
  return `Generate a cover illustration for a puzzle task named "${task.name}". ${categoryStyle}. Style: clean modern digital art, fit for a card thumbnail (16:9 aspect ratio), dark theme compatible with a dark website. Do not add too much text, just the visual concept.`;
}

async function main() {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.error('ERROR: GOOGLE_API_KEY not set');
    process.exit(1);
  }

  console.log('Starting batch image generation...');
  
  const tasks = await prisma.task.findMany({
    include: { category: { select: { name: true } } },
  });

  console.log(`Found ${tasks.length} tasks to process.`);

  let success = 0;
  let skipped = 0;
  let failed = 0;

  for (const task of tasks) {
    const imagePath = path.join(IMAGE_DIR, `${task.id}.png`);
    
    if (fs.existsSync(imagePath)) {
      console.log(`[${task.id}] Image already exists, skipping.`);
      skipped++;
      continue;
    }

    const prompt = getPromptForTask(task);
    console.log(`[${task.id}] Generating: ${task.name}...`);

    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      
      const result = await model.generateContent([prompt]);
      const response = result.response;
      const candidates = response.candidates;
      
      if (!candidates || candidates.length === 0) {
        console.error(`  [${task.id}] No candidates in response`);
        failed++;
        continue;
      }

      let imageGenerated = false;
      for (const candidate of candidates) {
        if (!candidate.content || !candidate.content.parts) continue;
        
        for (const part of candidate.content.parts) {
          if (part.inlineData) {
            const buffer = Buffer.from(part.inlineData.data, 'base64');
            fs.writeFileSync(imagePath, buffer);
            console.log(`  [${task.id}] Saved image to ${imagePath}`);
            imageGenerated = true;
            break;
          }
        }
        if (imageGenerated) break;
      }

      if (imageGenerated) {
        success++;
      } else {
        console.error(`  [${task.id}] No image found in response parts`);
        failed++;
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (err: any) {
      console.error(`  [${task.id}] Error:`, err.message);
      failed++;
    }
  }

  console.log(`\nBatch generation complete!`);
  console.log(`Success: ${success}, Skipped: ${skipped}, Failed: ${failed}`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
