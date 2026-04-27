import axios from 'axios';
import type {
  User,
  Category,
  TaskListItem,
  Task,
  Scores,
  Submission,
  LeaderboardEntry,
  Course,
  MCPConnection,
  MCPTool,
  InteractionStartResponse,
  InteractionStepResponse,
  InteractionFinishResponse,
  InteractionRound,
} from '../types';

const API_BASE_URL = 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

// Auth API
export const authApi = {
  register: (username: string, password: string) =>
    api.post<{ success: boolean; user: User; error?: string }>('/auth/register', { username, password }),

  login: (username: string, password: string) =>
    api.post<{ success: boolean; user: User; error?: string }>('/auth/login', { username, password }),

  logout: () =>
    api.post<{ success: boolean }>('/auth/logout'),

  me: () =>
    api.get<{ success: boolean; user: User; error?: string }>('/auth/me'),

  getApiKey: () =>
    api.get<{ success: boolean; apiKey: string | null; error?: string }>('/auth/api-key'),

  generateApiKey: () =>
    api.post<{ success: boolean; apiKey: string; error?: string }>('/auth/api-key/generate'),
};

// Tasks API
export const tasksApi = {
  list: (category?: string) =>
    api.get<{
      success: boolean;
      tasks: TaskListItem[];
      categories: Category[];
      error?: string;
    }>('/tasks', { params: { category } }),

  get: (id: string) =>
    api.get<{ success: boolean; task: Task; error?: string }>(`/tasks/${id}`),
};

// Submissions API
export const submissionsApi = {
  my: () =>
    api.get<{ success: boolean; submissions: Submission[]; error?: string }>('/submissions/my'),

  submit: (taskId: string, userAnswer: string | null, scores?: Scores) =>
    api.post<{
      success: boolean;
      submission: {
        accuracy: number;
        reasoning: number;
        creativity: number;
        speed: number;
        totalScore: number;
        bountyEarned: number;
        grade: string;
        answer: string;
      };
      userStats: {
        totalScore: number;
        totalBounty: number;
        tasksCompleted: number;
        tier: string;
      };
      error?: string;
    }>('/submissions', { taskId, userAnswer, scores }),
};

// Leaderboard API
export const leaderboardApi = {
  get: (limit?: number) =>
    api.get<{ success: boolean; leaderboard: LeaderboardEntry[]; error?: string }>('/leaderboard', {
      params: { limit },
    }),
};

// Courses API
export const coursesApi = {
  list: () =>
    api.get<{
      success: boolean;
      courses: Course[];
      difficultyTiers: { key: string; name: string; description: string }[];
      error?: string;
    }>('/courses'),

  get: (id: number) =>
    api.get<{ success: boolean; course: Course; error?: string }>(`/courses/${id}`),
};

// MCP API
export const mcpApi = {
  list: () =>
    api.get<{ success: boolean; connections: MCPConnection[]; error?: string }>('/mcp'),

  create: (name: string, url: string, apiKey?: string) =>
    api.post<{ success: boolean; connection: MCPConnection; error?: string }>('/mcp', { name, url, apiKey }),

  test: (id: number) =>
    api.post<{ success: boolean; tools: MCPTool[]; error?: string; details?: any }>(`/mcp/${id}/test`),

  call: (id: number, toolName: string, args: any) =>
    api.post<{ success: boolean; result: any; jsonrpcResponse: any; error?: string }>(`/mcp/${id}/call`, {
      toolName,
      arguments: args,
    }),

  delete: (id: number) =>
    api.delete<{ success: boolean; error?: string }>(`/mcp/${id}`),
};

// Creation API (user-created tasks)
export const creationApi = {
  getCategories: () =>
    api.get<{ success: boolean; categories: Category[]; error?: string }>('/creation/categories'),

  listMyTasks: () =>
    api.get<{
      success: boolean;
      tasks: Array<{
        id: string;
        name: string;
        tier: string;
        bounty: number;
        catIcon: string;
        category: string;
        isPublic: boolean;
        author: string;
        questionPreview: string;
      }>;
      error?: string;
    }>('/creation/my-tasks'),

  createTask: (data: any) =>
    api.post<{ success: boolean; task: any; error?: string }>('/creation/task', data),

  updateTask: (id: string, data: any) =>
    api.put<{ success: boolean; task: any; error?: string }>(`/creation/task/${id}`, data),

  deleteTask: (id: string) =>
    api.delete<{ success: boolean; error?: string }>(`/creation/task/${id}`),

  fetchUrl: (url: string) =>
    api.post<{ success: boolean; text: string; length: number; error?: string }>('/creation/fetch-url', { url }),

  generateTasks: (sourceText: string, count?: number, tier?: string) =>
    api.post<{ success: boolean; tasks: any[]; error?: string }>('/creation/generate-tasks', { sourceText, count, tier }),
};

// ARK Volc Engine LLM API
export const arkApi = {
  status: () =>
    api.get<{ success: boolean; configured: boolean; modelId: string; endpoint: string; error?: string }>('/ark/status'),

  streamCompletion: (messages: Array<{ role: string; content: string }>, modelId?: string) => {
    // Returns an EventSource for streaming
    const url = `${API_BASE_URL}/ark/completion`;
    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ messages, modelId }),
    });
  },
};

// Chess API
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

// Social API (likes + comments)
export const socialApi = {
  getStats: (taskId: string) =>
    api.get<{ success: boolean; likeCount: number; commentCount: number; liked: boolean }>(`/social/stats/${taskId}`),

  toggleLike: (taskId: string) =>
    api.post<{ success: boolean; liked: boolean; likeCount: number }>(`/social/like/${taskId}`),

  getComments: (taskId: string) =>
    api.get<{ success: boolean; comments: SocialComment[] }>(`/social/comments/${taskId}`),

  addComment: (taskId: string, content: string) =>
    api.post<{ success: boolean; comment: SocialComment }>(`/social/comments/${taskId}`, { content }),

  deleteComment: (commentId: number) =>
    api.delete<{ success: boolean }>(`/social/comments/${commentId}`),
};

export interface SocialComment {
  id: number;
  content: string;
  createdAt: string;
  user: { id: number; username: string };
}

// Illustration API
export const illustrationApi = {
  get: (taskId: string) =>
    api.get<{ success: boolean; data: { svg: string | null } }>(`/tasks/${taskId}/illustration`),
};

// Gemini Image API (PNG generation via Imagen) - deprecated, use taskImageApi
export const geminiImageApi = {
  get: (taskId: string) =>
    api.get<{ success: boolean; data: { imageUrl: string; exists: boolean }; error?: string }>(
      `/tasks/${taskId}/gemini-image`
    ),
};

// Task Image API (PNG generation via configured provider: Gemini or OpenAI)
export const taskImageApi = {
  get: (taskId: string) =>
    api.get<{ success: boolean; data: { imageUrl: string; exists: boolean }; error?: string }>(
      `/tasks/${taskId}/image`
    ),
};

// Interaction API (turn-based interactive tasks)
export const interactionApi = {
  getHistory: (taskId: string) =>
    api.get<{
      success: boolean;
      hasHistory: boolean;
      history: InteractionRound[];
      sessionId: string;
      currentRound: number;
      latestGameState?: any;
    }>(`/interaction/history/${taskId}`),

  start: (taskId: string) =>
    api.post<InteractionStartResponse>(`/interaction/start/${taskId}`),

  step: (taskId: string, sessionId: string, userInput: string, gameState?: any) =>
    api.post<InteractionStepResponse>(`/interaction/step/${taskId}`, {
      sessionId,
      userInput,
      gameState,
    }),

  finish: (taskId: string, sessionId: string) =>
    api.post<InteractionFinishResponse>(`/interaction/finish/${taskId}`, { sessionId }),

  reset: (taskId: string) =>
    api.post<{ success: boolean; sessionId: string; roundNumber: number; systemResponse: string }>(
      `/interaction/reset/${taskId}`
    ),
};

// Qipashuo Debate Arena API
export interface DebateHistoryItem {
  id: number;
  topic: string;
  speakerCount: number;
  createdAt: string;
}

export interface DebateDetail extends DebateHistoryItem {
  fullContent: Array<{ speakerKey: string; text: string }>;
}

export const qipashuoApi = {
  call: (systemPrompt: string, task: string, max_tokens = 1000) =>
    api.post<{ success: boolean; text: string; error?: string }>('/qipashuo/debate', {
      systemPrompt,
      task,
      max_tokens,
    }),

  save: (topic: string, fullContent: Array<{ speakerKey: string; text: string }>) =>
    api.post<{ success: boolean; id: number; message: string; error?: string }>('/qipashuo/save', {
      topic,
      fullContent,
    }),

  getHistory: (page = 1, limit = 20) =>
    api.get<{
      success: boolean;
      debates: DebateHistoryItem[];
      total: number;
      page: number;
      totalPages: number;
      error?: string;
    }>('/qipashuo/history', { params: { page, limit } }),

  getDetail: (id: number) =>
    api.get<{ success: boolean; debate: DebateDetail; error?: string }>(`/qipashuo/${id}`),

  delete: (id: number) =>
    api.delete<{ success: boolean; message: string; error?: string }>(`/qipashuo/${id}`),
};

export default api;
