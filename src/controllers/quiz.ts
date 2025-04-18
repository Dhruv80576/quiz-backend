import { Request, Response } from 'express';
import { AuthRequest } from '../types';
import prisma from '../config/db';

interface CreateQuizRequest {
  title: string;
  description: string;
  duration: number;
  isPublic?: boolean;  // Optional field
  questions: {
    text: string;
    options: string[];
    correctAnswer: number;
  }[];
}

interface UpdateQuizRequest {
  title?: string;
  description?: string;
  duration?: number;
  isPublic?: boolean;
  questions?: {
    text: string;
    options: string[];
    correctAnswer: number;
  }[];
}

interface Question {
  id: string;
  text: string;
  options: string[];
}

interface CreateQuestionRequest {
  text: string;
  options: string[];
  correctAnswer: number;
}

interface UpdateQuestionRequest {
  text?: string;
  options?: string[];
  correctAnswer?: number;
}

export const createQuiz = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, description, duration, isPublic = false, questions } = req.body as CreateQuizRequest;
    
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    
    const teacherId = req.user.id;

    // Validate input
    if (!title || !description || !duration || !questions || questions.length === 0) {
      res.status(400).json({ message: 'Missing required fields' });
      return;
    }

    // Create quiz with questions
    const quiz = await prisma.quiz.create({
      data: {
        title,
        description,
        duration,
        isPublic,
        teacherId,
        questions: {
          create: questions.map((q: { text: string; options: string[]; correctAnswer: number }) => ({
            text: q.text,
            options: q.options,
            correctAnswer: q.correctAnswer,
          })),
        },
      },
      include: {
        questions: true,
      },
    });

    res.status(201).json({
      message: 'Quiz created successfully',
      quiz: {
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        duration: quiz.duration,
        isPublic: quiz.isPublic,
        questions: quiz.questions.map((q: Question) => ({
          id: q.id,
          text: q.text,
          options: q.options,
        })),
      },
    });
  } catch (error) {
    console.error('Create quiz error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const updateQuiz = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, description, duration, isPublic } = req.body as UpdateQuizRequest;
    
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    // Check if quiz exists and belongs to the teacher
    const existingQuiz = await prisma.quiz.findUnique({
      where: { id }
    });

    if (!existingQuiz) {
      res.status(404).json({ message: 'Quiz not found' });
      return;
    }

    if (existingQuiz.teacherId !== req.user.id) {
      res.status(403).json({ message: 'You can only update your own quizzes' });
      return;
    }

    // Update quiz with only the provided fields
    const updatedQuiz = await prisma.quiz.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(description && { description }),
        ...(duration && { duration }),
        ...(isPublic !== undefined && { isPublic })
      },
      include: {
        questions: true
      }
    });

    res.json({
      message: 'Quiz updated successfully',
      quiz: {
        id: updatedQuiz.id,
        title: updatedQuiz.title,
        description: updatedQuiz.description,
        duration: updatedQuiz.duration,
        isPublic: updatedQuiz.isPublic,
        questions: updatedQuiz.questions.map((q: Question) => ({
          id: q.id,
          text: q.text,
          options: q.options,
        })),
      },
    });
  } catch (error) {
    console.error('Update quiz error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const deleteQuiz = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    // Check if quiz exists and belongs to the teacher
    const existingQuiz = await prisma.quiz.findUnique({
      where: { id }
    });

    if (!existingQuiz) {
      res.status(404).json({ message: 'Quiz not found' });
      return;
    }

    if (existingQuiz.teacherId !== req.user.id) {
      res.status(403).json({ message: 'You can only delete your own quizzes' });
      return;
    }

    // First delete all questions associated with the quiz
    await prisma.question.deleteMany({
      where: { quizId: id }
    });

    // Then delete the quiz
    await prisma.quiz.delete({
      where: { id }
    });

    res.json({ message: 'Quiz deleted successfully' });
  } catch (error) {
    console.error('Delete quiz error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const addQuestion = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { quizId } = req.params;
    const { text, options, correctAnswer } = req.body as CreateQuestionRequest;
    
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    // Check if quiz exists and belongs to the teacher
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId }
    });

    if (!quiz) {
      res.status(404).json({ message: 'Quiz not found' });
      return;
    }

    if (quiz.teacherId !== req.user.id) {
      res.status(403).json({ message: 'You can only add questions to your own quizzes' });
      return;
    }

    // Validate input
    if (!text || !options || options.length === 0 || correctAnswer === undefined) {
      res.status(400).json({ message: 'Missing required fields' });
      return;
    }

    // Create new question
    const question = await prisma.question.create({
      data: {
        text,
        options,
        correctAnswer,
        quizId
      }
    });

    res.status(201).json({
      message: 'Question added successfully',
      question: {
        id: question.id,
        text: question.text,
        options: question.options
      }
    });
  } catch (error) {
    console.error('Add question error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const updateQuestion = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { questionId } = req.params;
    const { text, options, correctAnswer } = req.body as UpdateQuestionRequest;
    
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    // Get the question with its quiz to check ownership
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: { quiz: true }
    });

    if (!question) {
      res.status(404).json({ message: 'Question not found' });
      return;
    }

    if (question.quiz.teacherId !== req.user.id) {
      res.status(403).json({ message: 'You can only update questions in your own quizzes' });
      return;
    }

    // Update question
    const updatedQuestion = await prisma.question.update({
      where: { id: questionId },
      data: {
        text: text ?? question.text,
        options: options ?? question.options,
        correctAnswer: correctAnswer ?? question.correctAnswer
      }
    });

    res.json({
      message: 'Question updated successfully',
      question: {
        id: updatedQuestion.id,
        text: updatedQuestion.text,
        options: updatedQuestion.options
      }
    });
  } catch (error) {
    console.error('Update question error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const deleteQuestion = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { questionId } = req.params;
    
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    // Get the question with its quiz to check ownership
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: { quiz: true }
    });

    if (!question) {
      res.status(404).json({ message: 'Question not found' });
      return;
    }

    if (question.quiz.teacherId !== req.user.id) {
      res.status(403).json({ message: 'You can only delete questions from your own quizzes' });
      return;
    }

    // Delete question
    await prisma.question.delete({
      where: { id: questionId }
    });

    res.json({ message: 'Question deleted successfully' });
  } catch (error) {
    console.error('Delete question error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}; 