import { Request, Response } from 'express';
import { AuthRequest } from '../types';
import prisma from '../config/db';
import { uploadToS3, deleteFromS3 } from '../config/s3';

// Upload resource material
export const uploadResourceMaterial = async (req: AuthRequest, res: Response) => {
  try {
    console.log('Received file:', req.file);
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { title, description, classId } = req.body;
    const teacherId = req.user!.id;

    console.log('Starting resource material upload...');
    // Upload to S3
    const { url, key } = await uploadToS3(req.file, 'resource-materials');
    console.log('File uploaded to S3:', url);

    // Create resource material record
    const resourceMaterial = await prisma.resourceMaterial.create({
      data: {
        title,
        description,
        fileUrl: url,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        fileName: req.file.originalname,
        teacherId,
        classId: classId || null,
      },
    });

    console.log('Resource material record created:', resourceMaterial.id);
    res.status(201).json(resourceMaterial);
  } catch (error) {
    console.error('Error uploading resource material:', error);
    res.status(500).json({ error: 'Failed to upload resource material' });
  }
};

// Upload quiz image
export const uploadQuizImage = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { quizId } = req.params;
    const teacherId = req.user!.id;

    console.log('Starting quiz image upload for quiz:', quizId);

    // Verify quiz ownership
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
    });

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    if (quiz.teacherId !== teacherId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    console.log('Uploading file to S3...');
    // Upload to S3
    const { url, key } = await uploadToS3(req.file, 'quiz-images');
    console.log('File uploaded to S3:', url);

    // Create quiz image record
    const quizImage = await prisma.quizImage.create({
      data: {
        imageUrl: url,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        fileType: req.file.mimetype,
        quizId,
      },
    });

    console.log('Quiz image record created:', quizImage.id);
    res.status(201).json(quizImage);
  } catch (error) {
    console.error('Error uploading quiz image:', error);
    res.status(500).json({ error: 'Failed to upload quiz image' });
  }
};

// Delete resource material
export const deleteResourceMaterial = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const teacherId = req.user!.id;

    const resourceMaterial = await prisma.resourceMaterial.findUnique({
      where: { id },
    });

    if (!resourceMaterial) {
      return res.status(404).json({ error: 'Resource material not found' });
    }

    if (resourceMaterial.teacherId !== teacherId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Delete from S3
    const key = resourceMaterial.fileUrl.split('/').pop();
    if (key) {
      await deleteFromS3(key);
    }

    // Delete from database
    await prisma.resourceMaterial.delete({
      where: { id },
    });

    res.json({ message: 'Resource material deleted successfully' });
  } catch (error) {
    console.error('Error deleting resource material:', error);
    res.status(500).json({ error: 'Failed to delete resource material' });
  }
};

// Delete quiz image
export const deleteQuizImage = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const teacherId = req.user!.id;

    console.log('Starting quiz image deletion:', id);

    const quizImage = await prisma.quizImage.findUnique({
      where: { id },
      include: { quiz: true },
    });

    if (!quizImage) {
      return res.status(404).json({ error: 'Quiz image not found' });
    }

    if (quizImage.quiz.teacherId !== teacherId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Delete from S3
    const key = quizImage.imageUrl.split('/').pop();
    if (key) {
      console.log('Deleting file from S3:', key);
      await deleteFromS3(key);
    }

    // Delete from database
    await prisma.quizImage.delete({
      where: { id },
    });

    console.log('Quiz image deleted successfully');
    res.json({ message: 'Quiz image deleted successfully' });
  } catch (error) {
    console.error('Error deleting quiz image:', error);
    res.status(500).json({ error: 'Failed to delete quiz image' });
  }
};

// Upload question image
export const uploadQuestionImage = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { questionId } = req.params;
    const teacherId = req.user!.id;

    console.log('Starting question image upload for question:', questionId);

    // Verify question ownership through quiz
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: { quiz: true },
    });

    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    if (question.quiz.teacherId !== teacherId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    console.log('Uploading file to S3...');
    // Upload to S3
    const { url, key } = await uploadToS3(req.file, 'question-images');
    console.log('File uploaded to S3:', url);

    // Create question image record
    const questionImage = await prisma.questionImage.create({
      data: {
        imageUrl: url,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        fileType: req.file.mimetype,
        questionId,
      },
    });

    console.log('Question image record created:', questionImage.id);
    res.status(201).json(questionImage);
  } catch (error) {
    console.error('Error uploading question image:', error);
    res.status(500).json({ error: 'Failed to upload question image' });
  }
};

// Delete question image
export const deleteQuestionImage = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const teacherId = req.user!.id;

    console.log('Starting question image deletion:', id);

    const questionImage = await prisma.questionImage.findUnique({
      where: { id },
      include: {
        question: {
          include: {
            quiz: true,
          },
        },
      },
    });

    if (!questionImage) {
      return res.status(404).json({ error: 'Question image not found' });
    }

    if (questionImage.question.quiz.teacherId !== teacherId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Delete from S3
    const key = questionImage.imageUrl.split('/').pop();
    if (key) {
      console.log('Deleting file from S3:', key);
      await deleteFromS3(key);
    }

    // Delete from database
    await prisma.questionImage.delete({
      where: { id },
    });

    console.log('Question image deleted successfully');
    res.json({ message: 'Question image deleted successfully' });
  } catch (error) {
    console.error('Error deleting question image:', error);
    res.status(500).json({ error: 'Failed to delete question image' });
  }
}; 