export interface User {
  id: number;
  username: string;
  totalScore: number;
  totalBounty: number;
  tasksCompleted: number;
  tier: string;
  createdAt: string;
}

export interface Category {
  id: number;
  name: string;
  icon: string;
}

export interface TaskListItem {
  id: string;
  name: string;
  tier: string;
  bounty: number;
  catIcon: string;
  category: string;
  questionPreview: string;
  completed: boolean;
}

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
}

export interface Scores {
  accuracy: number;
  reasoning: number;
  creativity: number;
  speed: number;
}

export interface Submission {
  id: number;
  task: {
    id: string;
    name: string;
    catIcon: string;
    bounty: number;
    tier: string;
  };
  userAnswer: string | null;
  accuracy: number;
  reasoning: number;
  creativity: number;
  speed: number;
  totalScore: number;
  bountyEarned: number;
  grade: string;
  createdAt: string;
}

export interface LeaderboardEntry {
  id: number;
  username: string;
  tier: string;
  totalScore: number;
  totalBounty: number;
  tasksCompleted: number;
}

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

// --- LLM Agent Learning Platform Types ---
export interface Course {
  id: number;
  name: string;
  description: string;
  difficulty: string;
  icon: string;
  order: number;
  isActive: boolean;
  lessons: Lesson[];
}

export interface Lesson {
  id: number;
  courseId: number;
  title: string;
  description: string;
  taskId: string;
  order: number;
  requiresLessonId: number | null;
  bounty: number;
  isMcpTask: boolean;
  completed: boolean;
  unlocked: boolean;
  task?: Task;
}

export interface MCPConnection {
  id: number;
  name: string;
  url: string;
  hasApiKey: boolean;
  createdAt: string;
  lastUsed: string;
}

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: any;
}

export interface MCPToolCallResult {
  success: boolean;
  result?: any;
  error?: string;
}
