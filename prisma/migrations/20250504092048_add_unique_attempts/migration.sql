-- AlterTable
ALTER TABLE "Quiz" ADD COLUMN     "uniqueAttempts" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "description" DROP NOT NULL;
