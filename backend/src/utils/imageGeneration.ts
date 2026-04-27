import * as fs from 'fs';
import * as path from 'path';

// Image storage location - matches existing pattern
export const IMAGE_DIR = path.join(__dirname, '../../../../frontend/public/images/tasks');

// Category-specific prompt styles
export const CATEGORY_PROMPTS: Record<string, string> = {
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

/**
 * Ensure the image directory exists
 */
export function ensureImageDir(): void {
  if (!fs.existsSync(IMAGE_DIR)) {
    fs.mkdirSync(IMAGE_DIR, { recursive: true });
  }
}

/**
 * Get the full filesystem path for a task's image
 */
export function getImagePath(taskId: string): string {
  return path.join(IMAGE_DIR, `${taskId}.png`);
}

/**
 * Get the public URL path for a task's image
 */
export function getImageUrl(taskId: string): string {
  return `/images/tasks/${taskId}.png`;
}

/**
 * Check if an image already exists on disk
 */
export function imageExists(taskId: string): boolean {
  return fs.existsSync(getImagePath(taskId));
}

/**
 * Save image buffer to disk
 */
export function saveImage(taskId: string, buffer: Buffer): void {
  ensureImageDir();
  fs.writeFileSync(getImagePath(taskId), buffer);
}

/**
 * Generate a prompt for a given task
 */
export function getPromptForTask(task: any): string {
  const categoryName = task.category?.name || '综合联想';
  const categoryStyle = CATEGORY_PROMPTS[categoryName] || CATEGORY_PROMPTS['综合联想'];

  return `Generate a cover illustration for a puzzle task named "${task.name}". ${categoryStyle}. Task description: ${task.question.slice(0, 200)}. Style: clean modern digital art, fit for a card thumbnail (16:9 aspect ratio), dark theme compatible with a dark website. Do not add too much text, just the visual concept.`;
}
