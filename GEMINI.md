# GEMINI.md - Skill Bounty (猎人竞技场)

## Project Overview
Skill Bounty is a comprehensive full-stack platform designed for learning and practicing LLM Agent skills. The project is themed as a "Digimon Training Arena" where users progress through tiers (Novice to Master/Ultimate) by completing reasoning tasks, following progressive courses, and utilizing the Model Context Protocol (MCP) to interact with external tools.

### Core Features
- **Progressive Learning:** Guided courses with lesson unlocking based on completion.
- **Interactive Arena:** A real-time environment for executing tasks, featuring streaming LLM responses (ARK/Doubao), reasoning visualizations, and scoring across four dimensions (Accuracy, Reasoning, Creativity, Speed).
- **MCP Integration:** A backend proxy for JSON-RPC 2.0 requests, allowing users to connect their own MCP servers and call tools directly within the arena.
- **Task Marketplace:** Browsing and creating tasks with categorized filtering and social features (likes, comments).
- **Gamification:** Leaderboards, bounty points, and user tiers based on performance.
- **Interactive Turn-based Tasks:** Support for dialogues, puzzles, and simulations with session state management.

### Tech Stack
- **Frontend:** React 18, TypeScript, Vite, Tailwind-like custom CSS (dark theme).
- **Backend:** Node.js, Express, TypeScript, WebSocket (for real-time interactions).
- **Database:** SQLite managed via Prisma ORM.
- **Auth:** JWT with `httpOnly` cookies.
- **AI Integrations:** 
    - **ARK (Doubao):** For streaming reasoning and completions.
    - **MCP:** Proxying tool calls to local or remote MCP servers.
    - **Gemini/Image APIs:** Used for generating task illustrations and assets.

---

## Building and Running

### Prerequisites
- Node.js (v18+)
- npm

### Initial Setup
```bash
# Install all dependencies (root, frontend, and backend)
npm run install:all

# Initialize database and seed initial data
npm run seed
```

### Development
```bash
# Run both frontend and backend concurrently
npm run dev

# Backend only (port 3001)
cd backend && npm run dev

# Frontend only (port 5173)
cd frontend && npm run dev
```

### Production Build
```bash
# Build both components
npm run build
```

---

## Development Conventions

### Code Structure
- **Root:** Workspace configuration and orchestration scripts.
- **`backend/`:** Express server, Prisma schema, and utility scripts for data generation.
- **`frontend/`:** React SPA with standard `components`, `pages`, `contexts`, and `services` structure.

### Coding Guidelines
- **API Responses:** Standardized format: `{ success: boolean, data?: any, error?: string }`.
- **Database:** Always update `backend/prisma/schema.prisma` for model changes and run `npx prisma generate` followed by `npx prisma db push` or migrations.
- **Task Definitions:** Steps are stored as JSON strings of `[type, text]` tuples (types: `step`, `think`, `calc`, `ok`, `warn`).
- **Styles:** Use the established dark theme CSS variables for consistency. Avoid introducing heavy UI libraries; prefer vanilla CSS or the existing patterns.

### Key Scripts
- `backend/prisma/seed.ts`: Seeds the initial 16 tasks and categories.
- `backend/scripts/`: Contains various utilities for SVG analysis, image generation, and database updates.
- `backend/src/websocket.ts`: Manages real-time communication for interactive tasks.

### Environment Variables (`backend/.env`)
- `DATABASE_URL`: `file:./dev.db`
- `JWT_SECRET`: Secret for signing tokens.
- `VOLC_ARK_API_KEY`: Required for LLM features.
- `VOLC_ARK_MODEL_ID`: Default `doubao-1.5-pro-256k`.
