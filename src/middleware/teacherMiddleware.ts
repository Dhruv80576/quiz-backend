import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const isTeacher = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized - No user found' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });

    if (!user || user.role !== 'TEACHER') {
      return res.status(403).json({ message: 'Forbidden - Teacher access required' });
    }

    next();
  } catch (error) {
    console.error('Teacher middleware error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}; 