import express from 'express';
import { authMiddleware } from '../middleware/auth';
import axios from 'axios';

const router = express.Router();

// ARK Volc Engine API endpoint
const ARK_BASE_URL = process.env.VOLC_ARK_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3';
const ARK_API_KEY = process.env.VOLC_ARK_API_KEY;
const ARK_MODEL_ID = process.env.VOLC_ARK_MODEL_ID;

// Stream completion from ARK
router.post('/completion', authMiddleware, async (req, res) => {
  try {
    const { messages, modelId } = req.body;

    if (!ARK_API_KEY) {
      return res.status(500).json({
        error: 'ARK API key not configured. Please set VOLC_ARK_API_KEY in .env'
      });
    }

    const actualModelId = modelId || ARK_MODEL_ID || 'doubao-1.5-pro-256k';

    // Set SSE headers for streaming
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    try {
      const response = await axios.post(
        `${ARK_BASE_URL}/chat/completions`,
        {
          model: actualModelId,
          messages,
          stream: true,
        },
        {
          headers: {
            'Authorization': `Bearer ${ARK_API_KEY}`,
            'Content-Type': 'application/json',
          },
          responseType: 'stream',
          timeout: 120000, // 2 minutes
        }
      );

      // Pipe the stream directly to client
      response.data.pipe(res);

      response.data.on('end', () => {
        res.end();
      });

      response.data.on('error', (err: any) => {
        console.error('ARK stream error:', err);
        res.end();
      });

    } catch (error: any) {
      console.error('ARK API error:', error);
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }

  } catch (error) {
    console.error('ARK completion error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Check if ARK is configured
router.get('/status', authMiddleware, async (req, res) => {
  try {
    res.json({
      success: true,
      configured: !!ARK_API_KEY,
      modelId: ARK_MODEL_ID || 'default',
      endpoint: ARK_BASE_URL,
    });
  } catch (error) {
    console.error('ARK status error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
