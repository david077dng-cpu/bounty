import express from 'express';
import { PrismaClient } from '@prisma/client';
import { getImageProvider } from '../utils/imageProviders';
import { imageExists, getImageUrl, saveImage, getPromptForTask, ensureImageDir } from '../utils/imageGeneration';

const router = express.Router();
const prisma = new PrismaClient();

// Track in-flight generation to prevent concurrent requests for same task
const inFlight = new Set<string>();

// Ensure image directory exists on startup
ensureImageDir();

/**
 * GET /api/tasks/:id/image
 *
 * Returns the image URL for a task, generating it on-demand if needed.
 * Supports all task categories (mystery-only restriction removed).
 *
 * Response format:
 * {
 *   success: boolean;
 *   data?: {
 *     imageUrl: string;  // /images/tasks/{id}.png
 *     exists: boolean;   // true = already on disk, false = just generated
 *   };
 *   error?: string;
 * }
 */
router.get('/tasks/:id/image', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if image already exists on disk - fast path
    if (imageExists(id)) {
      return res.json({
        success: true,
        data: {
          imageUrl: getImageUrl(id),
          exists: true,
        },
      });
    }

    // Fetch task to build generation prompt
    const task = await prisma.task.findUnique({
      where: { id },
      include: { category: { select: { name: true } } },
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
      });
    }

    // Check if generation is already in progress for this task
    if (inFlight.has(id)) {
      return res.json({
        success: false,
        error: 'Image generation in progress',
      });
    }

    // Get configured image provider
    const provider = getImageProvider();
    if (!provider) {
      console.warn('[task-image] No image provider configured');
      return res.json({
        success: false,
        error: 'Image generation not configured',
      });
    }

    // Mark as in-flight
    inFlight.add(id);

    try {
      // Generate image using configured provider
      const prompt = getPromptForTask(task);
      console.log(`[task-image] Generating image for task ${id} using ${provider.getType()}`);

      const imageBuffer = await provider.generateImage(prompt);
      saveImage(id, imageBuffer);

      console.log(`[task-image] Successfully generated image for task ${id}`);

      return res.json({
        success: true,
        data: {
          imageUrl: getImageUrl(id),
          exists: true,
        },
      });

    } catch (err: any) {
      console.error(`[task-image] Generation failed for task ${id}:`, err.message);
      return res.json({
        success: false,
        error: `Image generation failed: ${err.message}`,
      });
    } finally {
      inFlight.delete(id);
    }

  } catch (error: any) {
    console.error('[task-image] Route error:', error);
    res.status(500).json({
      success: false,
      error: `Server error: ${error.message}`,
    });
  }
});

export default router;
