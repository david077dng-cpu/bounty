import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface JwtPayload {
  userId: number;
}

declare global {
  namespace Express {
    interface Request {
      userId?: number;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret';

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // 1. Try JWT from cookies (for browser users)
  const token = req.cookies.jwt;
  
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
      req.userId = decoded.userId;
      return next();
    } catch (error) {
      // If token is invalid, don't return yet, try API key
    }
  }

  // 2. Try API Key from Authorization header (for Agents)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const apiKey = authHeader.split(' ')[1];
    
    if (apiKey) {
      try {
        const user = await prisma.user.findUnique({
          where: { apiKey },
          select: { id: true }
        });

        if (user) {
          req.userId = user.id;
          return next();
        }
      } catch (error) {
        console.error('API Key verification error:', error);
      }
    }
  }

  return res.status(401).json({ error: 'Unauthorized - Invalid credentials' });
};
