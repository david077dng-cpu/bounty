import express from 'express';
import axios from 'axios';
import { Chess } from 'chess.js';
import { authMiddleware } from '../middleware/auth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const router = express.Router();

function getArkConfig() {
  return {
    baseUrl: process.env.VOLC_ARK_BASE_URL || 'https://ark.cn-beijing.volces.com/api/coding/v3',
    apiKey: process.env.VOLC_ARK_API_KEY,
    modelId: process.env.VOLC_ARK_MODEL_ID || 'doubao-1.5-pro-256k',
  };
}

// Chess scoring constants
const LLM_ELO = 1500;
const K_FACTOR = 32;
const XP_WIN = 25;
const XP_DRAW = 10;
const XP_LOSS = 5;

function getStreakMultiplier(streak: number): number {
  if (streak >= 7) return 2.0;
  if (streak >= 5) return 1.5;
  if (streak >= 3) return 1.2;
  return 1.0;
}

function calculateEloChange(playerElo: number, opponentElo: number, score: number): number {
  const expected = 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
  return Math.round(K_FACTOR * (score - expected));
}

function calculateTier(totalScore: number): string {
  if (totalScore > 12000) return '究极体';
  if (totalScore > 8000) return '成熟期';
  if (totalScore > 2000) return '成长期';
  return '幼年期';
}

function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

function getYesterdayDateString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

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
  const { baseUrl, apiKey, modelId } = getArkConfig();
  const response = await axios.post(
    `${baseUrl}/chat/completions`,
    {
      model: modelId,
      messages,
      stream: false,
      max_tokens: 300,
      temperature: 0.3,
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
      proxy: false,
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

    if (!getArkConfig().apiKey) {
      return res.status(500).json({ success: false, error: 'ARK API key not configured' });
    }

    const { move, thinking } = await getValidatedLLMMove(fen, Array.isArray(history) ? history : []);

    return res.json({ success: true, data: { move, thinking } });
  } catch (error: any) {
    console.error('Chess move error:', error);
    return res.status(500).json({ success: false, error: 'Failed to get LLM move' });
  }
});

router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { chessElo: true, chessStreak: true, chessXpTotal: true, chessLastPlayedDate: true },
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    return res.json({
      success: true,
      data: {
        elo: user.chessElo,
        streak: user.chessStreak,
        xpTotal: user.chessXpTotal,
        lastPlayedDate: user.chessLastPlayedDate,
      },
    });
  } catch (error) {
    console.error('Chess stats error:', error);
    return res.status(500).json({ success: false, error: 'Failed to get chess stats' });
  }
});

router.post('/result', authMiddleware, async (req, res) => {
  try {
    const { result } = req.body;

    if (!['win', 'draw', 'loss'].includes(result)) {
      return res.status(400).json({ success: false, error: 'result must be "win", "draw", or "loss"' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: {
        chessElo: true,
        chessStreak: true,
        chessLastPlayedDate: true,
        chessXpTotal: true,
        totalScore: true,
      },
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Calculate streak
    const today = getTodayDateString();
    const yesterday = getYesterdayDateString();
    let newStreak = user.chessStreak;

    if (user.chessLastPlayedDate === today) {
      // Already played today — no streak change
    } else if (user.chessLastPlayedDate === yesterday) {
      newStreak += 1;
    } else {
      newStreak = 1;
    }

    const streakMultiplier = getStreakMultiplier(newStreak);

    // Calculate ELO
    const score = result === 'win' ? 1 : result === 'draw' ? 0.5 : 0;
    const eloChange = calculateEloChange(user.chessElo, LLM_ELO, score);
    const newElo = Math.max(0, user.chessElo + eloChange);

    // Calculate XP
    const baseXp = result === 'win' ? XP_WIN : result === 'draw' ? XP_DRAW : XP_LOSS;
    const xpEarned = Math.floor(baseXp * streakMultiplier);

    // Update user
    const newTotalScore = user.totalScore + xpEarned;
    const newTier = calculateTier(newTotalScore);

    await prisma.user.update({
      where: { id: req.userId! },
      data: {
        chessElo: newElo,
        chessStreak: newStreak,
        chessLastPlayedDate: today,
        chessXpTotal: user.chessXpTotal + xpEarned,
        totalScore: newTotalScore,
        tier: newTier,
      },
    });

    return res.json({
      success: true,
      data: {
        eloChange,
        newElo,
        xpEarned,
        streak: newStreak,
        streakMultiplier,
        newTier,
      },
    });
  } catch (error) {
    console.error('Chess result error:', error);
    return res.status(500).json({ success: false, error: 'Failed to process chess result' });
  }
});

export default router;
