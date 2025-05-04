/*
  Warnings:

  - Added the required column `totalMarks` to the `Response` table without a default value. This is not possible if the table is not empty.

*/
-- Add marks field to Question
ALTER TABLE "Question" ADD COLUMN "marks" INTEGER NOT NULL DEFAULT 1;

-- Add totalMarks to Quiz
ALTER TABLE "Quiz" ADD COLUMN "totalMarks" INTEGER NOT NULL DEFAULT 0;

-- First add totalMarks to Response with a default value
ALTER TABLE "Response" ADD COLUMN "totalMarks" INTEGER NOT NULL DEFAULT 0;

-- Update existing quiz totalMarks based on question marks
UPDATE "Quiz" q 
SET "totalMarks" = (
  SELECT COALESCE(SUM(marks), 0) 
  FROM "Question" 
  WHERE "quizId" = q.id
);

-- Update existing response totalMarks based on quiz totalMarks
UPDATE "Response" r 
SET "totalMarks" = (
  SELECT "totalMarks" 
  FROM "Quiz" 
  WHERE id = r."quizId"
);
