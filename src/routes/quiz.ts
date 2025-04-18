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
  getQuizLeaderboard
} from '../controllers/quiz';

const router = Router();

// Protected routes (require authentication)
router.post('/', authenticateToken, (req: AuthRequest, res) => createQuiz(req, res));
router.put('/:id', authenticateToken, (req: AuthRequest, res) => updateQuiz(req, res));
router.delete('/:id', authenticateToken, (req: AuthRequest, res) => deleteQuiz(req, res));
router.post('/:quizId/questions', authenticateToken, (req: AuthRequest, res) => addQuestion(req, res));
router.put('/:quizId/questions/:questionId', authenticateToken, (req: AuthRequest, res) => updateQuestion(req, res));
router.delete('/:quizId/questions/:questionId', authenticateToken, (req: AuthRequest, res) => deleteQuestion(req, res));
router.post('/:id/public', authenticateToken, (req: AuthRequest, res) => makeQuizPublic(req, res));
router.post('/:id/submit', authenticateToken, (req: AuthRequest, res) => submitQuiz(req, res));

// Public route for password validation
router.post('/:id/validate-password', (req, res) => validateQuizPassword(req, res));

// New route for getting quiz leaderboard
router.get('/:id/leaderboard', (req, res) => getQuizLeaderboard(req, res));

export default router;