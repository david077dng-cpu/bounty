# Likes & Comments Feature Design

**Date:** 2026-04-14  
**Status:** Approved

## Context

Users can create tasks via 挑战工坊 and share them publicly. To increase engagement, tasks need social features: likes (to signal quality) and comments (for discussion/hints). The home page should support sorting by popularity.

## Data Model

Two new Prisma models added to `backend/prisma/schema.prisma`:

```prisma
model Like {
  id        Int      @id @default(autoincrement())
  userId    Int
  taskId    String
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  task      Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)
  @@unique([userId, taskId])
}

model Comment {
  id        Int      @id @default(autoincrement())
  userId    Int
  taskId    String
  content   String
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  task      Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)
}
```

User and Task models gain inverse relation fields (`likes`, `comments`).

## API

New route module `backend/src/routes/social.ts`, mounted at `/api/social`:

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/like/:taskId` | required | Toggle like on/off, returns `{ liked, likeCount }` |
| GET | `/stats/:taskId` | optional | Returns `{ likeCount, commentCount, liked }` |
| GET | `/comments/:taskId` | optional | Returns comment list with `id, content, createdAt, user: { id, username }` |
| POST | `/comments/:taskId` | required | Add comment, body `{ content }`, max 500 chars |
| DELETE | `/comments/:id` | required | Delete comment — allowed if own comment OR task author |

`GET /api/tasks` updated to include `likeCount` and `commentCount` per task (single aggregation query).

## Frontend

### New component: `SocialPanel`
- `frontend/src/components/SocialPanel.tsx`
- `frontend/src/styles/SocialPanel.css`
- Props: `taskId: string, taskAuthorId?: number | null`
- Loads stats + comments on mount
- Like button: optimistic toggle, shows filled heart when liked
- Comment list: username initial avatar, relative time, content, delete button (own or author)
- Comment input: textarea (max 500 chars) + 发送 button, requires login

### Task cards (Home page)
- `TaskListItem` type gains `likeCount: number`, `commentCount: number`
- `TaskCard` shows `👍 N  💬 N` below the preview text

### Home page sort
- New "按热度" sort button beside existing filter checkboxes
- Toggles between ID order (default) and `likeCount` descending

## Files Modified
- `backend/prisma/schema.prisma` — add Like, Comment models + inverse relations
- `backend/src/routes/social.ts` — new
- `backend/src/index.ts` — mount social route
- `backend/src/routes/tasks.ts` — include likeCount, commentCount in list response
- `frontend/src/types.ts` — add likeCount, commentCount to TaskListItem
- `frontend/src/services/api.ts` — add socialApi
- `frontend/src/components/SocialPanel.tsx` — new
- `frontend/src/styles/SocialPanel.css` — new
- `frontend/src/pages/Arena.tsx` — render SocialPanel
- `frontend/src/components/TaskCard.tsx` — show counts
- `frontend/src/pages/Home.tsx` — sort toggle
