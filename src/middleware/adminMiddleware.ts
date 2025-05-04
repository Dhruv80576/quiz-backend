import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../types';

const prisma = new PrismaClient();

export const isAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Debug log to check the request
    console.log('Headers:', req.headers);
    console.log('User from request:', (req as AuthRequest).user);

    const authReq = req as AuthRequest;
    
    // Check if user exists in the request
    if (!authReq.user || !authReq.user.id) {
      console.log('No user found in request');
      res.status(401).json({ message: 'Unauthorized - No user found' });
      return;
    }

    // Find user in database
    const user = await prisma.user.findUnique({
      where: { id: authReq.user.id },
      select: { role: true }
    });

    console.log('Found user in database:', user);

    if (!user) {
      console.log('User not found in database');
      res.status(401).json({ message: 'Unauthorized - User not found' });
      return;
    }

    if (user.role !== 'ADMIN') {
      console.log('User is not an admin');
      res.status(403).json({ message: 'Forbidden - Admin access required' });
      return;
    }

    next();
  } catch (error) {
    console.error('Admin middleware error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}; 