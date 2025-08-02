-- Add subject column to Question table
ALTER TABLE "Question" ADD COLUMN "subject" TEXT NOT NULL DEFAULT 'General';

-- Update default value to be empty after adding the column
ALTER TABLE "Question" ALTER COLUMN "subject" DROP DEFAULT;
