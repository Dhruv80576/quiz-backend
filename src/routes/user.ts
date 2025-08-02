import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { AuthRequest } from '../types';
import {
  getUserProfile,
  updateUserProfile,
  changePassword,
  getUserStats,
  getGrades,
  getSubjects,
} from '../controllers/user';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Get user profile
router.get('/profile', (req: AuthRequest, res: Response) => getUserProfile(req, res));

// Update user profile
router.put('/profile', (req: AuthRequest, res: Response) => updateUserProfile(req, res));

// Change password
router.put('/password', (req: AuthRequest, res: Response) => changePassword(req, res));

// Get user statistics
router.get('/stats', (req: AuthRequest, res: Response) => getUserStats(req, res));

// Get available grades
router.get('/grades', (req: AuthRequest, res: Response) => getGrades(req, res));

// Get available subjects
router.get('/subjects', (req: AuthRequest, res: Response) => getSubjects(req, res));

export default router;
