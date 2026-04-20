import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import routes
import authRoutes from './routes/auth';
import tasksRoutes from './routes/tasks';
import submissionsRoutes from './routes/submissions';
import leaderboardRoutes from './routes/leaderboard';
import coursesRoutes from './routes/courses';
import mcpRoutes from './routes/mcp';
import platformMcpRoutes from './routes/platform-mcp';
import openapiRoutes from './routes/openapi';
import creationRoutes from './routes/creation';
import arkRoutes from './routes/ark';
import chessRoutes from './routes/chess';
import socialRoutes from './routes/social';
import illustrationRoutes from './routes/illustration';
import interactionRoutes from './routes/interaction';
import geminiImageRoutes from './routes/geminiImage';
import { initWebSocket } from './websocket';

const app = express();
const PORT = process.env.PORT || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

// Middleware
app.use(cors({
  origin: CORS_ORIGIN,
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/submissions', submissionsRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/courses', coursesRoutes);
app.use('/api/mcp', mcpRoutes);
app.use('/api/platform/mcp', platformMcpRoutes);
app.use('/api', openapiRoutes);
app.use('/api/creation', creationRoutes);
app.use('/api/ark', arkRoutes);
app.use('/api/interaction', interactionRoutes);
app.use('/api/chess', chessRoutes);
app.use('/api/social', socialRoutes);
app.use('/api', illustrationRoutes);
app.use('/api', geminiImageRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Skill Bounty API is running' });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🔍 CORS enabled for: ${CORS_ORIGIN}`);
});

initWebSocket(server);
