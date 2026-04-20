# Chess Scoring System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Duolingo-style ELO + XP + daily streak scoring to the chess feature, displayed inline in the chess page's right panel.

**Architecture:** Four new fields on the User model (chessElo, chessStreak, chessLastPlayedDate, chessXpTotal). Two new endpoints in chess.ts (GET stats, POST result). Frontend loads stats on mount, submits result on game-over, and displays a rating section + animated result in the info panel.

**Tech Stack:** Prisma (SQLite), Express, React, TypeScript

---

### Task 1: Add chess fields to User model

**Files:**
- Modify: `backend/prisma/schema.prisma:10-29` (User model)

- [ ] **Step 1: Add four chess fields to User model**

In `backend/prisma/schema.prisma`, add these fields to the User model after the `tier` field (line 20) and before the `submissions` relation (line 22):

```prisma
  chessElo            Int       @default(1200)
  chessStreak         Int       @default(0)
  chessLastPlayedDate String?   // "YYYY-MM-DD", null = never played
  chessXpTotal        Int       @default(0)
```

- [ ] **Step 2: Push schema to database**

Run:
```bash
cd backend && npx prisma db push
```

Expected: "Your database is now in sync with your Prisma schema."

- [ ] **Step 3: Regenerate Prisma client**

Run:
```bash
cd backend && npx prisma generate
```

Expected: "Generated Prisma Client"

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/schema.prisma
git commit -m "feat(chess): add ELO, streak, XP fields to User model"
```

---

### Task 2: Add backend chess scoring endpoints

**Files:**
- Modify: `backend/src/routes/chess.ts`

- [ ] **Step 1: Add imports and constants**

At the top of `backend/src/routes/chess.ts`, add the Prisma import after the existing imports (after line 4):

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
```

Then add constants after the `getArkConfig` function (after line 14):

```typescript
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
  return new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"
}

function getYesterdayDateString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}
```

- [ ] **Step 2: Add GET /stats endpoint**

Add before the `export default router;` line at the bottom of `backend/src/routes/chess.ts`:

```typescript
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
```

- [ ] **Step 3: Add POST /result endpoint**

Add after the GET /stats route:

```typescript
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
```

- [ ] **Step 4: Verify backend compiles**

Run:
```bash
cd backend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/chess.ts
git commit -m "feat(chess): add /stats and /result scoring endpoints"
```

---

### Task 3: Add frontend API methods

**Files:**
- Modify: `frontend/src/services/api.ts:179-186` (chessApi object)

- [ ] **Step 1: Extend chessApi with stats and result methods**

In `frontend/src/services/api.ts`, replace the existing `chessApi` block (lines 180-186) with:

```typescript
export const chessApi = {
  getMove: (fen: string, history: string[]) =>
    api.post<{ success: boolean; data?: { move: string; thinking: string }; error?: string }>(
      '/chess/move',
      { fen, history }
    ),

  getStats: () =>
    api.get<{
      success: boolean;
      data: { elo: number; streak: number; xpTotal: number; lastPlayedDate: string | null };
      error?: string;
    }>('/chess/stats'),

  submitResult: (result: 'win' | 'draw' | 'loss') =>
    api.post<{
      success: boolean;
      data: {
        eloChange: number;
        newElo: number;
        xpEarned: number;
        streak: number;
        streakMultiplier: number;
        newTier: string;
      };
      error?: string;
    }>('/chess/result', { result }),
};
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/services/api.ts
git commit -m "feat(chess): add getStats and submitResult to chess API client"
```

---

### Task 4: Add chess rating UI to the chess page

**Files:**
- Modify: `frontend/src/pages/Chess.tsx`
- Modify: `frontend/src/styles/Chess.css`

- [ ] **Step 1: Add state and fetch logic to Chess.tsx**

In `frontend/src/pages/Chess.tsx`, add new state variables after the existing `useState` declarations (after line 77):

```typescript
  const [chessStats, setChessStats] = useState<{
    elo: number; streak: number; xpTotal: number;
  }>({ elo: 1200, streak: 0, xpTotal: 0 });
  const [gameResult, setGameResult] = useState<{
    eloChange: number; xpEarned: number; streak: number; streakMultiplier: number;
  } | null>(null);
  const [resultSubmitted, setResultSubmitted] = useState(false);
```

Add a useEffect to load stats on mount, after the auth redirect useEffect (after line 84):

```typescript
  useEffect(() => {
    if (user) {
      chessApi.getStats().then(res => {
        if (res.data.success && res.data.data) {
          const { elo, streak, xpTotal } = res.data.data;
          setChessStats({ elo, streak, xpTotal });
        }
      }).catch(() => {});
    }
  }, [user]);
```

- [ ] **Step 2: Add result submission logic**

Add a `submitGameResult` function after the `resign` callback (after line 258):

```typescript
  const submitGameResult = useCallback(async (result: 'win' | 'draw' | 'loss') => {
    if (resultSubmitted) return;
    setResultSubmitted(true);
    try {
      const res = await chessApi.submitResult(result);
      if (res.data.success && res.data.data) {
        const { eloChange, newElo, xpEarned, streak, streakMultiplier } = res.data.data;
        setGameResult({ eloChange, xpEarned, streak, streakMultiplier });
        setChessStats({ elo: newElo, streak, xpTotal: chessStats.xpTotal + xpEarned });
      }
    } catch {
      // Silently fail — game still works without scoring
    }
  }, [resultSubmitted, chessStats.xpTotal]);
```

- [ ] **Step 3: Trigger result submission on game end**

Add a useEffect that watches `gameStatus` to trigger result submission, after the `submitGameResult` function:

```typescript
  useEffect(() => {
    if (!isGameOver(gameStatus)) return;
    let result: 'win' | 'draw' | 'loss';
    if (gameStatus === 'checkmate-white') result = 'win';
    else if (gameStatus === 'checkmate-black') result = 'loss';
    else result = 'draw'; // stalemate or draw
    submitGameResult(result);
  }, [gameStatus, submitGameResult]);
```

- [ ] **Step 4: Reset result state in startNewGame**

In the `startNewGame` callback (around line 243), add these two lines at the end (before the closing `}, []`):

```typescript
    setGameResult(null);
    setResultSubmitted(false);
```

Also add `chessStats.xpTotal` to the dependency array of `submitGameResult` is already handled by the useCallback.

- [ ] **Step 5: Add rating panel JSX**

In the JSX, inside `chess-info-panel` div, add the rating section **before** the game-over banner (before the `{over && (` block, around line 329):

```tsx
          <div className="chess-rating-box">
            <div className="panel-label">// CHESS RATING</div>
            <div className="rating-stats">
              <div className="rating-stat">
                <span className="rating-stat-value">{chessStats.elo}</span>
                <span className="rating-stat-label">ELO</span>
              </div>
              {chessStats.streak > 0 && (
                <div className="rating-stat">
                  <span className="rating-stat-value streak-value">
                    {chessStats.streak}d
                  </span>
                  <span className="rating-stat-label">STREAK</span>
                </div>
              )}
              <div className="rating-stat">
                <span className="rating-stat-value">{chessStats.xpTotal}</span>
                <span className="rating-stat-label">XP</span>
              </div>
            </div>
          </div>
```

- [ ] **Step 6: Expand game-over banner with result details**

Replace the existing game-over banner block (the `{over && (` section, around lines 329-335) with:

```tsx
          {over && (
            <div className="chess-gameover-banner">
              <p className="gameover-title">{statusText(gameStatus, game.turn())}</p>
              {gameResult ? (
                <div className="gameover-result">
                  <span className={`elo-change ${gameResult.eloChange >= 0 ? 'elo-up' : 'elo-down'}`}>
                    {gameResult.eloChange >= 0 ? '+' : ''}{gameResult.eloChange} ELO
                  </span>
                  <span className="xp-earned">
                    +{gameResult.xpEarned} XP
                    {gameResult.streakMultiplier > 1 && (
                      <span className="streak-bonus"> ({gameResult.streakMultiplier}x streak)</span>
                    )}
                  </span>
                  {gameResult.streak > 0 && (
                    <span className="streak-info">{gameResult.streak}-day streak</span>
                  )}
                </div>
              ) : (
                <p className="gameover-sub">Click "New Game" to play again</p>
              )}
            </div>
          )}
```

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/Chess.tsx
git commit -m "feat(chess): add rating panel and game-over result display"
```

---

### Task 5: Add CSS for chess rating UI

**Files:**
- Modify: `frontend/src/styles/Chess.css`

- [ ] **Step 1: Add rating box and game-over result styles**

Add the following CSS at the end of `frontend/src/styles/Chess.css`, before the responsive media queries section (before the `@media (max-width: 860px)` line):

```css
/* ─── Rating Panel ──────────────────────────── */

.chess-rating-box {
  background: var(--bg2);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 16px 20px;
}

.rating-stats {
  display: flex;
  gap: 24px;
}

.rating-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.rating-stat-value {
  font-family: var(--mono);
  font-size: 20px;
  font-weight: 700;
  color: var(--text);
}

.streak-value {
  color: var(--gold);
}

.rating-stat-label {
  font-family: var(--mono);
  font-size: 10px;
  color: var(--muted);
  letter-spacing: 1.5px;
}

/* ─── Game-over result ──────────────────────── */

.gameover-result {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  animation: floatUp 0.4s ease-out;
}

.elo-change {
  font-family: var(--mono);
  font-size: 22px;
  font-weight: 700;
}

.elo-up {
  color: var(--cyan);
}

.elo-down {
  color: var(--red);
}

.xp-earned {
  font-family: var(--mono);
  font-size: 14px;
  color: var(--gold);
  font-weight: 600;
}

.streak-bonus {
  font-size: 12px;
  color: var(--muted);
  font-weight: 400;
}

.streak-info {
  font-family: var(--mono);
  font-size: 12px;
  color: var(--muted);
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/styles/Chess.css
git commit -m "feat(chess): add rating panel and result display CSS"
```

---

### Task 6: Verify end-to-end

- [ ] **Step 1: Start the dev servers**

Run:
```bash
cd /Users/bobinding/Documents/code/skill/bounty && npm run dev
```

- [ ] **Step 2: Manual test checklist**

1. Open chess page — rating panel shows ELO 1200, no streak, 0 XP
2. Play a game to completion (or resign)
3. Game-over banner shows ELO change, XP earned
4. Rating panel updates with new values
5. Start new game — result clears, rating persists
6. Play again on the same day — streak should stay at 1 (no increment for same day)

- [ ] **Step 3: Final commit if any fixups needed**
