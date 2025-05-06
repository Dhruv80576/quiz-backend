import { Router } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { isTeacher } from '../middleware/teacherMiddleware';
import { authenticateToken } from '../middleware/auth';
import { AuthRequest } from '../types';
import bcrypt from 'bcrypt';

const router = Router();
const prisma = new PrismaClient();

// Apply authentication middleware to all class routes
router.use(authenticateToken);

// Create a new class (Teacher only)
router.post('/', isTeacher, async (req: AuthRequest, res) => {
  try {
    const { name, description, password } = req.body;
    const teacherId = req.user!.id;

    if (!name || !password) {
      return res.status(400).json({ message: 'Name and password are required' });
    }

    // Hash the class password
    const hashedPassword = await bcrypt.hash(password, 10);

    const newClass = await prisma.class.create({
      data: {
        name,
        description,
        password: hashedPassword,
        teacherId,
      },
      include: {
        teacher: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    res.status(201).json(newClass);
  } catch (error) {
    console.error('Error creating class:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get all classes for a teacher
router.get('/teaching', isTeacher, async (req: AuthRequest, res) => {
  try {
    const teacherId = req.user!.id;

    const classes = await prisma.class.findMany({
      where: { teacherId },
      include: {
        students: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        quizzes: {
          select: {
            id: true,
            title: true,
            description: true,
          },
        },
      },
    });

    res.json(classes);
  } catch (error) {
    console.error('Error fetching classes:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get all classes a student is enrolled in
router.get('/enrolled', async (req: AuthRequest, res) => {
  try {
    const studentId = req.user!.id;

    const classes = await prisma.class.findMany({
      where: {
        students: {
          some: {
            id: studentId,
          },
        },
      },
      include: {
        teacher: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        quizzes: {
          select: {
            id: true,
            title: true,
            description: true,
          },
        },
      },
    });

    res.json(classes);
  } catch (error) {
    console.error('Error fetching enrolled classes:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Join a class (Student only)
router.post('/join', async (req: AuthRequest, res) => {
  try {
    const { classId, password } = req.body;
    const studentId = req.user!.id;

    if (!classId || !password) {
      return res.status(400).json({ message: 'Class ID and password are required' });
    }

    const classToJoin = await prisma.class.findUnique({
      where: { id: classId },
    });

    if (!classToJoin) {
      return res.status(404).json({ message: 'Class not found' });
    }

    const isPasswordValid = await bcrypt.compare(password, classToJoin.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid class password' });
    }

    // Add student to class
    await prisma.class.update({
      where: { id: classId },
      data: {
        students: {
          connect: { id: studentId },
        },
      },
    });

    res.json({ message: 'Successfully joined the class' });
  } catch (error) {
    console.error('Error joining class:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return res.status(404).json({ message: 'Class not found' });
      }
    }
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update class details (Teacher only)
router.put('/:classId', isTeacher, async (req: AuthRequest, res) => {
  try {
    const { classId } = req.params;
    const { name, description, password } = req.body;
    const teacherId = req.user!.id;

    const updateData: any = {};
    if (name) updateData.name = name;
    if (description) updateData.description = description;
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    const updatedClass = await prisma.class.update({
      where: {
        id: classId,
        teacherId, // Ensure the teacher owns the class
      },
      data: updateData,
      include: {
        students: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    res.json({ message: 'Successfully updated the class' });
  } catch (error) {
    console.error('Error updating class:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return res.status(404).json({ message: 'Class not found or unauthorized' });
      }
    }
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete class (Teacher only)
router.delete('/:classId', isTeacher, async (req: AuthRequest, res) => {
  try {
    const { classId } = req.params;
    const teacherId = req.user!.id;

    await prisma.class.delete({
      where: {
        id: classId,
        teacherId, // Ensure the teacher owns the class
      },
    });

    res.json({ message: 'Successfully deleted the class' });
  } catch (error) {
    console.error('Error deleting class:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return res.status(404).json({ message: 'Class not found or unauthorized' });
      }
    }
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router; 