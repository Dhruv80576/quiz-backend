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
exports.getQuizzes = exports.getQuiz = exports.searchQuizzes = exports.getQuizLeaderboard = exports.submitQuiz = exports.makeQuizPublic = exports.validateQuizPassword = exports.deleteQuestion = exports.updateQuestion = exports.addQuestion = exports.deleteQuiz = exports.updateQuiz = exports.createQuiz = void 0;
const db_1 = __importDefault(require("../config/db"));
const client_1 = require("@prisma/client");
const s3_1 = require("../config/s3");
const validateQuestion = (question) => {
    if (!question.type)
        return false;
    switch (question.type) {
        case 'SINGLE_SELECT':
        case 'MULTIPLE_SELECT':
            return Array.isArray(question.options) &&
                question.options.length > 0 &&
                typeof question.correctAnswer === 'number' &&
                question.correctAnswer >= 0 &&
                question.correctAnswer < question.options.length;
        case 'FILL_IN_BLANK':
            return question.correctAnswer === 0;
        case 'INTEGER':
            return typeof question.correctAnswer === 'number';
        default:
            return false;
    }
};
const calculateScore = (questions, answers) => {
    let score = 0;
    answers.forEach(answer => {
        const question = questions.find(q => q.id === answer.questionId);
        if (!question)
            return;
        switch (question.type) {
            case 'SINGLE_SELECT':
                if (answer.answer === question.correctAnswer)
                    score++;
                break;
            case 'MULTIPLE_SELECT':
                if (Array.isArray(answer.answer) &&
                    answer.answer.length === question.correctAnswer.length &&
                    answer.answer.every(a => question.correctAnswer.includes(a))) {
                    score++;
                }
                break;
            case 'FILL_IN_BLANK':
                if (answer.answer === question.correctAnswer)
                    score++;
                break;
            case 'INTEGER':
                if (Number(answer.answer) === question.correctAnswer)
                    score++;
                break;
        }
    });
    return score;
};
const createQuiz = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { title, description, duration, isPublic, password, questions } = req.body;
        // Validate questions
        if (!questions.every(validateQuestion)) {
            return res.status(400).json({ error: 'Invalid question format' });
        }
        const quiz = yield db_1.default.quiz.create({
            data: {
                title,
                description,
                duration,
                isPublic: isPublic !== null && isPublic !== void 0 ? isPublic : false,
                password: password || null,
                teacherId: req.user.id,
                questions: {
                    create: questions.map(q => ({
                        text: q.text,
                        type: q.type,
                        options: q.options,
                        correctAnswer: q.correctAnswer
                    }))
                }
            },
            include: {
                questions: {
                    include: {
                        images: true, // Include question images
                    },
                },
                images: true, // Include quiz images
            }
        });
        return res.status(201).json(quiz);
    }
    catch (error) {
        console.error('Error creating quiz:', error);
        return res.status(500).json({ error: 'Failed to create quiz' });
    }
});
exports.createQuiz = createQuiz;
const updateQuiz = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { title, description, duration, isPublic, password, imagesToDelete } = req.body;
        if (!req.user) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        // Check if quiz exists and belongs to the teacher
        const existingQuiz = yield db_1.default.quiz.findUnique({
            where: { id },
            include: {
                questions: {
                    include: {
                        images: true,
                    },
                },
                images: true,
            }
        });
        if (!existingQuiz) {
            res.status(404).json({ message: 'Quiz not found' });
            return;
        }
        if (existingQuiz.teacherId !== req.user.id) {
            res.status(403).json({ message: 'You can only update your own quizzes' });
            return;
        }
        // Delete specified images if any
        if (imagesToDelete && imagesToDelete.length > 0) {
            const imagesToRemove = existingQuiz.images.filter(img => imagesToDelete.includes(img.id));
            // Delete images from S3
            const deletePromises = imagesToRemove.map(image => {
                const key = image.imageUrl.split('/').pop();
                if (key) {
                    return (0, s3_1.deleteFromS3)(key);
                }
                return Promise.resolve();
            });
            // Wait for all image deletions to complete
            yield Promise.all(deletePromises);
            // Delete image records from database
            yield db_1.default.quizImage.deleteMany({
                where: {
                    id: {
                        in: imagesToDelete
                    }
                }
            });
        }
        // Update quiz with only the provided fields
        const updatedQuiz = yield db_1.default.quiz.update({
            where: { id },
            data: Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, (title && { title })), (description && { description })), (duration && { duration })), (isPublic !== undefined && { isPublic })), (password !== undefined && { password: password || null })),
            include: {
                questions: {
                    include: {
                        images: true,
                    },
                },
                images: true,
            }
        });
        res.json({
            message: 'Quiz updated successfully',
            quiz: updatedQuiz
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
            where: { id },
            include: {
                images: true,
                questions: {
                    include: {
                        images: true
                    }
                }
            }
        });
        if (!existingQuiz) {
            res.status(404).json({ message: 'Quiz not found' });
            return;
        }
        if (existingQuiz.teacherId !== req.user.id) {
            res.status(403).json({ message: 'You can only delete your own quizzes' });
            return;
        }
        // Delete all images from S3
        const deletePromises = [];
        // Delete quiz images
        for (const image of existingQuiz.images) {
            const key = image.imageUrl.split('/').pop();
            if (key) {
                deletePromises.push((0, s3_1.deleteFromS3)(key));
            }
        }
        // Delete question images
        for (const question of existingQuiz.questions) {
            for (const image of question.images) {
                const key = image.imageUrl.split('/').pop();
                if (key) {
                    deletePromises.push((0, s3_1.deleteFromS3)(key));
                }
            }
        }
        // Wait for all image deletions to complete
        yield Promise.all(deletePromises);
        // Delete all questions associated with the quiz
        yield db_1.default.question.deleteMany({
            where: { quizId: id }
        });
        // Then delete the quiz
        yield db_1.default.quiz.delete({
            where: { id }
        });
        res.json({ message: 'Quiz and all associated images deleted successfully' });
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
        const question = req.body;
        if (!validateQuestion(question)) {
            return res.status(400).json({ error: 'Invalid question format' });
        }
        const quiz = yield db_1.default.quiz.findUnique({
            where: { id: quizId },
            include: { questions: true }
        });
        if (!quiz) {
            return res.status(404).json({ error: 'Quiz not found' });
        }
        if (quiz.teacherId !== req.user.id) {
            return res.status(403).json({ error: 'Not authorized' });
        }
        const newQuestion = yield db_1.default.question.create({
            data: {
                text: question.text,
                type: question.type,
                options: question.options,
                correctAnswer: question.correctAnswer,
                quizId
            },
            include: {
                images: true, // Include question images
            }
        });
        return res.status(201).json(newQuestion);
    }
    catch (error) {
        console.error('Error adding question:', error);
        return res.status(500).json({ error: 'Failed to add question' });
    }
});
exports.addQuestion = addQuestion;
const updateQuestion = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { quizId, questionId } = req.params;
        const updates = req.body;
        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'No updates provided' });
        }
        const question = yield db_1.default.question.findUnique({
            where: { id: questionId },
            include: {
                quiz: true,
                images: true, // Include question images
            }
        });
        if (!question) {
            return res.status(404).json({ error: 'Question not found' });
        }
        if (question.quiz.teacherId !== req.user.id) {
            return res.status(403).json({ error: 'Not authorized' });
        }
        // If type is being updated, validate the new type with correctAnswer
        if (updates.type || updates.correctAnswer !== undefined) {
            const validationQuestion = Object.assign(Object.assign(Object.assign({}, question), updates), { type: updates.type || question.type, correctAnswer: (_a = updates.correctAnswer) !== null && _a !== void 0 ? _a : question.correctAnswer });
            if (!validateQuestion(validationQuestion)) {
                return res.status(400).json({ error: 'Invalid question format' });
            }
        }
        const updatedQuestion = yield db_1.default.question.update({
            where: { id: questionId },
            data: updates,
            include: {
                images: true, // Include question images
            }
        });
        return res.json(updatedQuestion);
    }
    catch (error) {
        console.error('Error updating question:', error);
        return res.status(500).json({ error: 'Failed to update question' });
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
        // Get the question with its quiz and images to check ownership
        const question = yield db_1.default.question.findUnique({
            where: { id: questionId },
            include: {
                quiz: true,
                images: true
            }
        });
        if (!question) {
            res.status(404).json({ message: 'Question not found' });
            return;
        }
        if (question.quiz.teacherId !== req.user.id) {
            res.status(403).json({ message: 'You can only delete questions from your own quizzes' });
            return;
        }
        // Delete all images from S3
        const deletePromises = question.images.map(image => {
            const key = image.imageUrl.split('/').pop();
            if (key) {
                return (0, s3_1.deleteFromS3)(key);
            }
            return Promise.resolve();
        });
        // Wait for all image deletions to complete
        yield Promise.all(deletePromises);
        // Delete question
        yield db_1.default.question.delete({
            where: { id: questionId }
        });
        res.json({ message: 'Question and all associated images deleted successfully' });
    }
    catch (error) {
        console.error('Delete question error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
exports.deleteQuestion = deleteQuestion;
const validateQuizPassword = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { password } = req.body;
        if (!password) {
            return res.status(400).json({ error: 'Password is required' });
        }
        const quiz = yield db_1.default.quiz.findUnique({
            where: { id }
        });
        if (!quiz) {
            return res.status(404).json({ error: 'Quiz not found' });
        }
        if (!quiz.password) {
            return res.status(400).json({ error: 'This quiz does not require a password' });
        }
        if (quiz.password !== password) {
            return res.status(401).json({ error: 'Invalid password' });
        }
        return res.json({ message: 'Password validated successfully' });
    }
    catch (error) {
        console.error('Error validating password:', error);
        return res.status(500).json({ error: 'Failed to validate password' });
    }
});
exports.validateQuizPassword = validateQuizPassword;
const makeQuizPublic = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const quiz = yield db_1.default.quiz.findUnique({
            where: { id }
        });
        if (!quiz) {
            return res.status(404).json({ error: 'Quiz not found' });
        }
        if (quiz.teacherId !== req.user.id) {
            return res.status(403).json({ error: 'You can only make your own quizzes public' });
        }
        const updatedQuiz = yield db_1.default.quiz.update({
            where: { id },
            data: { isPublic: true }
        });
        return res.json({ message: 'Quiz is now public', quiz: updatedQuiz });
    }
    catch (error) {
        console.error('Error making quiz public:', error);
        return res.status(500).json({ error: 'Failed to make quiz public' });
    }
});
exports.makeQuizPublic = makeQuizPublic;
const submitQuiz = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { answers } = req.body;
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        // Get quiz with questions
        const quiz = yield db_1.default.quiz.findUnique({
            where: { id },
            include: { questions: true }
        });
        if (!quiz) {
            return res.status(404).json({ error: 'Quiz not found' });
        }
        // Calculate score
        const score = calculateScore(quiz.questions, answers);
        // Store response
        const response = yield db_1.default.response.create({
            data: {
                quizId: id,
                userId: req.user.id,
                answers: answers, // Type assertion for Prisma JSON field
                score: score
            }
        });
        return res.json({
            message: 'Quiz submitted successfully',
            score: score,
            totalQuestions: quiz.questions.length
        });
    }
    catch (error) {
        console.error('Error submitting quiz:', error);
        return res.status(500).json({ error: 'Failed to submit quiz' });
    }
});
exports.submitQuiz = submitQuiz;
const getQuizLeaderboard = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        // Get quiz with responses and user details
        const quiz = yield db_1.default.quiz.findUnique({
            where: { id },
            include: {
                responses: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                email: true
                            }
                        }
                    },
                    orderBy: {
                        score: 'desc'
                    }
                },
                _count: {
                    select: {
                        questions: true
                    }
                }
            }
        });
        if (!quiz) {
            return res.status(404).json({ error: 'Quiz not found' });
        }
        // Format leaderboard data
        const leaderboard = quiz.responses.map((response, index) => ({
            rank: index + 1,
            userId: response.userId,
            email: response.user.email,
            score: response.score,
            totalQuestions: quiz._count.questions,
            percentage: Math.round((response.score / quiz._count.questions) * 100),
            submittedAt: response.createdAt
        }));
        return res.json({
            quizTitle: quiz.title,
            totalParticipants: leaderboard.length,
            leaderboard
        });
    }
    catch (error) {
        console.error('Error fetching leaderboard:', error);
        return res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
});
exports.getQuizLeaderboard = getQuizLeaderboard;
const prismaClient = new client_1.PrismaClient();
const searchQuizzes = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { searchTerm, sortBy = 'createdAt', sortOrder = 'desc', page = '1', limit = '10', teacherId, classId, isPublic, } = req.query;
        const where = {};
        if (searchTerm) {
            where.OR = [
                { title: { contains: searchTerm, mode: 'insensitive' } },
                { description: { contains: searchTerm, mode: 'insensitive' } },
            ];
        }
        if (teacherId) {
            where.teacherId = teacherId;
        }
        if (classId) {
            where.classId = classId;
        }
        if (isPublic !== undefined) {
            where.isPublic = isPublic === 'true';
        }
        const pageNumber = parseInt(page, 10);
        const limitNumber = parseInt(limit, 10);
        const skip = (pageNumber - 1) * limitNumber;
        const orderBy = {
            [sortBy]: sortOrder,
        };
        const [quizzes, total] = yield Promise.all([
            prismaClient.quiz.findMany({
                where,
                orderBy,
                skip,
                take: limitNumber,
                include: {
                    teacher: {
                        select: {
                            id: true,
                            name: true,
                            email: true
                        },
                    },
                    class: {
                        select: { id: true, name: true },
                    },
                },
            }),
            prismaClient.quiz.count({ where }),
        ]);
        const totalPages = Math.ceil(total / limitNumber);
        const hasNextPage = pageNumber < totalPages;
        const hasPreviousPage = pageNumber > 1;
        res.json({
            quizzes,
            pagination: {
                total,
                totalPages,
                currentPage: pageNumber,
                limit: limitNumber,
                hasNextPage,
                hasPreviousPage,
            },
        });
    }
    catch (error) {
        console.error('Error searching quizzes:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
exports.searchQuizzes = searchQuizzes;
const getQuiz = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { id } = req.params;
        const quiz = yield db_1.default.quiz.findUnique({
            where: { id },
            include: {
                teacher: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                questions: {
                    include: {
                        images: true, // Include question images
                    },
                },
                images: true, // Include quiz images
            },
        });
        if (!quiz) {
            return res.status(404).json({ error: 'Quiz not found' });
        }
        // If quiz is not public and user is not the teacher, check password
        if (!quiz.isPublic && quiz.teacherId !== ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id)) {
            return res.status(403).json({ error: 'Quiz is not public' });
        }
        res.json(quiz);
    }
    catch (error) {
        console.error('Error getting quiz:', error);
        res.status(500).json({ error: 'Failed to get quiz' });
    }
});
exports.getQuiz = getQuiz;
const getQuizzes = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const quizzes = yield db_1.default.quiz.findMany({
            where: {
                OR: [
                    { isPublic: true },
                    { teacherId: (_a = req.user) === null || _a === void 0 ? void 0 : _a.id },
                ],
            },
            include: {
                teacher: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                images: true, // Include quiz images
                _count: {
                    select: {
                        questions: true,
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
        res.json(quizzes);
    }
    catch (error) {
        console.error('Error getting quizzes:', error);
        res.status(500).json({ error: 'Failed to get quizzes' });
    }
});
exports.getQuizzes = getQuizzes;
