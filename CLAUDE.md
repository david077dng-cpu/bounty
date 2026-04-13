# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Skill Bounty is a full-stack LLM agent skill learning platform themed as a Digimon training arena. Users learn agent development skills through progressive courses, complete interactive tasks in an "arena" with MCP (Model Context Protocol) tool calling support, and earn bounty points tracked on a leaderboard. The UI uses Digimon evolution metaphors (tiers: 幼年期 → 成长期 → 成熟期 → 究极体).

**Tech Stack:**
- Frontend: React 18 + TypeScript + Vite (port 5173)
- Backend: Node.js + Express + TypeScript (port 3001)
- Database: SQLite + Prisma ORM
- Authentication: JWT with httpOnly cookies
- LLM: ARK Volc Engine API (Doubao) for streaming completions
- MCP: Backend proxies JSON-RPC 2.0 requests to user-configured MCP servers

## Common Commands

```bash
# Install everything
npm run install:all

# Run both frontend and backend concurrently (from root)
npm run dev

# Run individually
cd backend && npm run dev     # Express on :3001
cd frontend && npm run dev    # Vite on :5173

# Database
cd backend
npx prisma generate           # After schema.prisma changes
npx prisma db push             # Push schema without migration
npx prisma migrate dev         # Create migration
npm run seed                   # Seed tasks/courses (or from root: npm run seed)
npx prisma studio              # GUI database browser

# Build
npm run build                  # Builds both (from root)
```

## Architecture

### Backend (`backend/src/`)

Express server entry at `index.ts`. All routes under `/api/`:

| Route module | Prefix | Purpose |
|---|---|---|
| `routes/auth.ts` | `/api/auth` | Register, login, logout, current user |
| `routes/tasks.ts` | `/api/tasks` | Task listing and details |
| `routes/submissions.ts` | `/api/submissions` | Submit answers, get user history |
| `routes/leaderboard.ts` | `/api/leaderboard` | Public leaderboard |
| `routes/courses.ts` | `/api/courses` | Progressive learning courses with lesson unlocking |
| `routes/mcp.ts` | `/api/mcp` | MCP connection CRUD, tool listing, tool calling |
| `routes/creation.ts` | `/api/creation` | User-created tasks (CRUD with ownership checks) |
| `routes/ark.ts` | `/api/ark` | ARK/Doubao LLM streaming completions (SSE) |

Auth middleware at `middleware/auth.ts`, JWT utils at `utils/jwt.ts`.

### Frontend (`frontend/src/`)

React Router SPA. Key pages:
- `Home` — Xiaohongshu-style waterfall card layout of tasks
- `Arena` (`/arena/:taskId`) — Interactive task execution with MCP panel, auto-execution demo, scoring visualization (4 dimensions), slash command popup
- `Courses` — Progressive courses grouped by difficulty tier with lesson unlocking
- `CreationCenter` — Users create/edit/delete their own tasks
- `Dashboard` — User dashboard
- `MCPConnections` — Manage MCP server connections

Shared state: `contexts/AuthContext.tsx` for auth. API client: `services/api.ts` (axios with credentials).

The Arena page has a **slash command system** (`utils/slashCommandRegistry.ts`) — typing `/` in the answer input shows a popup with navigation, template, and action commands.

### Data Flow

- **MCP Proxy**: Frontend → Backend (`/api/mcp/:id/call`) → User's MCP Server → Backend → Frontend. API keys stored server-side only.
- **ARK LLM**: Frontend → Backend (`/api/ark/completion`) → Volc Engine ARK API. Uses SSE streaming, piped directly to client.
- **Scoring**: Manual submissions scored against task's reference scores (`refAccuracy`, `refReasoning`, `refCreativity`, `refSpeed`) with small random variation. Grade: S/A/B/C/D.
- **Lesson Unlocking**: A lesson is unlocked if it has no `requiresLessonId` OR the required lesson has a `UserProgress` entry for the user.

## Environment Variables

Backend `.env`:
- `DATABASE_URL` — SQLite connection string
- `JWT_SECRET` — JWT signing secret
- `PORT` — Backend port (default: 3001)
- `CORS_ORIGIN` — Frontend origin (default: `http://localhost:5173`)
- `VOLC_ARK_API_KEY` — ARK API key for LLM completions
- `VOLC_ARK_MODEL_ID` — ARK model ID (default: `doubao-1.5-pro-256k`)
- `VOLC_ARK_BASE_URL` — ARK API base URL

## Development Guidelines

- All API endpoints return `{ success: boolean, data?: ..., error?: string }`
- When modifying Prisma schema, add inverse relation fields on both sides
- Task `steps` field is a JSON string of `[type, text]` tuples
- Task IDs are string codes (e.g., `M001`, `A001`), not auto-increment
- CSS uses CSS variables with a dark theme
- Frontend API base URL is hardcoded in `services/api.ts`
