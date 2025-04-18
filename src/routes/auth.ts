import { Router, Request, Response } from 'express';
import { signup, login } from '../controllers/auth';
import { authenticateToken } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = Router();

// Public routes
router.post('/signup', (req: Request, res: Response) => signup(req, res));
router.post('/login', (req: Request, res: Response) => login(req, res));

// Protected routes
router.get('/me', authenticateToken, (req: AuthRequest, res: Response) => {
  res.json({ user: req.user });
});

export default router; 