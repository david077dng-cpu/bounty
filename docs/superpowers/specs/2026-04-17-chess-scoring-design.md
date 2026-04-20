# Chess Scoring System Design

## Overview

Add a Duolingo-inspired scoring mechanism to the chess feature: per-game XP (feeding into platform totalScore/tier), a separate ELO rating, and a daily play streak with XP multiplier.

## Data Model

Four new fields on the existing `User` model in Prisma:

| Field | Type | Default | Purpose |
|---|---|---|---|
| `chessElo` | Int | 1200 | ELO rating for chess |
| `chessStreak` | Int | 0 | Consecutive days played |
| `chessLastPlayedDate` | String? | null | "YYYY-MM-DD" of last game, null = never played |
| `chessXpTotal` | Int | 0 | Cumulative chess XP earned |

No new tables. No game history persistence.

## Constants

| Constant | Value |
|---|---|
| LLM assumed ELO | 1500 |
| K-factor | 32 |
| XP: win | 25 |
| XP: draw | 10 |
| XP: loss | 5 |
| Streak multiplier: 1-2 days | 1.0x |
| Streak multiplier: 3-4 days | 1.2x |
| Streak multiplier: 5-6 days | 1.5x |
| Streak multiplier: 7+ days | 2.0x |

## ELO Calculation

Standard ELO formula:

```
expected = 1 / (1 + 10^((opponentElo - playerElo) / 400))
newElo = playerElo + K * (score - expected)
```

Where `score` = 1 (win), 0.5 (draw), 0 (loss). Opponent ELO is fixed at 1500.

## Streak Logic

Compare `chessLastPlayedDate` to today's date (server-side, UTC):

- **null or older than yesterday** → reset streak to 1
- **yesterday** → increment streak by 1
- **today** → no change (already counted for today)

After calculation, set `chessLastPlayedDate` to today.

## API Endpoints

Both in `routes/chess.ts`, both require auth middleware.

### GET /api/chess/stats

Returns current chess stats for the authenticated user.

**Response:**
```json
{
  "success": true,
  "data": {
    "elo": 1200,
    "streak": 0,
    "xpTotal": 0,
    "lastPlayedDate": null
  }
}
```

### POST /api/chess/result

Processes a completed game result.

**Request body:**
```json
{ "result": "win" | "draw" | "loss" }
```

**Server logic:**
1. Read user's current chess fields
2. Calculate new streak from lastPlayedDate vs today
3. Determine streak multiplier
4. Calculate ELO change (K=32, opponent=1500)
5. Calculate XP = floor(baseXP * streakMultiplier)
6. Update user: chessElo, chessStreak, chessLastPlayedDate, chessXpTotal += XP, totalScore += XP
7. Recalculate tier if totalScore crossed threshold (2000/8000/12000)

**Response:**
```json
{
  "success": true,
  "data": {
    "eloChange": 18,
    "newElo": 1218,
    "xpEarned": 25,
    "streak": 1,
    "streakMultiplier": 1.0,
    "newTier": "幼年期"
  }
}
```

## Frontend Changes

All changes in `Chess.tsx` and `Chess.css`.

### Rating Panel (top of right info panel)

New `// CHESS RATING` section showing:
- **ELO** — displayed as a badge, e.g. "ELO 1218"
- **Streak** — flame icon + day count, e.g. "3-day streak". Hidden if streak is 0.
- **XP** — total chess XP

Loads via `GET /api/chess/stats` on component mount.

### Game-Over Result Display

When the game ends (checkmate, stalemate, draw, resign), the frontend:
1. Determines the result ("win", "draw", "loss") from the `gameStatus`
2. Calls `POST /api/chess/result`
3. Expands the game-over banner to show:
   - ELO change: green "+18" or red "-12" with animation
   - XP earned: "+25 XP (1.5x streak bonus)"
   - Updated streak count
4. Updates the rating panel with new values

### Resign Handling

Resign counts as a loss. Calls the result endpoint with `"loss"`.

## API Client

Add to `services/api.ts`:
- `chessApi.getStats()` → GET /api/chess/stats
- `chessApi.submitResult(result)` → POST /api/chess/result

## What This Does NOT Include

- No separate stats page
- No game history table or per-game persistence
- No chess leaderboard (uses existing platform leaderboard via totalScore)
- No ELO graph or historical tracking
