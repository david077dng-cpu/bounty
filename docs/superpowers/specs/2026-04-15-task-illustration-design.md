# Task Illustration Generation — Design Spec

**Date:** 2026-04-15
**Status:** Approved

## Overview

Use the ARK (Volc Engine) LLM to generate SVG-based explanatory illustrations for each task. Illustrations are lazy-generated on first access and cached in the database. They appear as a thumbnail on task cards (Home page) and as a full-size diagram in the Arena page.

---

## Data Layer

### Prisma Schema Change

Add one nullable field to the `Task` model in `backend/prisma/schema.prisma`:

```prisma
illustration  String?   // Generated SVG string; null = not yet generated
```

Run `npx prisma db push` after the change (no migration needed for SQLite dev).

---

## Backend

### New Route Module

File: `backend/src/routes/illustration.ts`
Mounted at: `GET /api/tasks/:id/illustration` (no auth required — public read)

**Logic:**

1. Look up task by `id`.
2. If `task.illustration` is non-null → return it immediately.
3. If null → call ARK LLM (non-streaming) to generate SVG.
4. Validate output starts with `<svg` (case-insensitive). If invalid → return `{ svg: null }`, do NOT cache.
5. If valid → write SVG to `task.illustration` via Prisma → return SVG.

**Response shape:**
```json
{ "success": true, "data": { "svg": "<svg>...</svg>" } }
{ "success": true, "data": { "svg": null } }   // on generation failure
```

**Timeout:** 30 s for the ARK call. On timeout → return `{ svg: null }`.

### ARK Call (Non-Streaming)

Endpoint: `POST {ARK_BASE_URL}/chat/completions`
Headers: same as existing ark.ts (Bearer token)
Body:
```json
{
  "model": "<ARK_MODEL_ID>",
  "messages": [
    { "role": "system", "content": "<system prompt>" },
    { "role": "user",   "content": "<user prompt>" }
  ],
  "stream": false
}
```

### Prompt Design

**System prompt** (static):
```
你是一个SVG图示专家。根据任务描述生成一张解释性插图。

要求：
- 只输出纯SVG代码，不要markdown代码块，不要任何解释文字
- 尺寸 600×400，深色背景 (#1a1a2e)，使用浅色文字和高对比度线条
- 保持简洁，突出核心概念，不要堆砌细节
```

**Task-type → style mapping** (injected into system prompt per request):

| 前缀 | 类别 | 图示风格 |
|------|------|----------|
| M | 悬疑推理 | 案发现场平面图或时间线 |
| A | 综合联想 | 概念关系网络图 |
| L | 逻辑能力 | 命题关系图或真值表 |
| N | 数学基础 | 公式推导流程图 |
| C | 代码能力 | 算法流程图 |
| S | 自然科学 | 概念示意图 |
| E | 进化博弈 | 博弈矩阵或策略树 |

**User prompt:**
```
任务名：{task.name}
类别：{task.cat}
描述：{task.question}
```

### Route Registration

In `backend/src/index.ts`, add:
```ts
import illustrationRouter from './routes/illustration';
app.use('/api', illustrationRouter);
```

---

## Frontend

### New Component: `IllustrationPanel`

File: `frontend/src/components/IllustrationPanel.tsx`

Props: `{ taskId: string }`

States:
- `loading` — show a small spinner
- `svg: string` — render SVG
- `null` — render nothing (silent failure, layout unaffected)

Fetches `GET /api/tasks/{taskId}/illustration` on mount.
Renders SVG via `dangerouslySetInnerHTML` (safe: SVG from our own LLM pipeline, no user-supplied content).

### Arena Page

In `frontend/src/pages/Arena.tsx`, insert `<IllustrationPanel taskId={task.id} />` directly below the `question-box` div. Lazy-loads on first render; does not block task interaction.

### Home Page Task Cards

In `frontend/src/components/TaskCard.tsx`, add a small illustration area above or below the card title:
- Call `GET /api/tasks/{taskId}/illustration` on mount.
- Use CSS `transform: scale(0.28); transform-origin: top left` with `overflow: hidden` on a fixed-size container to thumbnail the 600×400 SVG.
- If `svg` is null or still loading, the thumbnail area is simply absent — no layout shift.

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| ARK not configured | Return `{ svg: null }` |
| ARK returns non-SVG content | Log warning, return `{ svg: null }`, do not cache |
| ARK timeout (>30 s) | Return `{ svg: null }`, do not cache |
| Task not found | Return 404 |
| Frontend fetch fails | Component renders nothing silently |

---

## Out of Scope

- Admin regeneration UI (can be done via `npx prisma studio` for now — set `illustration` to null to force regeneration)
- Image-based generation (doubao-seedream) — deferred to a future iteration
- Bulk pre-generation script — deferred; lazy generation covers the need
