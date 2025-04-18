import { Router } from 'express';
import { 
  createQuiz, 
  updateQuiz, 
  deleteQuiz,
  addQuestion,
  updateQuestion,
  deleteQuestion
} from '../controllers/quiz';
import { authenticateToken, verifyTeacher } from '../middleware/auth';

const router = Router();

// Quiz routes
router.post('/', authenticateToken, verifyTeacher, createQuiz);
router.put('/:id', authenticateToken, verifyTeacher, updateQuiz);
router.delete('/:id', authenticateToken, verifyTeacher, deleteQuiz);

// Question routes
router.post('/:quizId/questions', authenticateToken, verifyTeacher, addQuestion);
router.put('/questions/:questionId', authenticateToken, verifyTeacher, updateQuestion);
router.delete('/questions/:questionId', authenticateToken, verifyTeacher, deleteQuestion);

export default router;