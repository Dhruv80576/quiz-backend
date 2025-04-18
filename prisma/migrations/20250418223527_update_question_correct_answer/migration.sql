/*
  Warnings:

  - Added the required column `type` to the `Question` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('SINGLE_SELECT', 'MULTIPLE_SELECT', 'FILL_IN_BLANK', 'INTEGER');

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "type" "QuestionType" NOT NULL;
