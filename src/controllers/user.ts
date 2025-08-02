import { Request, Response } from 'express';
import { AuthRequest } from '../types';
import prisma from '../config/db';
import bcrypt from 'bcryptjs';

export const getUserProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user });
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateUserProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { name, email } = req.body;

    // Check if email is already taken by another user
    if (email && email !== req.user.email) {
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser && existingUser.id !== req.user.id) {
        res.status(400).json({ error: 'Email already exists' });
        return;
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(name && { name }),
        ...(email && { email }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({ 
      message: 'Profile updated successfully',
      user: updatedUser 
    });
  } catch (error) {
    console.error('Update user profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const changePassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: 'Current password and new password are required' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    if (!user || !user.password) {
      res.status(404).json({ error: 'User not found or no password set' });
      return;
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      res.status(400).json({ error: 'Current password is incorrect' });
      return;
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: req.user.id },
      data: { password: hashedNewPassword },
    });

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getUserStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (req.user.role === 'TEACHER') {
      // Teacher statistics
      const [quizCount, totalStudents, classCount, totalResponses] = await Promise.all([
        // Count of quizzes created by teacher
        prisma.quiz.count({
          where: { teacherId: req.user.id },
        }),
        // Count unique students who attempted teacher's quizzes
        prisma.response.groupBy({
          by: ['userId'],
          where: {
            quiz: { teacherId: req.user.id },
          },
        }).then(results => results.length),
        // Count of classes taught by teacher
        prisma.class.count({
          where: { teacherId: req.user.id },
        }),
        // Total responses to teacher's quizzes
        prisma.response.count({
          where: {
            quiz: { teacherId: req.user.id },
          },
        }),
      ]);

      res.json({
        stats: {
          quizzes: quizCount,
          students: totalStudents,
          classes: classCount,
          totalAttempts: totalResponses,
        },
      });
    } else {
      // Student statistics
      const [attemptedQuizzes, classCount, totalScore, averageScore] = await Promise.all([
        // Count of quizzes attempted by student
        prisma.response.count({
          where: { userId: req.user.id },
        }),
        // Count of classes enrolled by student
        prisma.class.count({
          where: {
            students: {
              some: { id: req.user.id },
            },
          },
        }),
        // Total score obtained by student
        prisma.response.aggregate({
          where: { userId: req.user.id },
          _sum: { score: true },
        }).then(result => result._sum.score || 0),
        // Average score
        prisma.response.aggregate({
          where: { userId: req.user.id },
          _avg: { score: true },
        }).then(result => Math.round(result._avg.score || 0)),
      ]);

      res.json({
        stats: {
          attemptedQuizzes,
          classes: classCount,
          totalScore,
          averageScore,
        },
      });
    }
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getGrades = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // This is a placeholder - you can implement actual grade levels
    // For now, returning common grade levels
    const grades = [
      { id: '11', name: 'Class 11' },
      { id: '12', name: 'Class 12' },
      { id: 'neet', name: 'NEET Preparation' },
      { id: 'jee', name: 'JEE Preparation' },
    ];

    res.json({ grades });
  } catch (error) {
    console.error('Get grades error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getSubjects = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Get unique subjects from questions created by teachers or available in the system
    const subjects = await prisma.question.groupBy({
      by: ['subject'],
      _count: {
        subject: true,
      },
    });

    const formattedSubjects = subjects.map(subject => ({
      id: subject.subject.toLowerCase().replace(/\s+/g, '_'),
      name: subject.subject,
      questionCount: subject._count.subject,
    }));

    res.json({ subjects: formattedSubjects });
  } catch (error) {
    console.error('Get subjects error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
