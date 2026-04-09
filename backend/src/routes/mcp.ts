import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth';
import axios from 'axios';

const router = express.Router();
const prisma = new PrismaClient();

// List user's MCP connections
router.get('/', authMiddleware, async (req, res) => {
  try {
    const connections = await prisma.mCPConnection.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        url: true,
        apiKey: true,
        createdAt: true,
        lastUsed: true,
      },
    });

    // Don't send apiKey back to client for security
    const safeConnections = connections.map(c => ({
      id: c.id,
      name: c.name,
      url: c.url,
      hasApiKey: !!c.apiKey,
      createdAt: c.createdAt,
      lastUsed: c.lastUsed,
    }));

    res.json({ success: true, connections: safeConnections });
  } catch (error) {
    console.error('List MCP connections error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create new MCP connection
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, url, apiKey } = req.body;

    if (!name || !url) {
      return res.status(400).json({ error: 'Name and URL are required' });
    }

    const connection = await prisma.mCPConnection.create({
      data: {
        userId: req.userId!,
        name,
        url,
        apiKey: apiKey || null,
      },
      select: {
        id: true,
        name: true,
        url: true,
        createdAt: true,
      },
    });

    res.json({ success: true, connection });
  } catch (error) {
    console.error('Create MCP connection error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Test MCP connection - list available tools
router.post('/:id/test', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const connection = await prisma.mCPConnection.findUnique({
      where: {
        id: parseInt(id),
        userId: req.userId!,
      },
    });

    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    // Try to list tools from MCP server
    // MCP protocol: POST with jsonrpc request
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (connection.apiKey) {
        headers['Authorization'] = `Bearer ${connection.apiKey}`;
      }

      const response = await axios.post(
        connection.url,
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list',
        },
        {
          headers,
          timeout: 10000, // 10 second timeout
        }
      );

      // Update last used time
      await prisma.mCPConnection.update({
        where: { id: parseInt(id) },
        data: { lastUsed: new Date() },
      });

      res.json({
        success: true,
        tools: response.data.result?.tools || [],
      });
    } catch (error: any) {
      console.error('MCP test error:', error);
      res.status(400).json({
        error: `Failed to connect to MCP server: ${error.message}`,
        details: error.response?.data || error.message,
      });
    }
  } catch (error) {
    console.error('Test MCP error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Call an MCP tool
router.post('/:id/call', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { toolName, arguments: toolArgs } = req.body;

    if (!toolName) {
      return res.status(400).json({ error: 'toolName is required' });
    }

    const connection = await prisma.mCPConnection.findUnique({
      where: {
        id: parseInt(id),
        userId: req.userId!,
      },
    });

    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (connection.apiKey) {
      headers['Authorization'] = `Bearer ${connection.apiKey}`;
    }

    try {
      const response = await axios.post(
        connection.url,
        {
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'tools/call',
          params: {
            name: toolName,
            arguments: toolArgs || {},
          },
        },
        {
          headers,
          timeout: 30000, // 30 second timeout for tool calls
        }
      );

      // Update last used time
      await prisma.mCPConnection.update({
        where: { id: parseInt(id) },
        data: { lastUsed: new Date() },
      });

      res.json({
        success: true,
        result: response.data.result,
        jsonrpcResponse: response.data,
      });
    } catch (error: any) {
      console.error('MCP call error:', error);
      res.status(400).json({
        error: `Failed to call tool: ${error.message}`,
        details: error.response?.data || error.message,
      });
    }
  } catch (error) {
    console.error('Call MCP tool error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete MCP connection
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.mCPConnection.delete({
      where: {
        id: parseInt(id),
        userId: req.userId!,
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete MCP error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
