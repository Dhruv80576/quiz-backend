import { Request, Response } from 'express';
import { AuthRequest } from '../types';
import prisma from '../config/db';
import { Question } from '@prisma/client';

type QuestionType = Question['type'];

interface CreateQuizRequest {
  title: string;
  description: string;
  duration: number;
  isPublic?: boolean;
  password?: string;
  questions: {
    text: string;
    type: QuestionType;
    options: string[];
    correctAnswer: number;
  }[];
}

interface UpdateQuizRequest {
  title?: string;
  description?: string;
  duration?: number;
  isPublic?: boolean;
  password?: string;
}

interface CreateQuestionRequest {
  text: string;
  type: QuestionType;
  options: string[];
  correctAnswer: number;
}

interface UpdateQuestionRequest {
  text?: string;
  type?: QuestionType;
  options?: string[];
  correctAnswer?: number;
}

interface QuestionResponse {
  id: string;
  text: string;
  type: QuestionType;
  options: string[];
  correctAnswer: number;
}

interface QuizAnswer {
  questionId: string;
  answer: string | number | number[];
}

interface SubmitQuizRequest {
  answers: QuizAnswer[];
}

const validateQuestion = (question: CreateQuestionRequest | UpdateQuestionRequest): boolean => {
  if (!question.type) return false;

  switch (question.type) {
    case 'SINGLE_SELECT':
    case 'MULTIPLE_SELECT':
      return Array.isArray(question.options) && 
             question.options.length > 0 && 
             typeof question.correctAnswer === 'number' &&
             question.correctAnswer >= 0 && 
             question.correctAnswer < question.options.length;
    case 'FILL_IN_BLANK':
      return question.correctAnswer === 0;
    case 'INTEGER':
      return typeof question.correctAnswer === 'number';
    default:
      return false;
  }
};

const calculateScore = (questions: any[], answers: QuizAnswer[]): number => {
  let score = 0;
  
  answers.forEach(answer => {
    const question = questions.find(q => q.id === answer.questionId);
    if (!question) return;

    switch (question.type) {
      case 'SINGLE_SELECT':
        if (answer.answer === question.correctAnswer) score++;
        break;
      case 'MULTIPLE_SELECT':
        if (Array.isArray(answer.answer) && 
            answer.answer.length === question.correctAnswer.length &&
            answer.answer.every(a => question.correctAnswer.includes(a))) {
          score++;
        }
        break;
      case 'FILL_IN_BLANK':
        if (answer.answer === question.correctAnswer) score++;
        break;
      case 'INTEGER':
        if (Number(answer.answer) === question.correctAnswer) score++;
        break;
    }
  });

  return score;
};

export const createQuiz = async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, duration, isPublic, password, questions } = req.body as CreateQuizRequest;

    // Validate questions
    if (!questions.every(validateQuestion)) {
      return res.status(400).json({ error: 'Invalid question format' });
    }

    const quiz = await prisma.quiz.create({
      data: {
        title,
        description,
        duration,
        isPublic: isPublic ?? false,
        password: password || null,
        teacherId: req.user!.id,
        questions: {
          create: questions.map(q => ({
            text: q.text,
            type: q.type,
            options: q.options,
            correctAnswer: q.correctAnswer
          }))
        }
      },
      include: {
        questions: true
      }
    });

    return res.status(201).json(quiz);
  } catch (error) {
    console.error('Error creating quiz:', error);
    return res.status(500).json({ error: 'Failed to create quiz' });
  }
};

export const updateQuiz = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, description, duration, isPublic, password } = req.body as UpdateQuizRequest;
    
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    // Check if quiz exists and belongs to the teacher
    const existingQuiz = await prisma.quiz.findUnique({
      where: { id },
      include: { questions: true }
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
        ...(isPublic !== undefined && { isPublic }),
        ...(password !== undefined && { password: password || null })
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
        password: updatedQuiz.password,
        questions: updatedQuiz.questions
      }
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

export const addQuestion = async (req: AuthRequest, res: Response) => {
  try {
    const { quizId } = req.params;
    const question = req.body as CreateQuestionRequest;

    if (!validateQuestion(question)) {
      return res.status(400).json({ error: 'Invalid question format' });
    }

    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: { questions: true }
    });

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    if (quiz.teacherId !== req.user!.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const newQuestion = await prisma.question.create({
      data: {
        text: question.text,
        type: question.type,
        options: question.options,
        correctAnswer: question.correctAnswer,
        quizId
      }
    });

    return res.status(201).json(newQuestion);
  } catch (error) {
    console.error('Error adding question:', error);
    return res.status(500).json({ error: 'Failed to add question' });
  }
};

export const updateQuestion = async (req: AuthRequest, res: Response) => {
  try {
    const { quizId, questionId } = req.params;
    const updates = req.body as UpdateQuestionRequest;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: { quiz: true }
    });

    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    if (question.quiz.teacherId !== req.user!.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // If type is being updated, validate the new type with correctAnswer
    if (updates.type || updates.correctAnswer !== undefined) {
      const validationQuestion = {
        ...question,
        ...updates,
        type: updates.type || question.type,
        correctAnswer: updates.correctAnswer ?? question.correctAnswer
      };

      if (!validateQuestion(validationQuestion)) {
        return res.status(400).json({ error: 'Invalid question format' });
      }
    }

    const updatedQuestion = await prisma.question.update({
      where: { id: questionId },
      data: updates
    });

    return res.json(updatedQuestion);
  } catch (error) {
    console.error('Error updating question:', error);
    return res.status(500).json({ error: 'Failed to update question' });
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

export const validateQuizPassword = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    const quiz = await prisma.quiz.findUnique({
      where: { id }
    });

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    if (!quiz.password) {
      return res.status(400).json({ error: 'This quiz does not require a password' });
    }

    if (quiz.password !== password) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    return res.json({ message: 'Password validated successfully' });
  } catch (error) {
    console.error('Error validating password:', error);
    return res.status(500).json({ error: 'Failed to validate password' });
  }
};

export const makeQuizPublic = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const quiz = await prisma.quiz.findUnique({
      where: { id }
    });

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    if (quiz.teacherId !== req.user.id) {
      return res.status(403).json({ error: 'You can only make your own quizzes public' });
    }

    const updatedQuiz = await prisma.quiz.update({
      where: { id },
      data: { isPublic: true }
    });

    return res.json({ message: 'Quiz is now public', quiz: updatedQuiz });
  } catch (error) {
    console.error('Error making quiz public:', error);
    return res.status(500).json({ error: 'Failed to make quiz public' });
  }
};

export const submitQuiz = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { answers } = req.body as SubmitQuizRequest;
    
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get quiz with questions
    const quiz = await prisma.quiz.findUnique({
      where: { id },
      include: { questions: true }
    });

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    // Calculate score
    const score = calculateScore(quiz.questions, answers);

    // Store response
    const response = await prisma.response.create({
      data: {
        quizId: id,
        userId: req.user.id,
        answers: answers as any, // Type assertion for Prisma JSON field
        score: score
      }
    });

    return res.json({
      message: 'Quiz submitted successfully',
      score: score,
      totalQuestions: quiz.questions.length
    });
  } catch (error) {
    console.error('Error submitting quiz:', error);
    return res.status(500).json({ error: 'Failed to submit quiz' });
  }
};

export const getQuizLeaderboard = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get quiz with responses and user details
    const quiz = await prisma.quiz.findUnique({
      where: { id },
      include: {
        responses: {
          include: {
            user: {
              select: {
                id: true,
                email: true
              }
            }
          },
          orderBy: {
            score: 'desc'
          }
        },
        _count: {
          select: {
            questions: true
          }
        }
      }
    });

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    // Format leaderboard data
    const leaderboard = quiz.responses.map((response, index) => ({
      rank: index + 1,
      userId: response.userId,
      email: response.user.email,
      score: response.score,
      totalQuestions: quiz._count.questions,
      percentage: Math.round((response.score / quiz._count.questions) * 100),
      submittedAt: response.createdAt
    }));

    return res.json({
      quizTitle: quiz.title,
      totalParticipants: leaderboard.length,
      leaderboard
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
}; 