# CorrectAnswer Field Migration Notes

## Overview
Updated the `correctAnswer` field in the Question model from `Int` to `Json` to support multiple correct answers for different question types.

## Changes Made

### 1. Database Schema (prisma/schema.prisma)
- **Before**: `correctAnswer Int`
- **After**: `correctAnswer Json`
- **Comment Updated**: Now supports different data types based on question type

### 2. Database Migration
- Created migration: `20250730104232_update_correct_answer_to_json`
- **Note**: This migration will drop and recreate the column, so existing data will be lost

### 3. Data Structure by Question Type

#### SINGLE_SELECT
- **Format**: `number` (index of correct option, 0-based)
- **Example**: `2` (third option is correct)

#### MULTIPLE_SELECT  
- **Format**: `number[]` (array of indices for correct options, 0-based)
- **Example**: `[0, 2, 3]` (first, third, and fourth options are correct)

#### FILL_IN_BLANK
- **Format**: `string[]` (array of possible correct answers)
- **Example**: `["answer1", "answer 1", "Answer 1"]` (accepts multiple variations)

#### INTEGER
- **Format**: `number` (exact numeric answer)
- **Example**: `42`

### 4. Code Changes

#### Controllers Updated:
1. **quiz.ts**:
   - Updated interfaces: `CreateQuizRequest`, `CreateQuestionRequest`, `UpdateQuestionRequest`, `QuestionResponse`
   - Modified `validateQuestion()` function to handle new data types
   - Enhanced `calculateScore()` function for improved scoring logic
   - Added type casting (`as any`) for Prisma operations

2. **genai.ts**:
   - Updated AI prompt to generate questions with new correctAnswer format
   - Added detailed instructions for each question type

### 5. Scoring Logic Improvements

#### SINGLE_SELECT
- Full marks if answer matches the correct index

#### MULTIPLE_SELECT
- Partial scoring based on correct selections only
- Marks = (correct_selections / total_correct_options) * question_marks

#### FILL_IN_BLANK
- Case-insensitive matching against any acceptable answer
- Full marks if user's answer matches any correct answer

#### INTEGER
- Full marks if numeric answer matches exactly

### 6. Validation Logic

The `validateQuestion()` function now properly validates:
- **SINGLE_SELECT**: Ensures correctAnswer is a valid option index
- **MULTIPLE_SELECT**: Ensures correctAnswer is array of valid option indices
- **FILL_IN_BLANK**: Ensures correctAnswer is array of non-empty strings
- **INTEGER**: Ensures correctAnswer is a number

### 7. Migration Steps

1. Update schema: ✅ Done
2. Run migration: ✅ Done (`npx prisma migrate dev`)
3. Generate client: ✅ Done (`npx prisma generate`)
4. Update TypeScript types: ✅ Done
5. Update validation logic: ✅ Done
6. Update scoring logic: ✅ Done

### 8. Breaking Changes

**⚠️ Important**: This is a breaking change for existing questions in the database.

**Before migration**, you should:
1. Export existing question data
2. Convert correctAnswer values to new format:
   - SINGLE_SELECT: Keep as number
   - MULTIPLE_SELECT: Convert single number to array `[number]`
   - FILL_IN_BLANK: Convert to array of strings `["answer"]`
   - INTEGER: Keep as number
3. Re-import data after migration

### 9. API Examples

#### Creating a Single Select Question:
```json
{
  "text": "What is 2+2?",
  "type": "SINGLE_SELECT",
  "options": ["3", "4", "5", "6"],
  "correctAnswer": 1,
  "subject": "Mathematics"
}
```

#### Creating a Multiple Select Question:
```json
{
  "text": "Which are prime numbers?",
  "type": "MULTIPLE_SELECT", 
  "options": ["2", "3", "4", "5"],
  "correctAnswer": [0, 1, 3],
  "subject": "Mathematics"
}
```

#### Creating a Fill-in-Blank Question:
```json
{
  "text": "The capital of France is ____",
  "type": "FILL_IN_BLANK",
  "options": [],
  "correctAnswer": ["Paris", "paris", "PARIS"],
  "subject": "Geography"
}
```

#### Creating an Integer Question:
```json
{
  "text": "How many sides does a triangle have?",
  "type": "INTEGER",
  "options": [],
  "correctAnswer": 3,
  "subject": "Mathematics"
}
```

### 10. Testing Recommendations

1. Test question creation for each type
2. Test question validation
3. Test quiz submission and scoring
4. Test AI generation with new format
5. Verify backward compatibility where possible

## Files Modified
- `prisma/schema.prisma`
- `prisma/migrations/20250730104232_update_correct_answer_to_json/migration.sql`
- `src/controllers/quiz.ts`
- `src/controllers/genai.ts`
