# Likes & Comments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-task likes (toggle) and comments (threaded list) with counts shown on task cards and a sort-by-likes option on the home page.

**Architecture:** New `Like` and `Comment` Prisma models. New `backend/src/routes/social.ts` route module. Frontend `SocialPanel` component rendered at bottom of Arena page. Task cards and Home page updated to show counts and sort toggle.

**Tech Stack:** Prisma + SQLite, Express + TypeScript, React 18 + TypeScript, existing JWT cookie auth pattern.

---

### Task 1: Add Like and Comment models to Prisma schema

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Add inverse relation arrays to User model**

In `backend/prisma/schema.prisma`, inside `model User { ... }`, add after the `createdCourses Course[]` line:

```prisma
  likes         Like[]
  comments      Comment[]
```

- [ ] **Step 2: Add inverse relation arrays to Task model**

Inside `model Task { ... }`, add after the `lessons Lesson[]` line:

```prisma
  likes         Like[]
  comments      Comment[]
```

- [ ] **Step 3: Add Like model at end of schema**

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
```

- [ ] **Step 4: Add Comment model at end of schema**

```prisma
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

- [ ] **Step 5: Push schema and regenerate client**

```bash
cd backend
npx prisma db push
npx prisma generate
```

Expected: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 6: Commit**

```bash
git add backend/prisma/schema.prisma
git commit -m "feat: add Like and Comment models to Prisma schema"
```

---

### Task 2: Create backend social routes

**Files:**
- Create: `backend/src/routes/social.ts`
- Modify: `backend/src/index.ts`

- [ ] **Step 1: Create `backend/src/routes/social.ts`**

```typescript
import express from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret';

// Resolve optional userId from cookie without blocking the request
function getOptionalUserId(req: express.Request): number | undefined {
  try {
    const token = req.cookies?.jwt;
    if (!token) return undefined;
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
    return decoded.userId;
  } catch {
    return undefined;
  }
}

// GET /api/social/stats/:taskId — public, includes liked state if authenticated
router.get('/stats/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId = getOptionalUserId(req);

    const [likeCount, commentCount, userLike] = await Promise.all([
      prisma.like.count({ where: { taskId } }),
      prisma.comment.count({ where: { taskId } }),
      userId
        ? prisma.like.findUnique({ where: { userId_taskId: { userId, taskId } } })
        : null,
    ]);

    res.json({ success: true, likeCount, commentCount, liked: !!userLike });
  } catch (error) {
    console.error('Social stats error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/social/like/:taskId — toggle like
router.post('/like/:taskId', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId!;
    const { taskId } = req.params;

    const existing = await prisma.like.findUnique({
      where: { userId_taskId: { userId, taskId } },
    });

    if (existing) {
      await prisma.like.delete({ where: { id: existing.id } });
    } else {
      await prisma.like.create({ data: { userId, taskId } });
    }

    const likeCount = await prisma.like.count({ where: { taskId } });
    res.json({ success: true, liked: !existing, likeCount });
  } catch (error) {
    console.error('Like toggle error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/social/comments/:taskId — public
router.get('/comments/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    const comments = await prisma.comment.findMany({
      where: { taskId },
      include: { user: { select: { id: true, username: true } } },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ success: true, comments });
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/social/comments/:taskId — add comment
router.post('/comments/:taskId', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId!;
    const { taskId } = req.params;
    const { content } = req.body;

    if (!content?.trim()) {
      return res.status(400).json({ error: 'Content required' });
    }
    if (content.length > 500) {
      return res.status(400).json({ error: 'Comment too long (max 500 chars)' });
    }

    const comment = await prisma.comment.create({
      data: { userId, taskId, content: content.trim() },
      include: { user: { select: { id: true, username: true } } },
    });

    res.json({ success: true, comment });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/social/comments/:id — own comment or task author
router.delete('/comments/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId!;
    const id = parseInt(req.params.id);

    const comment = await prisma.comment.findUnique({
      where: { id },
      include: { task: { select: { authorId: true } } },
    });

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    const isOwner = comment.userId === userId;
    const isTaskAuthor = comment.task.authorId === userId;

    if (!isOwner && !isTaskAuthor) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await prisma.comment.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
```

- [ ] **Step 2: Mount social route in `backend/src/index.ts`**

Add import after the existing chess import:
```typescript
import socialRoutes from './routes/social';
```

Add mount after `/api/chess`:
```typescript
app.use('/api/social', socialRoutes);
```

- [ ] **Step 3: Verify server starts**

```bash
cd backend && npm run dev
```

Expected: `🚀 Server running on http://localhost:3001` with no TypeScript errors.

- [ ] **Step 4: Smoke test endpoints**

```bash
# Stats — no auth needed
curl -s http://localhost:3001/api/social/stats/M001 | python3 -c "import sys,json; print(json.load(sys.stdin))"
# Expected: {'success': True, 'likeCount': 0, 'commentCount': 0, 'liked': False}

# Comments list — no auth needed
curl -s http://localhost:3001/api/social/comments/M001
# Expected: {"success":true,"comments":[]}
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/social.ts backend/src/index.ts
git commit -m "feat: add social routes for likes and comments"
```

---

### Task 3: Add likeCount and commentCount to tasks list API

**Files:**
- Modify: `backend/src/routes/tasks.ts`

- [ ] **Step 1: Add aggregation queries inside the GET `/` handler**

In `backend/src/routes/tasks.ts`, after `const tasks = await prisma.task.findMany(...)` and before building the response, add:

```typescript
    // Aggregate like and comment counts for all returned tasks
    const taskIds = tasks.map(t => t.id);
    const [likeCounts, commentCounts] = await Promise.all([
      prisma.like.groupBy({
        by: ['taskId'],
        where: { taskId: { in: taskIds } },
        _count: { id: true },
      }),
      prisma.comment.groupBy({
        by: ['taskId'],
        where: { taskId: { in: taskIds } },
        _count: { id: true },
      }),
    ]);
    const likeMap = new Map(likeCounts.map(l => [l.taskId, l._count.id]));
    const commentMap = new Map(commentCounts.map(c => [c.taskId, c._count.id]));
```

- [ ] **Step 2: Add fields to the task mapping in the same handler**

In the `tasks.map(t => ({ ... }))` block, add after `completed: completedTaskIds.has(t.id),`:

```typescript
        likeCount: likeMap.get(t.id) ?? 0,
        commentCount: commentMap.get(t.id) ?? 0,
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd backend && npx tsc --noEmit
```

Expected: no output (no errors).

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/tasks.ts
git commit -m "feat: include likeCount and commentCount in tasks list response"
```

---

### Task 4: Update frontend types and API service

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/services/api.ts`

- [ ] **Step 1: Add counts to TaskListItem in `frontend/src/types.ts`**

```typescript
export interface TaskListItem {
  id: string;
  name: string;
  tier: string;
  bounty: number;
  catIcon: string;
  category: string;
  questionPreview: string;
  completed: boolean;
  authorId: number | null;
  likeCount: number;
  commentCount: number;
}
```

- [ ] **Step 2: Add `socialApi` export to `frontend/src/services/api.ts`**

Add after the `chessApi` export at the bottom of the file:

```typescript
export interface SocialComment {
  id: number;
  content: string;
  createdAt: string;
  user: { id: number; username: string };
}

export const socialApi = {
  getStats: (taskId: string) =>
    api.get<{ success: boolean; likeCount: number; commentCount: number; liked: boolean }>(
      `/social/stats/${taskId}`
    ),

  toggleLike: (taskId: string) =>
    api.post<{ success: boolean; liked: boolean; likeCount: number }>(
      `/social/like/${taskId}`
    ),

  getComments: (taskId: string) =>
    api.get<{ success: boolean; comments: SocialComment[] }>(
      `/social/comments/${taskId}`
    ),

  addComment: (taskId: string, content: string) =>
    api.post<{ success: boolean; comment: SocialComment }>(
      `/social/comments/${taskId}`,
      { content }
    ),

  deleteComment: (id: number) =>
    api.delete<{ success: boolean }>(`/social/comments/${id}`),
};
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types.ts frontend/src/services/api.ts
git commit -m "feat: add likeCount/commentCount to TaskListItem type and socialApi"
```

---

### Task 5: Build SocialPanel component

**Files:**
- Create: `frontend/src/components/SocialPanel.tsx`
- Create: `frontend/src/styles/SocialPanel.css`

- [ ] **Step 1: Create `frontend/src/components/SocialPanel.tsx`**

```typescript
import React, { useState, useEffect } from 'react';
import { socialApi, SocialComment } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import '../styles/SocialPanel.css';

interface SocialPanelProps {
  taskId: string;
  taskAuthorId?: number | null;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '刚刚';
  if (m < 60) return `${m}分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}小时前`;
  return `${Math.floor(h / 24)}天前`;
}

const SocialPanel: React.FC<SocialPanelProps> = ({ taskId, taskAuthorId }) => {
  const { user } = useAuth();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [comments, setComments] = useState<SocialComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadStats();
    loadComments();
  }, [taskId]);

  const loadStats = async () => {
    try {
      const res = await socialApi.getStats(taskId);
      if (res.data.success) {
        setLikeCount(res.data.likeCount);
        setLiked(res.data.liked);
      }
    } catch {
      // non-critical, ignore
    }
  };

  const loadComments = async () => {
    try {
      const res = await socialApi.getComments(taskId);
      if (res.data.success) setComments(res.data.comments);
    } catch {
      // non-critical, ignore
    }
  };

  const handleLike = async () => {
    if (!user) return;
    // Optimistic update
    const prevLiked = liked;
    const prevCount = likeCount;
    setLiked(!liked);
    setLikeCount(liked ? likeCount - 1 : likeCount + 1);
    try {
      const res = await socialApi.toggleLike(taskId);
      if (res.data.success) {
        setLiked(res.data.liked);
        setLikeCount(res.data.likeCount);
      }
    } catch {
      setLiked(prevLiked);
      setLikeCount(prevCount);
    }
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim() || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await socialApi.addComment(taskId, newComment.trim());
      if (res.data.success) {
        setComments(prev => [...prev, res.data.comment]);
        setNewComment('');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || '发送失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (id: number) => {
    try {
      await socialApi.deleteComment(id);
      setComments(prev => prev.filter(c => c.id !== id));
    } catch {
      // ignore
    }
  };

  const canDelete = (comment: SocialComment) =>
    user && (user.id === comment.user.id || user.id === taskAuthorId);

  return (
    <div className="social-panel">
      <div className="social-header">
        <button
          className={`like-btn ${liked ? 'liked' : ''} ${!user ? 'disabled' : ''}`}
          onClick={handleLike}
          title={user ? (liked ? '取消点赞' : '点赞') : '登录后可点赞'}
        >
          {liked ? '❤️' : '🤍'} {likeCount}
        </button>
        <span className="comment-count">💬 {comments.length}</span>
      </div>

      <div className="comments-section">
        <h4 className="comments-title">讨论 ({comments.length})</h4>

        {comments.length === 0 && (
          <p className="no-comments">还没有评论，来说点什么吧</p>
        )}

        <div className="comments-list">
          {comments.map(c => (
            <div key={c.id} className="comment-item">
              <div className="comment-avatar">{c.user.username[0].toUpperCase()}</div>
              <div className="comment-body">
                <div className="comment-meta">
                  <span className="comment-author">{c.user.username}</span>
                  <span className="comment-time">{timeAgo(c.createdAt)}</span>
                  {canDelete(c) && (
                    <button className="comment-delete" onClick={() => handleDeleteComment(c.id)}>
                      删除
                    </button>
                  )}
                </div>
                <p className="comment-content">{c.content}</p>
              </div>
            </div>
          ))}
        </div>

        {user ? (
          <div className="comment-input-row">
            <textarea
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              placeholder="写下你的想法或提示..."
              maxLength={500}
              rows={2}
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmitComment();
              }}
            />
            <div className="comment-input-footer">
              <span className="char-count">{newComment.length}/500</span>
              {error && <span className="comment-error">{error}</span>}
              <button
                className="comment-send-btn"
                onClick={handleSubmitComment}
                disabled={submitting || !newComment.trim()}
              >
                {submitting ? '发送中...' : '发送'}
              </button>
            </div>
          </div>
        ) : (
          <p className="login-hint">登录后参与讨论</p>
        )}
      </div>
    </div>
  );
};

export default SocialPanel;
```

- [ ] **Step 2: Create `frontend/src/styles/SocialPanel.css`**

```css
.social-panel {
  margin-top: 32px;
  border-top: 1px solid var(--border-color);
  padding-top: 24px;
}

.social-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
}

.like-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 20px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.15s;
}

.like-btn:hover:not(.disabled) {
  border-color: #ef4444;
  background: rgba(239, 68, 68, 0.08);
}

.like-btn.liked {
  border-color: #ef4444;
  background: rgba(239, 68, 68, 0.12);
  color: #ef4444;
}

.like-btn.disabled {
  cursor: default;
  opacity: 0.7;
}

.comment-count {
  font-size: 0.95rem;
  color: var(--text-muted);
}

.comments-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.comments-title {
  margin: 0;
  font-size: 1rem;
  color: var(--text-primary);
  font-weight: 600;
}

.no-comments {
  color: var(--text-muted);
  font-size: 0.9rem;
  margin: 0;
}

.comments-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.comment-item {
  display: flex;
  gap: 10px;
}

.comment-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--primary);
  color: white;
  font-size: 0.85rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.comment-body {
  flex: 1;
}

.comment-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.comment-author {
  font-weight: 600;
  font-size: 0.875rem;
  color: var(--text-primary);
}

.comment-time {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.comment-delete {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 0.75rem;
  padding: 0;
  margin-left: auto;
}

.comment-delete:hover {
  color: var(--danger);
}

.comment-content {
  margin: 0;
  font-size: 0.9rem;
  color: var(--text-secondary);
  line-height: 1.5;
  white-space: pre-wrap;
}

.comment-input-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
}

.comment-input-row textarea {
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 0.9rem;
  resize: none;
  line-height: 1.5;
}

.comment-input-row textarea:focus {
  outline: none;
  border-color: var(--primary);
}

.comment-input-footer {
  display: flex;
  align-items: center;
  gap: 8px;
}

.char-count {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.comment-error {
  font-size: 0.8rem;
  color: var(--danger);
  flex: 1;
}

.comment-send-btn {
  margin-left: auto;
  padding: 7px 18px;
  background: var(--primary);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 0.9rem;
  cursor: pointer;
}

.comment-send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.login-hint {
  font-size: 0.875rem;
  color: var(--text-muted);
  margin: 8px 0 0;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/SocialPanel.tsx frontend/src/styles/SocialPanel.css
git commit -m "feat: add SocialPanel component with likes and comments"
```

---

### Task 6: Integrate SocialPanel into Arena page

**Files:**
- Modify: `frontend/src/pages/Arena.tsx`

- [ ] **Step 1: Add import at top of Arena.tsx**

After the existing imports, add:

```typescript
import SocialPanel from '../components/SocialPanel';
```

- [ ] **Step 2: Add SocialPanel before the final closing div (line ~857)**

The Arena page JSX ends with:
```tsx
        </div>
      </div>
    </div>
  );
```

Replace the last three closing divs with:
```tsx
        </div>
      </div>
      {task && (
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 20px 40px' }}>
          <SocialPanel taskId={task.id} taskAuthorId={task.authorId ?? null} />
        </div>
      )}
    </div>
  );
```

Note: `task.authorId` needs to exist on the `Task` type. Check `frontend/src/types.ts` — if `Task` doesn't have `authorId`, add `authorId?: number | null;` to the `Task` interface.

- [ ] **Step 3: Add authorId to backend task detail response**

In `backend/src/routes/tasks.ts`, inside the `GET /:id` handler response object (after `refSpeed: task.refSpeed,`), add:

```typescript
        refSpeed: task.refSpeed,
        authorId: task.authorId,
```

- [ ] **Step 4: Add authorId to frontend Task type**

In `frontend/src/types.ts`, update `export interface Task` to add:

```typescript
export interface Task {
  id: string;
  name: string;
  tier: string;
  bounty: number;
  catIcon: string;
  category: string;
  question: string;
  hint: string | null;
  answer?: string;
  steps: [string, string][];
  refAccuracy: number;
  refReasoning: number;
  refCreativity: number;
  refSpeed: number;
  authorId?: number | null;
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Arena.tsx frontend/src/types.ts
git commit -m "feat: render SocialPanel at bottom of Arena page"
```

---

### Task 7: Show like/comment counts on task cards

**Files:**
- Modify: `frontend/src/components/TaskCard.tsx`

- [ ] **Step 1: Add social counts to task-meta row**

In `frontend/src/components/TaskCard.tsx`, replace the `task-meta` div:

```tsx
      <div className="task-meta">
        <span className={`tag ${task.tier}`}>
          {task.tier === 'easy' ? '🥉 简单' : task.tier === 'medium' ? '🥈 挑战' : '🥇 精英'}
        </span>
        <span className="tag cat">{task.category}</span>
        {task.completed && <span className="tag completed">✅ 已掌握</span>}
        <span className="task-social-counts">
          🤍 {task.likeCount ?? 0}  💬 {task.commentCount ?? 0}
        </span>
      </div>
```

- [ ] **Step 2: Add minimal CSS for counts**

In `frontend/src/styles/TaskCard.css`, add at the bottom:

```css
.task-social-counts {
  margin-left: auto;
  font-size: 0.78rem;
  color: var(--text-muted);
  letter-spacing: 0.03em;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/TaskCard.tsx frontend/src/styles/TaskCard.css
git commit -m "feat: show like and comment counts on task cards"
```

---

### Task 8: Add sort-by-likes toggle to Home page

**Files:**
- Modify: `frontend/src/pages/Home.tsx`

- [ ] **Step 1: Add sort state**

In `frontend/src/pages/Home.tsx`, add after the `showMineOnly` state:

```typescript
  const [sortByLikes, setSortByLikes] = useState<boolean>(false);
```

- [ ] **Step 2: Update filteredTasks to also sort**

Replace the existing `filteredTasks` computation:

```typescript
  const filteredTasks = tasks
    .filter(task => {
      if (hideCompleted && task.completed) return false;
      if (showMineOnly && task.authorId !== user?.id) return false;
      return true;
    })
    .sort((a, b) => sortByLikes ? (b.likeCount ?? 0) - (a.likeCount ?? 0) : 0);
```

- [ ] **Step 3: Add "按热度" button to filter bar**

In the JSX filter bar, after the "只看我的" label block, add:

```tsx
        <button
          className={`sort-btn ${sortByLikes ? 'active' : ''}`}
          onClick={() => setSortByLikes(v => !v)}
        >
          🔥 {sortByLikes ? '按热度' : '按热度'}
        </button>
```

- [ ] **Step 4: Add CSS for sort button**

In `frontend/src/styles/TaskCard.css` (shared filter styles live there), add:

```css
.sort-btn {
  padding: 6px 14px;
  border-radius: 16px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  color: var(--text-muted);
  cursor: pointer;
  font-size: 0.85rem;
}

.sort-btn.active {
  border-color: var(--primary);
  background: rgba(99, 102, 241, 0.1);
  color: var(--primary);
}
```

- [ ] **Step 5: Verify TypeScript compiles and test the full flow**

```bash
cd frontend && npx tsc --noEmit
```

Then manually:
1. Open http://localhost:5173, log in
2. Home page: task cards show `🤍 0  💬 0`
3. Click "🔥 按热度" — no change yet (all zeros), button turns highlighted
4. Open any task in Arena — SocialPanel appears at the bottom
5. Click the heart button — count increments, heart fills
6. Add a comment — appears in list with your username
7. Delete your comment — disappears
8. Return to home — like count on card is updated

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/Home.tsx frontend/src/styles/TaskCard.css
git commit -m "feat: add sort-by-likes toggle to home page"
```
