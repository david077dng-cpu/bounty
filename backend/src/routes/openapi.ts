import express from 'express';

const router = express.Router();

const openapiSpec = {
  openapi: '3.0.0',
  info: {
    title: 'Skill Bounty API',
    version: '1.0.0',
    description: 'API for the Skill Bounty (猎人竞技场) LLM Agent Learning Platform. Use this API to list tasks, submit solutions, and track progress.',
  },
  servers: [
    {
      url: 'http://localhost:3001/api',
      description: 'Local development server',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
      },
    },
    schemas: {
      Task: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          tier: { type: 'string', enum: ['easy', 'medium', 'hard'] },
          bounty: { type: 'integer' },
          question: { type: 'string' },
          category: {
            type: 'object',
            properties: {
              name: { type: 'string' }
            }
          }
        }
      },
      SubmissionResult: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          submission: {
            type: 'object',
            properties: {
              totalScore: { type: 'integer' },
              bountyEarned: { type: 'integer' },
              grade: { type: 'string' }
            }
          }
        }
      }
    }
  },
  security: [
    {
      bearerAuth: [],
    },
  ],
  paths: {
    '/tasks': {
      get: {
        summary: 'List all available tasks',
        operationId: 'listTasks',
        parameters: [
          {
            name: 'category',
            in: 'query',
            schema: { type: 'string' },
            description: 'Filter by category name',
          },
        ],
        responses: {
          '200': {
            description: 'A list of tasks',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    tasks: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Task' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/tasks/{id}': {
      get: {
        summary: 'Get task details',
        operationId: 'getTask',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Detailed task information',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    task: { $ref: '#/components/schemas/Task' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/submissions': {
      post: {
        summary: 'Submit a solution for a task',
        operationId: 'submitSolution',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['taskId', 'userAnswer'],
                properties: {
                  taskId: { type: 'string' },
                  userAnswer: { type: 'string' },
                  scores: {
                    type: 'object',
                    description: 'Optional self-assessment or agent-calculated scores',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Submission result',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SubmissionResult' },
              },
            },
          },
        },
      },
    },
  },
};

router.get('/openapi.json', (req, res) => {
  res.json(openapiSpec);
});

export default router;
