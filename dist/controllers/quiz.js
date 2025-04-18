"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteQuestion = exports.updateQuestion = exports.addQuestion = exports.deleteQuiz = exports.updateQuiz = exports.createQuiz = void 0;
const db_1 = __importDefault(require("../config/db"));
const createQuiz = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { title, description, duration, isPublic = false, questions } = req.body;
        if (!req.user) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const teacherId = req.user.id;
        // Validate input
        if (!title || !description || !duration || !questions || questions.length === 0) {
            res.status(400).json({ message: 'Missing required fields' });
            return;
        }
        // Create quiz with questions
        const quiz = yield db_1.default.quiz.create({
            data: {
                title,
                description,
                duration,
                isPublic,
                teacherId,
                questions: {
                    create: questions.map((q) => ({
                        text: q.text,
                        options: q.options,
                        correctAnswer: q.correctAnswer,
                    })),
                },
            },
            include: {
                questions: true,
            },
        });
        res.status(201).json({
            message: 'Quiz created successfully',
            quiz: {
                id: quiz.id,
                title: quiz.title,
                description: quiz.description,
                duration: quiz.duration,
                isPublic: quiz.isPublic,
                questions: quiz.questions.map((q) => ({
                    id: q.id,
                    text: q.text,
                    options: q.options,
                })),
            },
        });
    }
    catch (error) {
        console.error('Create quiz error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
exports.createQuiz = createQuiz;
const updateQuiz = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { title, description, duration, isPublic } = req.body;
        if (!req.user) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        // Check if quiz exists and belongs to the teacher
        const existingQuiz = yield db_1.default.quiz.findUnique({
            where: { id }
        });
        if (!existingQuiz) {
            res.status(404).json({ message: 'Quiz not found' });
            return;
        }
        if (existingQuiz.teacherId !== req.user.id) {
            res.status(403).json({ message: 'You can only update your own quizzes' });
            return;
        }
        // Update quiz with only the provided fields
        const updatedQuiz = yield db_1.default.quiz.update({
            where: { id },
            data: Object.assign(Object.assign(Object.assign(Object.assign({}, (title && { title })), (description && { description })), (duration && { duration })), (isPublic !== undefined && { isPublic })),
            include: {
                questions: true
            }
        });
        res.json({
            message: 'Quiz updated successfully',
            quiz: {
                id: updatedQuiz.id,
                title: updatedQuiz.title,
                description: updatedQuiz.description,
                duration: updatedQuiz.duration,
                isPublic: updatedQuiz.isPublic,
                questions: updatedQuiz.questions.map((q) => ({
                    id: q.id,
                    text: q.text,
                    options: q.options,
                })),
            },
        });
    }
    catch (error) {
        console.error('Update quiz error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
exports.updateQuiz = updateQuiz;
const deleteQuiz = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        if (!req.user) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        // Check if quiz exists and belongs to the teacher
        const existingQuiz = yield db_1.default.quiz.findUnique({
            where: { id }
        });
        if (!existingQuiz) {
            res.status(404).json({ message: 'Quiz not found' });
            return;
        }
        if (existingQuiz.teacherId !== req.user.id) {
            res.status(403).json({ message: 'You can only delete your own quizzes' });
            return;
        }
        // First delete all questions associated with the quiz
        yield db_1.default.question.deleteMany({
            where: { quizId: id }
        });
        // Then delete the quiz
        yield db_1.default.quiz.delete({
            where: { id }
        });
        res.json({ message: 'Quiz deleted successfully' });
    }
    catch (error) {
        console.error('Delete quiz error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
exports.deleteQuiz = deleteQuiz;
const addQuestion = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { quizId } = req.params;
        const { text, options, correctAnswer } = req.body;
        if (!req.user) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        // Check if quiz exists and belongs to the teacher
        const quiz = yield db_1.default.quiz.findUnique({
            where: { id: quizId }
        });
        if (!quiz) {
            res.status(404).json({ message: 'Quiz not found' });
            return;
        }
        if (quiz.teacherId !== req.user.id) {
            res.status(403).json({ message: 'You can only add questions to your own quizzes' });
            return;
        }
        // Validate input
        if (!text || !options || options.length === 0 || correctAnswer === undefined) {
            res.status(400).json({ message: 'Missing required fields' });
            return;
        }
        // Create new question
        const question = yield db_1.default.question.create({
            data: {
                text,
                options,
                correctAnswer,
                quizId
            }
        });
        res.status(201).json({
            message: 'Question added successfully',
            question: {
                id: question.id,
                text: question.text,
                options: question.options
            }
        });
    }
    catch (error) {
        console.error('Add question error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
exports.addQuestion = addQuestion;
const updateQuestion = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { questionId } = req.params;
        const { text, options, correctAnswer } = req.body;
        if (!req.user) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        // Get the question with its quiz to check ownership
        const question = yield db_1.default.question.findUnique({
            where: { id: questionId },
            include: { quiz: true }
        });
        if (!question) {
            res.status(404).json({ message: 'Question not found' });
            return;
        }
        if (question.quiz.teacherId !== req.user.id) {
            res.status(403).json({ message: 'You can only update questions in your own quizzes' });
            return;
        }
        // Update question
        const updatedQuestion = yield db_1.default.question.update({
            where: { id: questionId },
            data: {
                text: text !== null && text !== void 0 ? text : question.text,
                options: options !== null && options !== void 0 ? options : question.options,
                correctAnswer: correctAnswer !== null && correctAnswer !== void 0 ? correctAnswer : question.correctAnswer
            }
        });
        res.json({
            message: 'Question updated successfully',
            question: {
                id: updatedQuestion.id,
                text: updatedQuestion.text,
                options: updatedQuestion.options
            }
        });
    }
    catch (error) {
        console.error('Update question error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
exports.updateQuestion = updateQuestion;
const deleteQuestion = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { questionId } = req.params;
        if (!req.user) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        // Get the question with its quiz to check ownership
        const question = yield db_1.default.question.findUnique({
            where: { id: questionId },
            include: { quiz: true }
        });
        if (!question) {
            res.status(404).json({ message: 'Question not found' });
            return;
        }
        if (question.quiz.teacherId !== req.user.id) {
            res.status(403).json({ message: 'You can only delete questions from your own quizzes' });
            return;
        }
        // Delete question
        yield db_1.default.question.delete({
            where: { id: questionId }
        });
        res.json({ message: 'Question deleted successfully' });
    }
    catch (error) {
        console.error('Delete question error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
exports.deleteQuestion = deleteQuestion;
