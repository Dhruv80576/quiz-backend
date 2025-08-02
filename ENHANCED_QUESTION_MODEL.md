# Enhanced Question Model Documentation

## Overview
The Question model has been enhanced with additional fields to provide richer question metadata, explanations, and categorization capabilities.

## New Fields Added

### 1. **explanation** (String, Optional)
- **Purpose**: Detailed explanation of the correct answer
- **Use Cases**: 
  - Help students understand why an answer is correct
  - Provide educational context after quiz completion
  - Support learning and review processes
- **Example**: 
  ```json
  {
    "explanation": "Water boils at 100°C at sea level because this is the temperature at which water vapor pressure equals atmospheric pressure (1 atm)."
  }
  ```

### 2. **answerLink** (String, Optional)
- **Purpose**: URL to additional resources or reference material
- **Use Cases**:
  - Link to external resources for further learning
  - Reference scientific papers or articles
  - Point to video explanations or tutorials
- **Example**:
  ```json
  {
    "answerLink": "https://www.khanacademy.org/science/physics/thermodynamics"
  }
  ```

### 3. **difficulty** (Enum: EASY | MEDIUM | HARD)
- **Purpose**: Indicates the complexity level of the question
- **Default**: MEDIUM
- **Use Cases**:
  - Filter questions by difficulty
  - Create adaptive quizzes
  - Balance quiz complexity
- **Example**:
  ```json
  {
    "difficulty": "HARD"
  }
  ```

### 4. **tags** (String Array)
- **Purpose**: Keywords for categorization and searchability
- **Default**: Empty array `[]`
- **Use Cases**:
  - Search questions by topics
  - Create topic-specific quizzes
  - Organize question banks
- **Example**:
  ```json
  {
    "tags": ["thermodynamics", "heat transfer", "phase transition", "water"]
  }
  ```

### 5. **createdAt** (DateTime)
- **Purpose**: Timestamp when the question was created
- **Auto-generated**: Yes (default: now())

### 6. **updatedAt** (DateTime)
- **Purpose**: Timestamp when the question was last modified
- **Auto-updated**: Yes (updates automatically)

## Updated Schema Structure

```prisma
model Question {
  id            String       @id @default(uuid())
  text          String
  type          QuestionType
  options       String[]     // For single/multiple select questions
  correctAnswer Json         // Flexible answer format based on type
  marks         Int          @default(1)
  subject       String       // Academic subject
  explanation   String?      // Detailed explanation
  answerLink    String?      // URL to additional resources
  difficulty    Difficulty   @default(MEDIUM)
  tags          String[]     @default([])
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt
  quizId        String
  quiz          Quiz         @relation(fields: [quizId], references: [id])
  images        QuestionImage[]
}

enum Difficulty {
  EASY
  MEDIUM
  HARD
}
```

## API Examples

### Creating a Question with All Fields

```json
{
  "text": "What is the boiling point of water at sea level?",
  "type": "SINGLE_SELECT",
  "options": ["90°C", "95°C", "100°C", "105°C"],
  "correctAnswer": 2,
  "marks": 2,
  "subject": "Physics",
  "explanation": "Water boils at 100°C at sea level because this is the temperature at which water vapor pressure equals atmospheric pressure (1 atm).",
  "answerLink": "https://www.khanacademy.org/science/physics/thermodynamics",
  "difficulty": "MEDIUM",
  "tags": ["thermodynamics", "boiling point", "pressure", "temperature"]
}
```

### Creating a Multiple Select Question

```json
{
  "text": "Which of the following are greenhouse gases?",
  "type": "MULTIPLE_SELECT",
  "options": ["CO2", "O2", "CH4", "N2", "H2O"],
  "correctAnswer": [0, 2, 4],
  "marks": 3,
  "subject": "Environmental Science",
  "explanation": "CO2, CH4 (methane), and H2O (water vapor) are major greenhouse gases that trap heat in Earth's atmosphere.",
  "answerLink": "https://climate.nasa.gov/evidence/",
  "difficulty": "HARD",
  "tags": ["greenhouse gases", "climate change", "atmosphere", "CO2", "methane"]
}
```

### Creating a Fill-in-the-Blank Question

```json
{
  "text": "The process by which plants make their own food is called ____",
  "type": "FILL_IN_BLANK",
  "options": [],
  "correctAnswer": ["photosynthesis", "Photosynthesis", "PHOTOSYNTHESIS"],
  "marks": 1,
  "subject": "Biology",
  "explanation": "Photosynthesis is the process where plants use sunlight, water, and carbon dioxide to produce glucose and oxygen.",
  "answerLink": "https://www.biology-online.org/dictionary/photosynthesis",
  "difficulty": "EASY",
  "tags": ["photosynthesis", "plants", "biology", "glucose", "chlorophyll"]
}
```

## Benefits of Enhanced Question Model

### 1. **Better Learning Experience**
- Students get explanations for their answers
- Links to additional resources for deeper learning
- Progressive difficulty levels

### 2. **Improved Question Management**
- Better organization through tags
- Difficulty-based filtering
- Time-based tracking with timestamps

### 3. **Enhanced Analytics**
- Track question performance by difficulty
- Analyze learning patterns by tags
- Monitor content creation over time

### 4. **Content Creator Benefits**
- Rich metadata for better question quality
- Easy categorization and search
- Consistent difficulty assessment

## Migration Notes

### Database Migration
- Migration created: `20250730105302_add_question_fields`
- New enum `Difficulty` added
- All new fields are optional except `difficulty` (defaults to MEDIUM)
- Timestamps added for audit trail

### Breaking Changes
- None (all new fields are optional)
- Existing questions will work without modification
- Default values ensure backward compatibility

### TypeScript Updates
- Updated interfaces in quiz controller
- Enhanced AI generation prompts
- Type-safe difficulty enum

## Best Practices

### 1. **Writing Explanations**
- Keep explanations clear and educational
- Include the reasoning behind the correct answer
- Avoid giving away answers to related questions

### 2. **Using Tags**
- Use consistent tag naming conventions
- Include both broad and specific tags
- Consider hierarchical tagging (e.g., "physics.thermodynamics")

### 3. **Setting Difficulty**
- **EASY**: Basic recall, fundamental concepts
- **MEDIUM**: Application of concepts, moderate complexity
- **HARD**: Analysis, synthesis, complex problem-solving

### 4. **Answer Links**
- Use reputable educational sources
- Ensure links are accessible and relevant
- Consider link longevity and maintenance

## Future Enhancements

Potential future additions could include:
- Question categories/subcategories
- Estimated time to complete
- Prerequisites/dependencies
- Multimedia support metadata
- Collaborative editing features
- Version history tracking
