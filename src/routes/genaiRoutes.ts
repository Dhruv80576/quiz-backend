import { Router, Request, Response } from "express";
import { isTeacher } from "../middleware/teacherMiddleware";
import { generateFromDocument } from "../controllers/genai";

const router = Router();

// GET /api/genai/questions
router.get("/fetch-questions",generateFromDocument);

// POST /api/genai/submit
router.post("/submit", (req: Request, res: Response) => {
  // Example: Handle question submission
  const { question } = req.body;
  // Save question logic here
  res.status(201).json({ message: "Question submitted", question });
});

// GET /api/genai/answers
router.get("/answers", (req: Request, res: Response) => {
  // Example: Fetch answers
  res.json({
    answers: [
      "AI stands for Artificial Intelligence.",
      "Neural networks are...",
    ],
  });
});

export default router;
