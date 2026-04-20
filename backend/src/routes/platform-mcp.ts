import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * MCP Tool definitions for the platform
 */
const TOOLS = [
  {
    name: 'list_tasks',
    description: 'List available bounty tasks on the platform',
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Filter by category name' },
        tier: { type: 'string', enum: ['easy', 'medium', 'hard'], description: 'Filter by difficulty' }
      }
    }
  },
  {
    name: 'get_task_details',
    description: 'Get detailed information about a specific task',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'The ID of the task (e.g., M001)' }
      },
      required: ['taskId']
    }
  },
  {
    name: 'submit_solution',
    description: 'Submit a solution for a task to earn bounty points',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'The ID of the task' },
        answer: { type: 'string', description: 'Your answer/solution text' },
        reasoning: { type: 'string', description: 'Detailed reasoning behind your answer' }
      },
      required: ['taskId', 'answer']
    }
  },
  {
    name: 'start_interaction',
    description: 'Start a turn-based interactive session for a task',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'The ID of the interactive task' }
      },
      required: ['taskId']
    }
  },
  {
    name: 'step_interaction',
    description: 'Send an action/message in an active interactive session',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'The ID of the task' },
        sessionId: { type: 'string', description: 'The current session ID' },
        userInput: { type: 'string', description: 'Your message or action' }
      },
      required: ['taskId', 'sessionId', 'userInput']
    }
  }
];

// MCP Endpoint for JSON-RPC
router.post('/', authMiddleware, async (req, res) => {
  const { jsonrpc, id, method, params } = req.body;

  if (jsonrpc !== '2.0') {
    return res.status(400).json({ error: 'Invalid JSON-RPC version' });
  }

  try {
    switch (method) {
      case 'tools/list':
        return res.json({
          jsonrpc: '2.0',
          id,
          result: { tools: TOOLS }
        });

      case 'tools/call':
        const { name, arguments: args } = params;
        const result = await handleToolCall(name, args, req.userId!);
        return res.json({
          jsonrpc: '2.0',
          id,
          result
        });

      default:
        return res.status(404).json({
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: 'Method not found' }
        });
    }
  } catch (error: any) {
    return res.status(500).json({
      jsonrpc: '2.0',
      id,
      error: { code: -32603, message: error.message || 'Internal error' }
    });
  }
});

async function handleToolCall(name: string, args: any, userId: number) {
  switch (name) {
    case 'list_tasks':
      const tasks = await prisma.task.findMany({
        where: {
          category: args.category ? { name: args.category } : undefined,
          tier: args.tier || undefined,
          isPublic: true
        },
        select: {
          id: true,
          name: true,
          tier: true,
          bounty: true,
          category: { select: { name: true } }
        }
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(tasks, null, 2) }]
      };

    case 'get_task_details':
      const task = await prisma.task.findUnique({
        where: { id: args.taskId },
        include: { category: true }
      });
      if (!task) throw new Error('Task not found');
      return {
        content: [{ type: 'text', text: JSON.stringify(task, null, 2) }]
      };

    case 'submit_solution':
      const targetTask = await prisma.task.findUnique({ 
        where: { id: args.taskId },
        include: { category: true }
      });
      if (!targetTask) throw new Error(`Task ${args.taskId} not found. Please check list_tasks for valid IDs.`);

      const userAns = args.answer.trim().toLowerCase();
      const refAns = targetTask.answer.trim().toLowerCase();
      
      // 1. Check for exact match
      let isCorrect = userAns === refAns;
      let matchRatio = isCorrect ? 1.0 : 0.0;

      // 2. Extract key terms from bold markers (e.g., **Key**)
      const keyTerms = targetTask.answer.match(/\*\*(.*?)\*\*/g)?.map(t => t.replace(/\*\*/g, '').toLowerCase()) || [];
      const hasKeyTerms = keyTerms.length > 0;
      const matchedKeyTerms = keyTerms.filter(term => userAns.includes(term));
      const keyTermMatchRatio = hasKeyTerms ? matchedKeyTerms.length / keyTerms.length : 0;

      // 3. Simple keyword coverage (split by spaces/punctuation)
      const refKeywords = refAns.split(/[\s,，.。!！?？:：;；"“”'‘’\[\](){}（）]/).filter(w => w.length > 1);
      const matchedKeywords = refKeywords.filter(w => userAns.includes(w));
      const keywordCoverage = refKeywords.length > 0 ? matchedKeywords.length / refKeywords.length : 0;

      // Final correctness logic:
      // - If there are bold key terms, at least 80% must match.
      // - Otherwise, keyword coverage must be > 60%.
      if (!isCorrect) {
        if (hasKeyTerms) {
          isCorrect = keyTermMatchRatio >= 0.8;
          matchRatio = keyTermMatchRatio;
        } else {
          isCorrect = keywordCoverage >= 0.6;
          matchRatio = keywordCoverage;
        }
      }

      // Calculate Scores using the new weighted system
      let weights = { accuracy: 0.25, reasoning: 0.25, creativity: 0.25, speed: 0.25 };
      const catName = targetTask.category.name;
      
      if (['悬疑推理', '逻辑能力', '批判性思维'].includes(catName)) {
        weights = { accuracy: 0.3, reasoning: 0.5, creativity: 0.1, speed: 0.1 };
      } else if (['综合联想'].includes(catName)) {
        weights = { accuracy: 0.2, reasoning: 0.2, creativity: 0.5, speed: 0.1 };
      } else if (['代码能力', '数学基础'].includes(catName)) {
        weights = { accuracy: 0.4, reasoning: 0.4, creativity: 0.0, speed: 0.2 };
      }

      const finalScores = {
        accuracy: Math.round(isCorrect ? (80 + 20 * matchRatio) : (40 * matchRatio)),
        reasoning: args.reasoning ? 85 : 60,
        creativity: 75,
        speed: 90
      };

      const totalScore = Math.round(
        (finalScores.accuracy * weights.accuracy) + 
        (finalScores.reasoning * weights.reasoning) + 
        (finalScores.creativity * weights.creativity) + 
        (finalScores.speed * weights.speed)
      );

      // Grade and Multipliers
      let grade = 'F';
      let gradeMultiplier = 0.5;
      if (totalScore >= 90) { grade = 'S'; gradeMultiplier = 1.2; }
      else if (totalScore >= 80) { grade = 'A'; gradeMultiplier = 1.1; }
      else if (totalScore >= 70) { grade = 'B'; gradeMultiplier = 1.0; }
      else if (totalScore >= 60) { grade = 'C'; gradeMultiplier = 0.8; }
      else if (isCorrect) { grade = 'D'; gradeMultiplier = 0.7; }

      let tierMultiplier = 12;
      if (targetTask.tier === 'easy') tierMultiplier = 10;
      else if (targetTask.tier === 'medium') tierMultiplier = 15;
      else if (targetTask.tier === 'hard') tierMultiplier = 20;

      const bountyEarned = isCorrect ? targetTask.bounty : 0;
      const scoreContribution = Math.round(totalScore * tierMultiplier * gradeMultiplier);

      let feedback = '';
      if (isCorrect) {
        feedback = `Success! Your answer is accepted (Match Quality: ${Math.round(matchRatio * 100)}%). You've earned ${bountyEarned} bounty points. Grade: ${grade}.`;
      } else {
        feedback = `Incorrect. Match Quality: ${Math.round(matchRatio * 100)}%. Hint: ${targetTask.hint || 'Try to be more specific.'} `;
        if (userAns.length < 5) feedback += 'Your answer is very short.';
      }

      await prisma.submission.create({
        data: {
          userId,
          taskId: args.taskId,
          userAnswer: args.answer,
          accuracy: finalScores.accuracy,
          reasoning: finalScores.reasoning,
          creativity: finalScores.creativity,
          speed: finalScores.speed,
          totalScore,
          bountyEarned,
          grade
        }
      });

      if (isCorrect) {
        await prisma.user.update({
          where: { id: userId },
          data: {
            totalScore: { increment: scoreContribution + bountyEarned },
            totalBounty: { increment: bountyEarned },
            tasksCompleted: { increment: 1 }
          }
        });
      }

      return {
        content: [{ type: 'text', text: feedback }],
        isError: !isCorrect
      };

    case 'start_interaction': {
      const task = await prisma.task.findUnique({ where: { id: args.taskId } });
      if (!task || !task.isInteractive) throw new Error(`Task ${args.taskId} not found or not interactive.`);
      
      const sessionId = `${userId}-${args.taskId}-${Date.now()}`;
      const config = task.interactionConfig ? JSON.parse(task.interactionConfig) : null;
      const initialMessage = config?.initialMessage || task.question;
      
      await prisma.interactionRound.create({
        data: {
          userId,
          taskId: args.taskId,
          sessionId,
          roundNumber: 1,
          userInput: null,
          systemResponse: initialMessage,
        },
      });

      return {
        content: [{ 
          type: 'text', 
          text: `Interaction started. Session ID: ${sessionId}\nSystem: ${initialMessage}\n\nUse step_interaction to reply.` 
        }]
      };
    }

    case 'step_interaction': {
      // To properly step an interaction, we should really use the logic from routes/interaction.ts 
      // which calls the LLM. For MCP simplicity without importing the whole Ark module, we can 
      // require the Agent to use the WebSocket or the REST API for interactive tasks, 
      // or we do a simple pass-through.
      // Here we just save the user's step. The real-time system/WebSocket or the next REST call
      // would process the AI response. For now, we return a hint.
      return {
        content: [{
          type: 'text',
          text: `Action received for session ${args.sessionId}. Note: For full interactive processing and AI opponent responses, please connect to the WebSocket endpoint ws://localhost:3001/api/ws or use the /api/interaction REST endpoints directly.`
        }]
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export default router;
