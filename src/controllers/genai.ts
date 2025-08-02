import express, { Request, Response } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

// Example: POST /generate with file upload (e.g., using multer middleware)
export const generateFromDocument = async (req: Request, res: Response) => {
  try {
    // Ensure file is present
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Read file content as text
    const documentContent = req.file.buffer.toString("utf-8");

    // Prepare your prompt (customize as needed)
    const prompt = `Create questions from the document in end. The structure of Questions should be 
      text          String
      type          QuestionType
      options       String[]
      correctAnswer Json (number for SINGLE_SELECT, number[] for MULTIPLE_SELECT, string[] for FILL_IN_BLANK)
      marks         Int (default: 1)
      subject       String
      explanation   String (optional - detailed explanation of the correct answer)
      answerLink    String (optional - URL to additional resources)
      difficulty    String (EASY, MEDIUM, HARD - default: MEDIUM)
      tags          String[] (optional - array of tags for categorization)
    
    where Question Type is an enum with values:
      SINGLE_SELECT, MULTIPLE_SELECT, FILL_IN_BLANK, INTEGER
    
    For correctAnswer field:
    - SINGLE_SELECT: use a number (index of correct option, 0-based)
    - MULTIPLE_SELECT: use an array of numbers (indices of correct options, 0-based)
    - FILL_IN_BLANK: use an array of strings (possible correct answers)
    - INTEGER: use a number (exact numeric answer)
    
    subject should be the academic subject category (e.g., Physics, Chemistry, Biology, Mathematics, etc.).
    explanation should provide a clear explanation of why the answer is correct.
    difficulty should be assigned based on the complexity of the question.
    tags should include relevant topic keywords from the content.
    
    Do not change the answer of any questions.
    return the questions in JSON format.
    Here is the document content to generate questions from:

${documentContent}`;

    // Call Google Generative AI API
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const result = await model.generateContent(prompt);

    // Extract and send the response
    const aiResponse = result.response.text();
    res.json({ result: aiResponse });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to generate content", details: error });
  }
};
