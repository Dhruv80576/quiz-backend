import { Router } from 'express';
import multer from 'multer';
import { authenticateToken } from '../middleware/auth';
import { isTeacher } from '../middleware/teacherMiddleware';
import {
  uploadResourceMaterial,
  uploadQuizImage,
  deleteResourceMaterial,
  deleteQuizImage,
  uploadQuestionImage,
  deleteQuestionImage,
} from '../controllers/fileUpload';

const router = Router();

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  // fileFilter: (req, file, cb) => {
  //   // Accept images only
  //   if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
  //     return cb(new Error('Only image files are allowed!') as any, false);
  //   }
  //   cb(null, true);
  // }
});

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Resource material routes (teacher only)
router.post(
  '/resource-material',
  isTeacher,
  upload.single('file'),
  uploadResourceMaterial
);
router.delete('/resource-material/:id', isTeacher, deleteResourceMaterial);

// Quiz image routes (teacher only)
router.post(
  '/quiz/:quizId/image',
  isTeacher,
  upload.single('image'),
  uploadQuizImage
);
router.delete('/quiz/image/:id', isTeacher, deleteQuizImage);

// Question image routes (teacher only)
router.post(
  '/question/:questionId/image',
  isTeacher,
  upload.single('image'),
  uploadQuestionImage
);
router.delete('/question/image/:id', isTeacher, deleteQuestionImage);

export default router; 