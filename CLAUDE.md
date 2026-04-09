# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Skill Bounty is a full-stack LLM agent skill learning platform. Users can learn agent development skills through progressive courses (like Duolingo), complete interactive tasks in an "arena" with built-in MCP (Model Context Protocol) tool calling support, and earn bounty points that are tracked on a leaderboard.

**Tech Stack:**
- Frontend: React 18 + TypeScript + Vite
- Backend: Node.js + Express + TypeScript
- Database: SQLite + Prisma ORM
- Authentication: JWT with httpOnly cookies
- MCP: Backend proxies JSON-RPC 2.0 requests to user-configured MCP servers

## Project Structure

```
├── backend/
│   ├── prisma/
│   │   └── schema.prisma          # Database schema
│   ├── src/
│   │   ├── routes/                # API routes
│   │   │   ├── auth.ts           # Authentication (login/register)
│   │   │   ├── tasks.ts          # Task listing and details
│   │   │   ├── submissions.ts    # Submit answers for scoring
│   │   │   ├── leaderboard.ts    # Public leaderboard
│   │   │   ├── courses.ts        # Progressive courses API
│   │   │   └── mcp.ts            # MCP connection management & tool calling
│   │   ├── types.ts              # TypeScript type definitions
│   │   └── index.ts              # Entry point
│   └── package.json
└── frontend/
    ├── src/
    │   ├── components/           # React components
    │   │   └── Header.tsx        # Navigation header
    │   ├── contexts/             # React contexts
    │   │   └── AuthContext.tsx   # Authentication context
    │   ├── pages/                # Page components
    │   │   ├── Home.tsx          # Task listing home
    │   │   ├── Arena.tsx         # Interactive task arena with MCP panel
    │   │   ├── Courses.tsx       # Progressive learning courses
    │   │   ├── MCPConnections.tsx # MCP connection management
    │   │   ├── Leaderboard.tsx
    │   │   ├── History.tsx       # User submission history
    │   │   ├── Login.tsx
    │   │   └── Register.tsx
    │   ├── services/
    │   │   └── api.ts            # API client for all endpoints
    │   ├── types.ts              # TypeScript type definitions
    │   └── styles/               # CSS files
    └── package.json
```

## Key Features

1. **Progressive Learning System**
   - Courses grouped by difficulty tiers: Beginner → Intermediate → Advanced
   - Lessons within courses have progressive unlocking (requires previous completion)
   - User progress tracked per lesson in `UserProgress` table
   - Each lesson links to a task in the arena

2. **MCP (Model Context Protocol) Integration**
   - Users can add and save their own MCP server connections
   - MCP panel embedded directly in the Arena page
   - Select connection → fetch available tools → call tool with JSON arguments → insert result into answer
   - Backend proxies all requests following JSON-RPC 2.0 protocol

3. **Interactive Arena**
   - Animated "auto-execution" demo mode shows reasoning steps
   - Manual answer submission with automatic scoring
   - Real-time score visualization across 4 dimensions: accuracy, reasoning, creativity, speed
   - Bounty points awarded based on final grade

4. **Bounty & Leaderboard**
   - Users earn bounty points for completed tasks
   - Global leaderboard shows top hunters by total bounty
   - Tier progression: 见习猎人 → 高级猎人 → 精英猎人 → 传奇猎人

## Common Commands

### Backend
```bash
cd backend

# Install dependencies
npm install

# Generate Prisma client after schema changes
npx prisma generate

# Run migrations (after schema changes)
npx prisma migrate dev

# Push schema to database without migration
npx prisma db push

# Seed the database with initial tasks/courses
npm run seed

# Start dev server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

### Frontend
```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build
```

### Database
```bash
# View database with Prisma Studio
cd backend && npx prisma studio
```

## Database Models

**Core Existing Models:**
- `User` - User accounts with total score, bounty, tier
- `Category` - Task categories
- `Task` - Individual bounty tasks with reference scores for evaluation
- `Submission` - User submissions with scores

**New Learning Platform Models:**
- `Course` - Collection of lessons, grouped by difficulty
- `Lesson` - Single lesson within a course, links to a Task, can require previous lesson
- `UserProgress` - Tracks which lessons each user has completed
- `MCPConnection` - Stores user's MCP server connections (API key never sent to frontend)

## Important Implementation Details

- **MCP Proxy Flow**: Frontend → Backend → User's MCP Server → Backend → Frontend. Backend handles JSON-RPC formatting and error handling.
- **Lesson Unlocking Logic**: A lesson is unlocked if:
  1. It has no `requiresLessonId` requirement, OR
  2. The required lesson has been completed by the user
- **Scoring**: For manual submissions, scores are based on the task's reference scores with small random variation.
- **Security**: JWT stored in httpOnly cookie, API keys for MCP connections are never sent to the frontend.

## Development Guidelines

- When adding new fields to the Prisma schema, always add the required inverse relation fields on both sides
- MCP tool call arguments must be valid JSON - the frontend provides a JSON editor with syntax checking
- All new API endpoints follow the response format: `{ success: boolean, data?: ..., error?: string }`
- CSS styling uses CSS variables with a dark theme
