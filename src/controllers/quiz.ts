import { Request, Response } from 'express';
import { AuthRequest } from '../types';
import prisma from '../config/db';
import { Question } from '@prisma/client';
import { PrismaClient, Prisma } from '@prisma/client';
import { deleteFromS3 } from '../config/s3';

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
    marks?: number;
  }[];
}

interface UpdateQuizRequest {
  title?: string;
  description?: string;
  duration?: number;
  isPublic?: boolean;
  password?: string;
  imagesToDelete?: string[];
}

interface CreateQuestionRequest {
  text: string;
  type: QuestionType;
  options: string[];
  correctAnswer: number;
  marks?: number;
}

interface UpdateQuestionRequest {
  text?: string;
  type?: QuestionType;
  options?: string[];
  correctAnswer?: number;
  marks?: number;
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

const calculateScore = (questions: any[], answers: QuizAnswer[]): { score: number; totalMarks: number } => {
  let score = 0;
  let totalMarks = 0;
  
  questions.forEach(question => {
    totalMarks += question.marks || 1;
    const answer = answers.find(a => a.questionId === question.id);
    if (!answer) return;

    let isCorrect = false;
    let partialScore = 0;

    switch (question.type) {
      case 'SINGLE_SELECT':
        isCorrect = answer.answer === question.correctAnswer;
        if (isCorrect) {
          score += question.marks || 1;
        }
        break;

      case 'MULTIPLE_SELECT':
        if (Array.isArray(answer.answer) && Array.isArray(question.correctAnswer)) {
          const correctAnswers = question.correctAnswer;
          const userAnswers = answer.answer;
          
          // Calculate partial score based only on correct selections
          const correctCount = userAnswers.filter((a: number) => correctAnswers.includes(a)).length;
          
          // Award partial marks based on correct selections only
          const questionMarks = question.marks || 1;
          const marksPerOption = questionMarks / correctAnswers.length;
          
          // Only award marks for correct selections
          partialScore = correctCount * marksPerOption;
          
          score += partialScore;
        }
        break;

      case 'FILL_IN_BLANK':
        isCorrect = answer.answer === question.correctAnswer;
        if (isCorrect) {
          score += question.marks || 1;
        }
        break;

      case 'INTEGER':
        isCorrect = Number(answer.answer) === question.correctAnswer;
        if (isCorrect) {
          score += question.marks || 1;
        }
        break;
    }
  });

  return { score, totalMarks };
};

export const createQuiz = async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, duration, isPublic, password, questions } = req.body as CreateQuizRequest;

    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Calculate total marks from questions
    const totalMarks = questions.reduce((sum: number, q: any) => sum + (q.marks || 1), 0);

    const quiz = await prisma.quiz.create({
      data: {
        title,
        description,
        duration,
        isPublic: isPublic ?? false,
        password: password || null,
        teacherId: req.user.id,
        totalMarks,
        questions: {
          create: questions.map((q: any) => ({
            text: q.text,
            type: q.type,
            options: q.options,
            correctAnswer: q.correctAnswer,
            marks: q.marks || 1
          }))
        }
      },
      include: {
        questions: true,
        images: true
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
    const { title, description, duration, isPublic, password, imagesToDelete } = req.body as UpdateQuizRequest & { imagesToDelete?: string[] };
    
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    // Check if quiz exists and belongs to the teacher
    const existingQuiz = await prisma.quiz.findUnique({
      where: { id },
      include: { 
        questions: {
          include: {
            images: true,
          },
        },
        images: true,
      }
    });

    if (!existingQuiz) {
      res.status(404).json({ message: 'Quiz not found' });
      return;
    }

    if (existingQuiz.teacherId !== req.user.id) {
      res.status(403).json({ message: 'You can only update your own quizzes' });
      return;
    }

    // Delete specified images if any
    if (imagesToDelete && imagesToDelete.length > 0) {
      const imagesToRemove = existingQuiz.images.filter(img => imagesToDelete.includes(img.id));
      
      // Delete images from S3
      const deletePromises = imagesToRemove.map(image => {
        const key = image.imageUrl.split('/').pop();
        if (key) {
          return deleteFromS3(key);
        }
        return Promise.resolve();
      });

      // Wait for all image deletions to complete
      await Promise.all(deletePromises);

      // Delete image records from database
      await prisma.quizImage.deleteMany({
        where: {
          id: {
            in: imagesToDelete
          }
        }
      });
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
        questions: {
          include: {
            images: true,
          },
        },
        images: true,
      }
    });

    res.json({
      message: 'Quiz updated successfully',
      quiz: updatedQuiz
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
      where: { id },
      include: {
        images: true,
        questions: {
          include: {
            images: true
          }
        }
      }
    });

    if (!existingQuiz) {
      res.status(404).json({ message: 'Quiz not found' });
      return;
    }

    if (existingQuiz.teacherId !== req.user.id) {
      res.status(403).json({ message: 'You can only delete your own quizzes' });
      return;
    }

    // Delete all images from S3
    const deletePromises = [];

    // Delete quiz images
    for (const image of existingQuiz.images) {
      const key = image.imageUrl.split('/').pop();
      if (key) {
        deletePromises.push(deleteFromS3(key));
      }
    }

    // Delete question images
    for (const question of existingQuiz.questions) {
      for (const image of question.images) {
        const key = image.imageUrl.split('/').pop();
        if (key) {
          deletePromises.push(deleteFromS3(key));
        }
      }
    }

    // Wait for all image deletions to complete
    await Promise.all(deletePromises);

    // Delete all questions associated with the quiz
    await prisma.question.deleteMany({
      where: { quizId: id }
    });

    // Then delete the quiz
    await prisma.quiz.delete({
      where: { id }
    });

    res.json({ message: 'Quiz and all associated images deleted successfully' });
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
      },
      include: {
        images: true, // Include question images
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
      include: { 
        quiz: true,
        images: true, // Include question images
      }
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
      data: updates,
      include: {
        images: true, // Include question images
      }
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

    // Get the question with its quiz and images to check ownership
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: { 
        quiz: true,
        images: true
      }
    });

    if (!question) {
      res.status(404).json({ message: 'Question not found' });
      return;
    }

    if (question.quiz.teacherId !== req.user.id) {
      res.status(403).json({ message: 'You can only delete questions from your own quizzes' });
      return;
    }

    // Delete all images from S3
    const deletePromises = question.images.map(image => {
      const key = image.imageUrl.split('/').pop();
      if (key) {
        return deleteFromS3(key);
      }
      return Promise.resolve();
    });

    // Wait for all image deletions to complete
    await Promise.all(deletePromises);

    // Delete question
    await prisma.question.delete({
      where: { id: questionId }
    });

    res.json({ message: 'Question and all associated images deleted successfully' });
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
    const { quizId } = req.params;
    const { answers } = req.body;

    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if user has already submitted this quiz
    const existingResponse = await prisma.response.findFirst({
      where: {
        quizId,
        userId: req.user.id
      }
    });

    if (existingResponse) {
      return res.status(400).json({ error: 'You have already submitted this quiz' });
    }

    // Get quiz with questions to validate answers
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        questions: true
      }
    });

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    // Calculate score
    const { score, totalMarks } = calculateScore(quiz.questions, answers);

    // Create response and increment uniqueAttempts in a transaction
    const [response] = await prisma.$transaction([
      prisma.response.create({
        data: {
          quizId,
          userId: req.user.id,
          answers,
          score,
          totalMarks
        }
      }),
      prisma.quiz.update({
        where: { id: quizId },
        data: {
          uniqueAttempts: {
            increment: 1
          }
        }
      })
    ]);

    return res.json({
      message: 'Quiz submitted successfully',
      score,
      totalMarks,
      percentage: Math.round((score / totalMarks) * 100)
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

const prismaClient = new PrismaClient();

export const searchQuizzes = async (req: Request, res: Response) => {
  try {
    const {
      searchTerm,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = '1',
      limit = '10',
      teacherId,
      classId,
      isPublic,
    } = req.query;

    const where: Prisma.QuizWhereInput = {};
    if (searchTerm) {
      where.OR = [
        { title: { contains: searchTerm as string, mode: 'insensitive' } },
        { description: { contains: searchTerm as string, mode: 'insensitive' } },
      ];
    }
    if (teacherId) {
      where.teacherId = teacherId as string;
    }
    if (classId) {
      where.classId = classId as string;
    }
    if (isPublic !== undefined) {
      where.isPublic = isPublic === 'true';
    }
    const pageNumber = parseInt(page as string, 10);
    const limitNumber = parseInt(limit as string, 10);
    const skip = (pageNumber - 1) * limitNumber;
    const orderBy: Prisma.QuizOrderByWithRelationInput = {
      [sortBy as keyof Prisma.QuizOrderByWithRelationInput]: sortOrder as 'asc' | 'desc',
    };
    const [quizzes, total] = await Promise.all([
      prismaClient.quiz.findMany({
        where,
        orderBy,
        skip,
        take: limitNumber,
        include: {
          teacher: {
            select: {
              id: true,
              name: true,
              email: true },
          },
          class: {
            select: { id: true, name: true },
          },
        },
      }),
      prismaClient.quiz.count({ where }),
    ]);
    const totalPages = Math.ceil(total / limitNumber);
    const hasNextPage = pageNumber < totalPages;
    const hasPreviousPage = pageNumber > 1;
    res.json({
      quizzes,
      pagination: {
        total,
        totalPages,
        currentPage: pageNumber,
        limit: limitNumber,
        hasNextPage,
        hasPreviousPage,
      },
    });
  } catch (error) {
    console.error('Error searching quizzes:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getQuiz = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    const quiz = await prisma.quiz.findUnique({
      where: { id },
      include: {
        teacher: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        questions: {
          include: {
            images: true, // Include question images
          },
        },
        images: true, // Include quiz images
      },
    });

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    // If quiz is not public and user is not the teacher, check password
    if (!quiz.isPublic && quiz.teacherId !== req.user?.id) {
      return res.status(403).json({ error: 'Quiz is not public' });
    }

    res.json(quiz);
  } catch (error) {
    console.error('Error getting quiz:', error);
    res.status(500).json({ error: 'Failed to get quiz' });
  }
};

export const getQuizzes = async (req: AuthRequest, res: Response) => {
  try {
    const quizzes = await prisma.quiz.findMany({
      where: {
        OR: [
          { isPublic: true },
          { teacherId: req.user?.id },
        ],
      },
      include: {
        teacher: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        images: true, // Include quiz images
        _count: {
          select: {
            questions: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json(quizzes);
  } catch (error) {
    console.error('Error getting quizzes:', error);
    res.status(500).json({ error: 'Failed to get quizzes' });
  }
};

export const getResponseDetails = async (req: AuthRequest, res: Response) => {
  try {
    const { quizId, responseId } = req.params;
    
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get response with quiz and questions
    const response = await prisma.response.findUnique({
      where: { 
        id: responseId,
        quizId: quizId
      },
      include: {
        quiz: {
          include: {
            questions: true
          }
        }
      }
    });

    if (!response) {
      return res.status(404).json({ error: 'Response not found' });
    }

    // Check if user is authorized to view this response
    if (response.userId !== req.user.id && response.quiz.teacherId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to view this response' });
    }

    // Format response details
    const responseDetails = {
      quizTitle: response.quiz.title,
      score: response.score,
      totalMarks: response.totalMarks,
      percentage: Math.round((response.score / response.totalMarks) * 100),
      submittedAt: response.createdAt,
      questions: response.quiz.questions.map(question => {
        const userAnswers = response.answers as unknown as QuizAnswer[];
        const userAnswer = userAnswers.find(a => a.questionId === question.id);
        let isCorrect = false;
        let obtainedMarks = 0;

        // Calculate if answer is correct and marks obtained
        switch (question.type) {
          case 'SINGLE_SELECT':
            isCorrect = userAnswer?.answer === question.correctAnswer;
            obtainedMarks = isCorrect ? question.marks : 0;
            break;
          case 'MULTIPLE_SELECT':
            if (Array.isArray(userAnswer?.answer) && Array.isArray(question.correctAnswer)) {
              const correctAnswers = question.correctAnswer as unknown as number[];
              const correctCount = userAnswer.answer.filter((a: number) => 
                correctAnswers.includes(a)
              ).length;
              const marksPerOption = question.marks / correctAnswers.length;
              obtainedMarks = correctCount * marksPerOption;
              isCorrect = correctCount === correctAnswers.length;
            }
            break;
          case 'FILL_IN_BLANK':
            isCorrect = userAnswer?.answer === question.correctAnswer;
            obtainedMarks = isCorrect ? question.marks : 0;
            break;
          case 'INTEGER':
            isCorrect = Number(userAnswer?.answer) === question.correctAnswer;
            obtainedMarks = isCorrect ? question.marks : 0;
            break;
        }

        return {
          id: question.id,
          text: question.text,
          type: question.type,
          options: question.options,
          correctAnswer: question.correctAnswer,
          userAnswer: userAnswer?.answer,
          isCorrect,
          marks: question.marks,
          obtainedMarks
        };
      })
    };

    return res.json(responseDetails);
  } catch (error) {
    console.error('Error getting response details:', error);
    return res.status(500).json({ error: 'Failed to get response details' });
  }
};

export const getQuizMetadata = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const quiz = await prisma.quiz.findUnique({
      where: { id },
      include: {
        teacher: {
          select: {
            id: true,
            email: true,
            name: true
          }
        },
        images: true,
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

    // Check if user is authorized to view this quiz
    if (!quiz.isPublic && quiz.teacherId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to view this quiz' });
    }

    // Return only metadata
    return res.json({
      id: quiz.id,
      title: quiz.title,
      description: quiz.description,
      duration: quiz.duration,
      isPublic: quiz.isPublic,
      totalMarks: quiz.totalMarks,
      uniqueAttempts: quiz.uniqueAttempts,
      createdAt: quiz.createdAt,
      updatedAt: quiz.updatedAt,
      teacher: quiz.teacher,
      images: quiz.images,
      questionCount: quiz._count.questions
    });
  } catch (error) {
    console.error('Error getting quiz metadata:', error);
    return res.status(500).json({ error: 'Failed to get quiz metadata' });
  }
};

export const getQuizQuestions = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const quiz = await prisma.quiz.findUnique({
      where: { id },
      include: {
        questions: {
          include: {
            images: true
          }
        }
      }
    });

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    // Check if user is authorized to view this quiz
    if (!quiz.isPublic && quiz.teacherId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to view this quiz' });
    }

    // Return questions without correct answers
    const questions = quiz.questions.map(question => ({
      id: question.id,
      text: question.text,
      type: question.type,
      options: question.options,
      marks: question.marks,
      images: question.images
    }));

    return res.json({
      quizId: quiz.id,
      title: quiz.title,
      questions
    });
  } catch (error) {
    console.error('Error getting quiz questions:', error);
    return res.status(500).json({ error: 'Failed to get quiz questions' });
  }
};

export const getUserAttemptedQuizzes = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get all responses for the user with quiz details
    const responses = await prisma.response.findMany({
      where: {
        userId: req.user.id
      },
      include: {
        quiz: {
          include: {
            teacher: {
              select: {
                id: true,
                name: true,
                email: true
              }
            },
            _count: {
              select: {
                questions: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Format the response
    const attemptedQuizzes = responses.map(response => ({
      quizId: response.quiz.id,
      quizTitle: response.quiz.title,
      teacher: response.quiz.teacher,
      score: response.score,
      totalMarks: response.totalMarks,
      percentage: Math.round((response.score / response.totalMarks) * 100),
      totalQuestions: response.quiz._count.questions,
      submittedAt: response.createdAt
    }));

    return res.json({
      totalAttempts: attemptedQuizzes.length,
      quizzes: attemptedQuizzes
    });
  } catch (error) {
    console.error('Error getting user attempted quizzes:', error);
    return res.status(500).json({ error: 'Failed to get attempted quizzes' });
  }
};
