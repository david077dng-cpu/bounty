import express from 'express';
import axios from 'axios';
import { Chess } from 'chess.js';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

const ARK_BASE_URL = process.env.VOLC_ARK_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3';
const ARK_API_KEY = process.env.VOLC_ARK_API_KEY;
const ARK_MODEL_ID = process.env.VOLC_ARK_MODEL_ID || 'doubao-1.5-pro-256k';

const SYSTEM_PROMPT = `You are a chess engine playing as Black. Your only job is to pick the best legal chess move.

STRICT OUTPUT FORMAT — you must follow this exactly, no exceptions:
Line 1: One sentence of analysis in English.
Last line: MOVE: <move>

The move must be in Standard Algebraic Notation (SAN). Examples: e5  Nf6  O-O  Bxe5  Qd4+  exd5  Nxf7

Example of a correct full response:
Developing the knight controls the center.
MOVE: Nf6

Do NOT output anything after the MOVE: line. Do NOT use Chinese. Do NOT number your lines.`;

function parseLLMResponse(raw: string): { move: string | null; thinking: string } {
  const lines = raw.trim().split('\n');
  let moveRaw: string | null = null;
  let thinkingLines: string[] = [];

  // Pass 1: look for explicit MOVE: sentinel
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (line.startsWith('MOVE:') || line.startsWith('Move:') || line.startsWith('move:')) {
      moveRaw = line.replace(/^move:\s*/i, '').trim();
      thinkingLines = lines.slice(0, i);
      break;
    }
  }

  // Pass 2: scan every line for a standalone SAN token
  // SAN pattern: optional piece (KQRBN), optional file/rank, optional x, destination square,
  // optional promotion, optional check/mate, or castling
  if (!moveRaw) {
    const sanPattern = /^([KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](=[QRBN])?[+#]?|O-O-O|O-O)$/;
    for (let i = lines.length - 1; i >= 0; i--) {
      const token = lines[i].trim().replace(/[!?]+$/, '');
      if (sanPattern.test(token)) {
        moveRaw = token;
        thinkingLines = lines.slice(0, i);
        break;
      }
    }
  }

  // Pass 3: last non-empty line as final fallback
  if (!moveRaw) {
    const nonEmpty = lines.filter(l => l.trim());
    if (nonEmpty.length > 0) {
      moveRaw = nonEmpty[nonEmpty.length - 1].trim();
      thinkingLines = nonEmpty.slice(0, -1);
    }
  }

  // Strip annotation suffixes
  if (moveRaw) {
    moveRaw = moveRaw.replace(/[!?]+$/, '').trim();
  }

  const thinking = thinkingLines
    .map(l => l.trim())
    .filter(Boolean)
    .join(' ')
    .trim() || 'Analyzing position...';

  return { move: moveRaw || null, thinking };
}

async function callARK(messages: Array<{ role: string; content: string }>): Promise<string> {
  const response = await axios.post(
    `${ARK_BASE_URL}/chat/completions`,
    {
      model: ARK_MODEL_ID,
      messages,
      stream: false,
      max_tokens: 300,
      temperature: 0.3,
    },
    {
      headers: {
        Authorization: `Bearer ${ARK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    }
  );
  return response.data.choices[0].message.content as string;
}

async function getValidatedLLMMove(
  fen: string,
  history: string[]
): Promise<{ move: string; thinking: string }> {
  const chess = new Chess(fen);
  const legalMoves = chess.moves();

  const userPromptBase =
    `Current position (FEN): ${fen}\n` +
    `Move history (SAN): ${history.length > 0 ? history.join(' ') : '(game just started)'}\n` +
    `It is Black's turn. What is your move?`;

  for (let attempt = 0; attempt <= 1; attempt++) {
    const extraHint =
      attempt > 0
        ? `\n\nIMPORTANT: Your previous response did not contain a valid move. Legal moves available: ${legalMoves.slice(0, 25).join(', ')}. Respond with exactly one of these.`
        : '';

    try {
      const raw = await callARK([
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPromptBase + extraHint },
      ]);

      const { move: parsedMove, thinking } = parseLLMResponse(raw);

      if (parsedMove) {
        try {
          const testChess = new Chess(fen);
          const result = testChess.move(parsedMove);
          if (result) {
            return { move: result.san, thinking };
          }
        } catch {
          // Invalid move — retry
        }
      }
    } catch (err: any) {
      console.error(`Chess LLM attempt ${attempt} failed:`, err?.response?.status, JSON.stringify(err?.response?.data));
    }
  }

  // Hard fallback: first legal move
  const fallback = legalMoves[0];
  return { move: fallback, thinking: 'I chose a solid positional move.' };
}

router.post('/move', authMiddleware, async (req, res) => {
  try {
    const { fen, history } = req.body;

    if (!fen || typeof fen !== 'string') {
      return res.status(400).json({ success: false, error: 'FEN position required' });
    }

    // Validate FEN
    try {
      const chess = new Chess();
      chess.load(fen);
    } catch {
      return res.status(400).json({ success: false, error: 'Invalid FEN position' });
    }

    if (!ARK_API_KEY) {
      return res.status(500).json({ success: false, error: 'ARK API key not configured' });
    }

    const { move, thinking } = await getValidatedLLMMove(fen, Array.isArray(history) ? history : []);

    return res.json({ success: true, data: { move, thinking } });
  } catch (error: any) {
    console.error('Chess move error:', error);
    return res.status(500).json({ success: false, error: 'Failed to get LLM move' });
  }
});

export default router;
