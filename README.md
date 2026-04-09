# Bounty - Skill Bounty 猎人竞技场

🎯 **Skill Bounty** 是一个全栈 LLM Agent 技能学习平台，让用户通过渐进式课程学习 Agent 开发技能，在 "竞技场" 中完成交互式任务，并通过 MCP (Model Context Protocol) 工具调用获得赏金积分。

## Features

- 👤 User registration and authentication (JWT + httpOnly cookies)
- 📚 **Progressive Learning Courses** - Learn agent development step-by-step with guided lessons
- 🔌 **MCP Integration** - Connect to your own MCP servers and call tools directly in the arena
- 📋 Browse tasks by category, option to hide completed tasks
- ⚔️ Interactive arena with animated reasoning demonstration
- ✍️ Manual answer submission with automatic scoring
- 💰 Earn bounty points for completed tasks
- 📊 Public leaderboard showing top hunters
- 📝 Personal completion history
- 🎨 Original dark theme design preserved

## Categories

- 🔍 悬疑推理 (Mystery deduction)
- 🧩 综合联想 (Association & analogy)
- 💻 代码能力 (Coding & algorithms)
- 🔢 数学基础 (Mathematics)
- 🔬 自然科学 (Natural science)
- 🧠 逻辑能力 (Logic puzzles)

## Tech Stack

- **Backend**: Node.js + Express + TypeScript
- **Frontend**: React 18 + TypeScript + Vite
- **Database**: SQLite with Prisma ORM
- **Authentication**: JWT with httpOnly cookies
- **MCP**: JSON-RPC 2.0 proxy for Model Context Protocol

## Setup Instructions

### 1. Install dependencies

```bash
npm run install:all
```

### 2. Create database and seed data

This will automatically seed the 16 tasks from the original static HTML:

```bash
npm run seed
```

### 3. Start development servers

```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

## Project Structure

```
.
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma     # Database schema
│   │   └── seed.ts           # Seeds tasks from original HTML
│   └── src/
│       ├── index.ts          # Express server entry
│       ├── middleware/
│       │   └── auth.ts       # JWT auth middleware
│       ├── routes/
│       │   ├── auth.ts       # Auth routes
│       │   ├── tasks.ts      # Tasks routes
│       │   ├── submissions.ts # Submissions routes
│       │   ├── leaderboard.ts # Leaderboard routes
│       │   ├── courses.ts    # Progressive courses API
│       │   └── mcp.ts        # MCP connection management & tool calling
│       ├── utils/
│       │   └── jwt.ts        # JWT utilities
│       └── types.ts          # Type definitions
└── frontend/
    ├── src/
    │   ├── main.tsx          # React entry
    │   ├── App.tsx           # Root component with routing
    │   ├── components/
    │   │   ├── Header.tsx    # Navigation header
    │   │   └── TaskCard.tsx  # Task card component
    │   ├── pages/
    │   │   ├── Home.tsx      # Task list
    │   │   ├── Login.tsx     # Login page
    │   │   ├── Register.tsx  # Registration page
    │   │   ├── Arena.tsx     # Interactive task execution with MCP panel
    │   │   ├── Courses.tsx   # Progressive learning courses
    │   │   ├── MCPConnections.tsx # MCP connection management
    │   │   ├── Leaderboard.tsx # Leaderboard
    │   │   └── History.tsx   # User submission history
    │   ├── contexts/
    │   │   └── AuthContext.tsx # Auth state management
    │   ├── services/
    │   │   └── api.ts        # API client
    │   ├── styles/           # CSS files
    │   └── types.ts          # TypeScript types
    └── vite.config.ts
```

## API Endpoints

| Method | Endpoint             | Description | Auth |
|--------|----------------------|-------------|------|
| POST   | `/api/auth/register` | Register user | No |
| POST   | `/api/auth/login`    | Login user | No |
| POST   | `/api/auth/logout`   | Logout user | Yes |
| GET    | `/api/auth/me`       | Get current user | Yes |
| GET    | `/api/tasks`         | List tasks | No |
| GET    | `/api/tasks/:id`     | Get task details | No |
| POST   | `/api/submissions`   | Submit task | Yes |
| GET    | `/api/submissions/my`| Get user submissions | Yes |
| GET    | `/api/leaderboard`   | Get public leaderboard | No |
| GET    | `/api/courses`       | List all courses | Yes |
| GET    | `/api/courses/:id`   | Get course details | Yes |
| GET    | `/api/mcp`           | List user MCP connections | Yes |
| POST   | `/api/mcp`           | Create MCP connection | Yes |
| POST   | `/api/mcp/:id/test`  | Test MCP connection & list tools | Yes |
| POST   | `/api/mcp/:id/call`  | Call MCP tool | Yes |
| DELETE | `/api/mcp/:id`       | Delete MCP connection | Yes |

## User Tiers

- 见习猎人 (0-2000 points)
- 高级猎人 (2000-8000 points)
- 精英猎人 (8000-12000 points)
- 传奇猎人 (12000+ points)

## Scoring

Each task is scored on four dimensions:
- Accuracy - Correctness of the answer
- Reasoning - Quality of logical reasoning
- Creativity - Depth of creative insight
- Speed - Thinking efficiency

Final score is the average of the four dimensions. Bounty points are awarded based on task difficulty.

## License

MIT
