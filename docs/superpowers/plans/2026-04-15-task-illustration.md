# Task Illustration Generation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Use the ARK LLM to generate SVG explanatory illustrations for each task, lazy-generated on first access and cached in the DB, shown as thumbnails on task cards and full-size in the Arena.

**Architecture:** A new `GET /api/tasks/:id/illustration` backend route checks the DB cache, calls ARK non-streaming if empty, validates the SVG, persists it, and returns it. The frontend `IllustrationPanel` component fetches on mount and renders the SVG inline; `TaskCard` scales it down as a thumbnail.

**Tech Stack:** Express + Prisma (SQLite), React 18 + TypeScript, ARK Volc Engine chat/completions API (non-streaming)

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `backend/prisma/schema.prisma` | Add `illustration String?` to Task |
| Create | `backend/src/routes/illustration.ts` | Cache-or-generate SVG endpoint |
| Modify | `backend/src/index.ts` | Register illustration route |
| Modify | `frontend/src/services/api.ts` | Add `illustrationApi.get()` |
| Create | `frontend/src/components/IllustrationPanel.tsx` | Fetch + render SVG |
| Create | `frontend/src/styles/IllustrationPanel.css` | Panel + thumbnail styles |
| Modify | `frontend/src/pages/Arena.tsx` | Insert full-size panel below question-box |
| Modify | `frontend/src/components/TaskCard.tsx` | Add scaled thumbnail |

---

## Task 1: Add `illustration` field to Prisma schema

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Add the field**

  In `backend/prisma/schema.prisma`, add `illustration String?` to the `Task` model after the `steps` field:

  ```prisma
  model Task {
    id          String  @id
    name        String
    tier        String
    bounty      Int
    categoryId  Int
    category    Category @relation(fields: [categoryId], references: [id], onDelete: Cascade)
    catIcon     String
    question    String
    hint        String?
    answer      String
    refAccuracy    Int
    refReasoning   Int
    refCreativity  Int
    refSpeed       Int
    steps         String
    illustration  String?   // Generated SVG; null = not yet generated
    authorId    Int?
    author      User?    @relation(fields: [authorId], references: [id], onDelete: Cascade)
    isPublic    Boolean  @default(true)
    createdAt   DateTime @default(now())
    updatedAt   DateTime @updatedAt

    submissions Submission[]
    lessons     Lesson[]
    likes         Like[]
    comments      Comment[]
  }
  ```

- [ ] **Step 2: Push schema to DB and regenerate client**

  ```bash
  cd backend && npx prisma db push && npx prisma generate
  ```

  Expected output: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 3: Commit**

  ```bash
  cd backend
  git add prisma/schema.prisma
  git commit -m "feat: add illustration field to Task model"
  ```

---

## Task 2: Create the illustration backend route

**Files:**
- Create: `backend/src/routes/illustration.ts`

- [ ] **Step 1: Create the file**

  ```typescript
  import express from 'express';
  import { PrismaClient } from '@prisma/client';
  import axios from 'axios';

  const router = express.Router();
  const prisma = new PrismaClient();

  const ARK_BASE_URL = process.env.VOLC_ARK_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3';
  const ARK_API_KEY = process.env.VOLC_ARK_API_KEY;
  const ARK_MODEL_ID = process.env.VOLC_ARK_MODEL_ID || 'doubao-1.5-pro-256k';

  const STYLE_MAP: Record<string, string> = {
    M: '案发现场平面图或时间线图',
    A: '概念关系网络图',
    L: '命题关系图或真值表',
    N: '公式推导流程图',
    C: '算法流程图',
    S: '概念示意图',
    E: '博弈矩阵或策略树',
  };

  function buildSystemPrompt(taskId: string): string {
    const prefix = taskId[0].toUpperCase();
    const style = STYLE_MAP[prefix] ?? '概念示意图';
    return `你是一个SVG图示专家。根据任务描述生成一张解释性插图。

要求：
- 只输出纯SVG代码，不要markdown代码块，不要任何解释文字
- 开头必须是 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400" width="600" height="400">
- 深色背景 (#1a1a2e)，使用浅色文字和高对比度线条
- 图示风格：${style}
- 保持简洁，突出核心概念，不要堆砌细节`;
  }

  // GET /api/tasks/:id/illustration — public, no auth required
  router.get('/tasks/:id/illustration', async (req, res) => {
    try {
      const { id } = req.params;

      const task = await prisma.task.findUnique({
        where: { id },
        include: { category: { select: { name: true } } },
      });

      if (!task) {
        return res.status(404).json({ success: false, error: 'Task not found' });
      }

      // Return cached illustration
      if (task.illustration) {
        return res.json({ success: true, data: { svg: task.illustration } });
      }

      // No ARK key configured
      if (!ARK_API_KEY) {
        console.warn('[illustration] VOLC_ARK_API_KEY not set');
        return res.json({ success: true, data: { svg: null } });
      }

      // Generate via ARK
      const systemPrompt = buildSystemPrompt(task.id);
      const userPrompt = `任务名：${task.name}\n类别：${task.category.name}\n描述：${task.question}`;

      let svgContent: string | null = null;

      try {
        const response = await axios.post(
          `${ARK_BASE_URL}/chat/completions`,
          {
            model: ARK_MODEL_ID,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            stream: false,
          },
          {
            headers: {
              Authorization: `Bearer ${ARK_API_KEY}`,
              'Content-Type': 'application/json',
            },
            timeout: 30000,
          }
        );

        const raw: string = response.data?.choices?.[0]?.message?.content ?? '';
        const trimmed = raw.trim();

        if (trimmed.toLowerCase().startsWith('<svg')) {
          svgContent = trimmed;
          // Cache in DB
          await prisma.task.update({
            where: { id: task.id },
            data: { illustration: svgContent },
          });
        } else {
          console.warn(`[illustration] Non-SVG response for task ${id}:`, trimmed.slice(0, 100));
        }
      } catch (err: any) {
        console.error(`[illustration] ARK call failed for task ${id}:`, err.message);
      }

      return res.json({ success: true, data: { svg: svgContent } });
    } catch (error) {
      console.error('[illustration] Route error:', error);
      res.status(500).json({ success: false, error: 'Server error' });
    }
  });

  export default router;
  ```

- [ ] **Step 2: Verify TypeScript compiles**

  ```bash
  cd backend && npx tsc --noEmit
  ```

  Expected: no errors

- [ ] **Step 3: Commit**

  ```bash
  git add backend/src/routes/illustration.ts
  git commit -m "feat: add illustration route with ARK SVG generation and DB caching"
  ```

---

## Task 3: Register the illustration route

**Files:**
- Modify: `backend/src/index.ts`

- [ ] **Step 1: Import and mount**

  Add the import after the existing route imports:

  ```typescript
  import illustrationRoutes from './routes/illustration';
  ```

  Add the mount after `app.use('/api/social', socialRoutes);`:

  ```typescript
  app.use('/api', illustrationRoutes);
  ```

- [ ] **Step 2: Verify the server starts**

  ```bash
  cd backend && npm run dev
  ```

  Expected: `🚀 Server running on http://localhost:3001`

- [ ] **Step 3: Smoke-test the endpoint**

  With the server running, in a separate terminal:

  ```bash
  curl -s http://localhost:3001/api/tasks/M001/illustration | python3 -m json.tool
  ```

  Expected: `{ "success": true, "data": { "svg": "<svg..." } }` (or `{ "svg": null }` if ARK key not set)

- [ ] **Step 4: Commit**

  ```bash
  git add backend/src/index.ts
  git commit -m "feat: register illustration route in Express app"
  ```

---

## Task 4: Add illustration API client

**Files:**
- Modify: `frontend/src/services/api.ts`

- [ ] **Step 1: Add `illustrationApi` at the end of the API exports (before `export default api`)**

  ```typescript
  // Illustration API
  export const illustrationApi = {
    get: (taskId: string) =>
      api.get<{ success: boolean; data: { svg: string | null } }>(`/tasks/${taskId}/illustration`),
  };
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add frontend/src/services/api.ts
  git commit -m "feat: add illustrationApi.get() to API client"
  ```

---

## Task 5: Create `IllustrationPanel` component and styles

**Files:**
- Create: `frontend/src/components/IllustrationPanel.tsx`
- Create: `frontend/src/styles/IllustrationPanel.css`

- [ ] **Step 1: Create the CSS file**

  ```css
  /* IllustrationPanel.css */

  .illustration-panel {
    margin-top: 14px;
    border-radius: var(--radius-lg);
    overflow: hidden;
    border: 1.5px solid var(--border);
    background: #1a1a2e;
  }

  .illustration-panel svg {
    display: block;
    width: 100%;
    height: auto;
  }

  .illustration-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 80px;
    color: var(--muted);
    font-size: 13px;
    gap: 8px;
  }

  .illustration-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid var(--border);
    border-top-color: var(--primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Thumbnail variant used in TaskCard */
  .illustration-thumb-wrap {
    width: calc(100% + 36px);   /* negate TaskCard's 18px left+right padding */
    margin: -18px -18px 14px;
    overflow: hidden;
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    background: #1a1a2e;
    border-bottom: 1.5px solid var(--border);
  }

  .illustration-thumb-wrap svg {
    display: block;
    width: 100%;
    height: auto;         /* uses viewBox aspect ratio */
    pointer-events: none;
  }
  ```

- [ ] **Step 2: Create the component**

  ```typescript
  import React, { useEffect, useState } from 'react';
  import { illustrationApi } from '../services/api';
  import '../styles/IllustrationPanel.css';

  interface IllustrationPanelProps {
    taskId: string;
    thumbnail?: boolean;
  }

  const IllustrationPanel: React.FC<IllustrationPanelProps> = ({ taskId, thumbnail = false }) => {
    const [svg, setSvg] = useState<string | null | 'loading'>('loading');

    useEffect(() => {
      let cancelled = false;
      illustrationApi.get(taskId)
        .then(res => {
          if (!cancelled) setSvg(res.data.data.svg);
        })
        .catch(() => {
          if (!cancelled) setSvg(null);
        });
      return () => { cancelled = true; };
    }, [taskId]);

    if (svg === 'loading') {
      if (thumbnail) return null; // Don't show loading state on cards — just absent
      return (
        <div className="illustration-loading">
          <div className="illustration-spinner" />
          <span>生成插图中…</span>
        </div>
      );
    }

    if (!svg) return null;

    if (thumbnail) {
      return (
        <div className="illustration-thumb-wrap">
          <div dangerouslySetInnerHTML={{ __html: svg }} />
        </div>
      );
    }

    return (
      <div className="illustration-panel">
        <div dangerouslySetInnerHTML={{ __html: svg }} />
      </div>
    );
  };

  export default IllustrationPanel;
  ```

- [ ] **Step 3: Verify TypeScript**

  ```bash
  cd frontend && npx tsc --noEmit
  ```

  Expected: no errors

- [ ] **Step 4: Commit**

  ```bash
  git add frontend/src/components/IllustrationPanel.tsx frontend/src/styles/IllustrationPanel.css
  git commit -m "feat: add IllustrationPanel component with loading/svg/null states"
  ```

---

## Task 6: Integrate `IllustrationPanel` into the Arena page

**Files:**
- Modify: `frontend/src/pages/Arena.tsx`

- [ ] **Step 1: Add the import**

  Add near the top of `frontend/src/pages/Arena.tsx` with the other component imports:

  ```typescript
  import IllustrationPanel from '../components/IllustrationPanel';
  ```

- [ ] **Step 2: Insert the panel**

  Find the closing `</div>` of the `question-box` div (around line 639):

  ```tsx
          {task.hint && <div className="q-hint">💡 {task.hint}</div>}
        </div>

        {/* Interactive Prisoner Dilemma Simulation for E001 */}
  ```

  Replace with:

  ```tsx
          {task.hint && <div className="q-hint">💡 {task.hint}</div>}
        </div>

        <IllustrationPanel taskId={task.id} />

        {/* Interactive Prisoner Dilemma Simulation for E001 */}
  ```

- [ ] **Step 3: Verify TypeScript**

  ```bash
  cd frontend && npx tsc --noEmit
  ```

  Expected: no errors

- [ ] **Step 4: Test in browser**

  Open `http://localhost:5173/arena/M001`. After a few seconds (first generation), an SVG diagram should appear below the question box.

- [ ] **Step 5: Commit**

  ```bash
  git add frontend/src/pages/Arena.tsx
  git commit -m "feat: add IllustrationPanel to Arena page below question box"
  ```

---

## Task 7: Add thumbnail illustration to TaskCard

**Files:**
- Modify: `frontend/src/components/TaskCard.tsx`

- [ ] **Step 1: Add the import**

  ```typescript
  import IllustrationPanel from './IllustrationPanel';
  ```

- [ ] **Step 2: Insert the thumbnail**

  In the `TaskCard` JSX, insert `<IllustrationPanel>` as the very first child inside the outer `task-card` div, before `.task-header`:

  ```tsx
  return (
    <div className={`task-card ${task.tier} ${task.completed ? 'completed' : ''}`} onClick={handleClick}>
      <IllustrationPanel taskId={task.id} thumbnail />
      <div className="task-header">
  ```

- [ ] **Step 3: Verify layout**

  The `.illustration-thumb-wrap` uses `margin: -18px -18px 14px` to break out of `.task-card`'s `padding: 18px` and stretch edge-to-edge. No additional CSS changes are needed in `TaskCard.css`.

- [ ] **Step 4: Verify TypeScript**

  ```bash
  cd frontend && npx tsc --noEmit
  ```

  Expected: no errors

- [ ] **Step 5: Test in browser**

  Open `http://localhost:5173`. Task cards that have a cached illustration should show a small scaled SVG at the top of the card. Cards without a cached illustration show no thumbnail (no layout shift).

- [ ] **Step 6: Commit**

  ```bash
  git add frontend/src/components/TaskCard.tsx
  git commit -m "feat: add illustration thumbnail to TaskCard"
  ```
