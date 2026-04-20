import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { PrismaClient } from '@prisma/client';
import url from 'url';

const prisma = new PrismaClient();

// Store active connections by user ID
export const activeConnections = new Map<number, WebSocket>();

export function initWebSocket(server: Server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', async (request, socket, head) => {
    // We only handle /api/ws path
    const parsedUrl = url.parse(request.url || '', true);
    
    if (parsedUrl.pathname !== '/api/ws') {
      return; // Let other handlers (if any) process it
    }

    const apiKey = parsedUrl.query.apiKey as string;

    if (!apiKey) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    try {
      const user = await prisma.user.findUnique({
        where: { apiKey },
        select: { id: true, username: true }
      });

      if (!user) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request, user);
      });
    } catch (error) {
      socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
      socket.destroy();
    }
  });

  wss.on('connection', (ws, request, user: { id: number, username: string }) => {
    console.log(`🔌 Agent connected via WebSocket: ${user.username} (ID: ${user.id})`);
    
    // Store connection
    activeConnections.set(user.id, ws);

    // Send welcome message
    ws.send(JSON.stringify({
      type: 'system',
      message: 'Connected to Skill Bounty Agent WebSocket Server',
      timestamp: new Date().toISOString()
    }));

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        // Handle incoming messages from Agent if needed
        // e.g., subscribe to a specific task stream, etc.
        console.log(`Received message from ${user.username}:`, data);
        
        if (data.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
        }
      } catch (e) {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
      }
    });

    ws.on('close', () => {
      console.log(`🔌 Agent disconnected: ${user.username}`);
      activeConnections.delete(user.id);
    });
    
    ws.on('error', (error) => {
      console.error(`WebSocket error for ${user.username}:`, error);
      activeConnections.delete(user.id);
    });
  });

  return wss;
}

/**
 * Utility to send a real-time event to a connected agent
 */
export function notifyAgent(userId: number, eventType: string, payload: any) {
  const ws = activeConnections.get(userId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: eventType,
      data: payload,
      timestamp: new Date().toISOString()
    }));
    return true;
  }
  return false;
}
