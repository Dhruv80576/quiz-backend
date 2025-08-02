import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { AuthRequest } from '../types';
import {
  createQuiz,
  updateQuiz,
  deleteQuiz,
  addQuestion,
  updateQuestion,
  deleteQuestion,
  validateQuizPassword,
  makeQuizPublic,
  submitQuiz,
  getQuizLeaderboard,
  searchQuizzes,
  getQuizzes,
  getResponseDetails,
  getQuizMetadata,
  getQuizQuestions,
  getUserAttemptedQuizzes
} from '../controllers/quiz';

const router = Router();

// Get all quizzes (public and user's own)
router.get('/', authenticateToken, (req: AuthRequest, res) => getQuizzes(req, res));

// Get user's attempted quizzes
router.get('/attempted', authenticateToken, (req: AuthRequest, res) => getUserAttemptedQuizzes(req, res));

// Get quiz metadata (without questions)
router.get('/:id/metadata', authenticateToken, (req: AuthRequest, res) => getQuizMetadata(req, res));

// Get quiz questions (without answers)
router.get('/:id/questions', authenticateToken, (req: AuthRequest, res) => getQuizQuestions(req, res));

// Protected routes (require authentication)
router.post('/', authenticateToken, (req: AuthRequest, res) => createQuiz(req, res));
router.put('/:id', authenticateToken, (req: AuthRequest, res) => updateQuiz(req, res));
router.delete('/:id', authenticateToken, (req: AuthRequest, res) => deleteQuiz(req, res));
router.post('/:quizId/questions', authenticateToken, (req: AuthRequest, res) => addQuestion(req, res));
router.put('/:quizId/questions/:questionId', authenticateToken, (req: AuthRequest, res) => updateQuestion(req, res));
router.delete('/:quizId/questions/:questionId', authenticateToken, (req: AuthRequest, res) => deleteQuestion(req, res));
router.post('/:id/public', authenticateToken, (req: AuthRequest, res) => makeQuizPublic(req, res));
router.post('/:quizId/submit', authenticateToken, (req: AuthRequest, res) => submitQuiz(req, res));

// Search and filter quizzes
router.get('/search', authenticateToken, (req: AuthRequest, res) => searchQuizzes(req, res));

// Public route for password validation
router.post('/:id/validate-password', (req, res) => validateQuizPassword(req, res));

// Get quiz leaderboard
router.get('/:id/leaderboard', (req, res) => getQuizLeaderboard(req, res));

// Get response details
router.get('/:quizId/responses', authenticateToken, getResponseDetails);

export default router;