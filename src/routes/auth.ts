import { Router, Request, Response } from 'express';
import { signup, login, googleLogin } from '../controllers/auth';
import { verifyGoogleToken } from '../middleware/googleAuth';
import { authenticateToken } from '../middleware/auth';
import { SignupRequest, LoginRequest } from '../types';
import { AuthRequest } from '../types';
import { Role } from '@prisma/client';

const router = Router();

// Public routes
router.post('/signup', (req: Request<{}, {}, SignupRequest>, res: Response) => signup(req, res));
router.post('/login', (req: Request<{}, {}, LoginRequest>, res: Response) => login(req, res));
router.post('/google', verifyGoogleToken, googleLogin);

// Protected route
router.get('/me', authenticateToken, (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  res.json({ user: req.user });
});

export default router;  