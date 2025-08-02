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
exports.getUserAttemptedQuizzes = exports.getQuizQuestions = exports.getQuizMetadata = exports.getResponseDetails = exports.getQuizzes = exports.getQuiz = exports.searchQuizzes = exports.getQuizLeaderboard = exports.submitQuiz = exports.makeQuizPublic = exports.validateQuizPassword = exports.deleteQuestion = exports.updateQuestion = exports.addQuestion = exports.deleteQuiz = exports.updateQuiz = exports.createQuiz = void 0;
const db_1 = __importDefault(require("../config/db"));
const client_1 = require("@prisma/client");
const s3_1 = require("../config/s3");
const validateQuestion = (question) => {
    if (!question.type)
        return false;
    // For CreateQuestionRequest, subject is required
    if ('text' in question && !('subject' in question && question.subject)) {
        return false;
    }
    switch (question.type) {
        case "SINGLE_SELECT":
            return (Array.isArray(question.options) &&
                question.options.length > 0 &&
                typeof question.correctAnswer === "number" &&
                question.correctAnswer >= 0 &&
                question.correctAnswer < question.options.length);
        case "MULTIPLE_SELECT":
            return (Array.isArray(question.options) &&
                question.options.length > 0 &&
                Array.isArray(question.correctAnswer) &&
                question.correctAnswer.length > 0 &&
                question.correctAnswer.every((idx) => { var _a; return typeof idx === "number" && idx >= 0 && idx < (((_a = question.options) === null || _a === void 0 ? void 0 : _a.length) || 0); }));
        case "FILL_IN_BLANK":
            return (Array.isArray(question.correctAnswer) &&
                question.correctAnswer.length > 0 &&
                question.correctAnswer.every((answer) => typeof answer === "string" && answer.trim().length > 0));
        case "INTEGER":
            return typeof question.correctAnswer === "number";
        default:
            return false;
    }
};
const calculateScore = (questions, answers) => {
    let score = 0;
    let totalMarks = 0;
    questions.forEach((question) => {
        totalMarks += question.marks || 1;
        const answer = answers.find((a) => a.questionId === question.id);
        if (!answer)
            return;
        let isCorrect = false;
        let partialScore = 0;
        switch (question.type) {
            case "SINGLE_SELECT":
                isCorrect = answer.answer === question.correctAnswer;
                if (isCorrect) {
                    score += question.marks || 1;
                }
                break;
            case "MULTIPLE_SELECT":
                if (Array.isArray(answer.answer) &&
                    Array.isArray(question.correctAnswer)) {
                    const correctAnswers = question.correctAnswer;
                    const userAnswers = answer.answer;
                    // Calculate partial score based only on correct selections
                    const correctCount = userAnswers.filter((a) => correctAnswers.includes(a)).length;
                    // Award partial marks based on correct selections only
                    const questionMarks = question.marks || 1;
                    const marksPerOption = questionMarks / correctAnswers.length;
                    // Only award marks for correct selections
                    partialScore = correctCount * marksPerOption;
                    score += partialScore;
                }
                break;
            case "FILL_IN_BLANK":
                if (Array.isArray(question.correctAnswer)) {
                    // Check if user's answer matches any of the correct answers
                    const userAnswer = String(answer.answer).trim().toLowerCase();
                    const correctAnswers = question.correctAnswer.map((ans) => ans.trim().toLowerCase());
                    isCorrect = correctAnswers.includes(userAnswer);
                }
                else {
                    // Backward compatibility
                    isCorrect = answer.answer === question.correctAnswer;
                }
                if (isCorrect) {
                    score += question.marks || 1;
                }
                break;
            case "INTEGER":
                isCorrect = Number(answer.answer) === question.correctAnswer;
                if (isCorrect) {
                    score += question.marks || 1;
                }
                break;
        }
    });
    return { score, totalMarks };
};
const createQuiz = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { title, description, duration, isPublic, password, questions } = req.body;
        if (!req.user) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        // Calculate total marks from questions
        const totalMarks = questions.reduce((sum, q) => sum + (q.marks || 1), 0);
        const quiz = yield db_1.default.quiz.create({
            data: {
                title,
                description,
                duration,
                isPublic: isPublic !== null && isPublic !== void 0 ? isPublic : false,
                password: password || null,
                teacherId: req.user.id,
                totalMarks,
                questions: {
                    create: questions.map((q) => ({
                        text: q.text,
                        type: q.type,
                        options: q.options,
                        correctAnswer: q.correctAnswer,
                        marks: q.marks || 1,
                        subject: q.subject,
                        explanation: q.explanation,
                        answerLink: q.answerLink,
                        difficulty: q.difficulty || 'MEDIUM',
                        tags: q.tags || [],
                    })),
                },
            },
            include: {
                questions: true,
                images: true,
            },
        });
        return res.status(201).json(quiz);
    }
    catch (error) {
        console.error("Error creating quiz:", error);
        return res.status(500).json({ error: "Failed to create quiz" });
    }
});
exports.createQuiz = createQuiz;
const updateQuiz = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { title, description, duration, isPublic, password, imagesToDelete } = req.body;
        if (!req.user) {
            res.status(401).json({ message: "Unauthorized" });
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
            },
        });
        if (!existingQuiz) {
            res.status(404).json({ message: "Quiz not found" });
            return;
        }
        if (existingQuiz.teacherId !== req.user.id) {
            res.status(403).json({ message: "You can only update your own quizzes" });
            return;
        }
        // Delete specified images if any
        if (imagesToDelete && imagesToDelete.length > 0) {
            const imagesToRemove = existingQuiz.images.filter((img) => imagesToDelete.includes(img.id));
            // Delete images from S3
            const deletePromises = imagesToRemove.map((image) => {
                const key = image.imageUrl.split("/").pop();
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
                        in: imagesToDelete,
                    },
                },
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
            },
        });
        res.json({
            message: "Quiz updated successfully",
            quiz: updatedQuiz,
        });
    }
    catch (error) {
        console.error("Update quiz error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});
exports.updateQuiz = updateQuiz;
const deleteQuiz = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        if (!req.user) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        // Check if quiz exists and belongs to the teacher
        const existingQuiz = yield db_1.default.quiz.findUnique({
            where: { id },
            include: {
                images: true,
                questions: {
                    include: {
                        images: true,
                    },
                },
            },
        });
        if (!existingQuiz) {
            res.status(404).json({ message: "Quiz not found" });
            return;
        }
        if (existingQuiz.teacherId !== req.user.id) {
            res.status(403).json({ message: "You can only delete your own quizzes" });
            return;
        }
        // Delete all images from S3
        const deletePromises = [];
        // Delete quiz images
        for (const image of existingQuiz.images) {
            const key = image.imageUrl.split("/").pop();
            if (key) {
                deletePromises.push((0, s3_1.deleteFromS3)(key));
            }
        }
        // Delete question images
        for (const question of existingQuiz.questions) {
            for (const image of question.images) {
                const key = image.imageUrl.split("/").pop();
                if (key) {
                    deletePromises.push((0, s3_1.deleteFromS3)(key));
                }
            }
        }
        // Wait for all image deletions to complete
        yield Promise.all(deletePromises);
        // Delete all questions associated with the quiz
        yield db_1.default.question.deleteMany({
            where: { quizId: id },
        });
        // Then delete the quiz
        yield db_1.default.quiz.delete({
            where: { id },
        });
        res.json({
            message: "Quiz and all associated images deleted successfully",
        });
    }
    catch (error) {
        console.error("Delete quiz error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});
exports.deleteQuiz = deleteQuiz;
const addQuestion = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { quizId } = req.params;
        const question = req.body;
        if (!validateQuestion(question)) {
            return res.status(400).json({ error: "Invalid question format" });
        }
        const quiz = yield db_1.default.quiz.findUnique({
            where: { id: quizId },
            include: { questions: true },
        });
        if (!quiz) {
            return res.status(404).json({ error: "Quiz not found" });
        }
        if (quiz.teacherId !== req.user.id) {
            return res.status(403).json({ error: "Not authorized" });
        }
        const newQuestion = yield db_1.default.question.create({
            data: {
                text: question.text,
                type: question.type,
                options: question.options,
                correctAnswer: question.correctAnswer,
                marks: question.marks || 1,
                subject: question.subject,
                explanation: question.explanation,
                answerLink: question.answerLink,
                difficulty: question.difficulty || 'MEDIUM',
                tags: question.tags || [],
                quizId,
            },
            include: {
                images: true, // Include question images
            },
        });
        return res.status(201).json(newQuestion);
    }
    catch (error) {
        console.error("Error adding question:", error);
        return res.status(500).json({ error: "Failed to add question" });
    }
});
exports.addQuestion = addQuestion;
const updateQuestion = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { quizId, questionId } = req.params;
        const updates = req.body;
        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: "No updates provided" });
        }
        const question = yield db_1.default.question.findUnique({
            where: { id: questionId },
            include: {
                quiz: true,
                images: true, // Include question images
            },
        });
        if (!question) {
            return res.status(404).json({ error: "Question not found" });
        }
        if (question.quiz.teacherId !== req.user.id) {
            return res.status(403).json({ error: "Not authorized" });
        }
        // If type is being updated, validate the new type with correctAnswer
        if (updates.type || updates.correctAnswer !== undefined) {
            const validationQuestion = Object.assign(Object.assign(Object.assign({}, question), updates), { type: updates.type || question.type, correctAnswer: (_a = updates.correctAnswer) !== null && _a !== void 0 ? _a : question.correctAnswer, options: updates.options || question.options, subject: updates.subject || question.subject, text: updates.text || question.text });
            if (!validateQuestion(validationQuestion)) {
                return res.status(400).json({ error: "Invalid question format" });
            }
        }
        const updatedQuestion = yield db_1.default.question.update({
            where: { id: questionId },
            data: Object.assign(Object.assign({}, updates), { correctAnswer: updates.correctAnswer !== undefined ? updates.correctAnswer : undefined }),
            include: {
                images: true, // Include question images
            },
        });
        return res.json(updatedQuestion);
    }
    catch (error) {
        console.error("Error updating question:", error);
        return res.status(500).json({ error: "Failed to update question" });
    }
});
exports.updateQuestion = updateQuestion;
const deleteQuestion = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { questionId } = req.params;
        if (!req.user) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        // Get the question with its quiz and images to check ownership
        const question = yield db_1.default.question.findUnique({
            where: { id: questionId },
            include: {
                quiz: true,
                images: true,
            },
        });
        if (!question) {
            res.status(404).json({ message: "Question not found" });
            return;
        }
        if (question.quiz.teacherId !== req.user.id) {
            res.status(403).json({
                message: "You can only delete questions from your own quizzes",
            });
            return;
        }
        // Delete all images from S3
        const deletePromises = question.images.map((image) => {
            const key = image.imageUrl.split("/").pop();
            if (key) {
                return (0, s3_1.deleteFromS3)(key);
            }
            return Promise.resolve();
        });
        // Wait for all image deletions to complete
        yield Promise.all(deletePromises);
        // Delete question
        yield db_1.default.question.delete({
            where: { id: questionId },
        });
        res.json({
            message: "Question and all associated images deleted successfully",
        });
    }
    catch (error) {
        console.error("Delete question error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});
exports.deleteQuestion = deleteQuestion;
const validateQuizPassword = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { password } = req.body;
        if (!password) {
            return res.status(400).json({ error: "Password is required" });
        }
        const quiz = yield db_1.default.quiz.findUnique({
            where: { id },
        });
        if (!quiz) {
            return res.status(404).json({ error: "Quiz not found" });
        }
        if (!quiz.password) {
            return res
                .status(400)
                .json({ error: "This quiz does not require a password" });
        }
        if (quiz.password !== password) {
            return res.status(401).json({ error: "Invalid password" });
        }
        return res.json({ message: "Password validated successfully" });
    }
    catch (error) {
        console.error("Error validating password:", error);
        return res.status(500).json({ error: "Failed to validate password" });
    }
});
exports.validateQuizPassword = validateQuizPassword;
const makeQuizPublic = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        if (!req.user) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const quiz = yield db_1.default.quiz.findUnique({
            where: { id },
        });
        if (!quiz) {
            return res.status(404).json({ error: "Quiz not found" });
        }
        if (quiz.teacherId !== req.user.id) {
            return res
                .status(403)
                .json({ error: "You can only make your own quizzes public" });
        }
        const updatedQuiz = yield db_1.default.quiz.update({
            where: { id },
            data: { isPublic: true },
        });
        return res.json({ message: "Quiz is now public", quiz: updatedQuiz });
    }
    catch (error) {
        console.error("Error making quiz public:", error);
        return res.status(500).json({ error: "Failed to make quiz public" });
    }
});
exports.makeQuizPublic = makeQuizPublic;
const submitQuiz = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { quizId } = req.params;
        const { answers } = req.body;
        if (!req.user) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        // Check if user has already submitted this quiz
        const existingResponse = yield db_1.default.response.findFirst({
            where: {
                quizId: quizId,
                userId: req.user.id,
            },
        });
        if (existingResponse) {
            return res
                .status(400)
                .json({ error: "You have already submitted this quiz" });
        }
        // Get quiz with questions to validate answers
        const quiz = yield db_1.default.quiz.findUnique({
            where: { id: quizId },
            include: {
                questions: true,
            },
        });
        if (!quiz) {
            return res.status(404).json({ error: "Quiz not found" });
        }
        // Calculate score
        const { score, totalMarks } = calculateScore(quiz.questions, answers);
        // Create response and increment uniqueAttempts in a transaction
        const [response] = yield db_1.default.$transaction([
            db_1.default.response.create({
                data: {
                    quizId,
                    userId: req.user.id,
                    answers,
                    score,
                    totalMarks,
                },
            }),
            db_1.default.quiz.update({
                where: { id: quizId },
                data: {
                    uniqueAttempts: {
                        increment: 1,
                    },
                },
            }),
        ]);
        return res.json({
            message: "Quiz submitted successfully",
            score,
            totalMarks,
            percentage: Math.round((score / totalMarks) * 100),
        });
    }
    catch (error) {
        console.error("Error submitting quiz:", error);
        return res.status(500).json({ error: "Failed to submit quiz" });
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
                                email: true,
                            },
                        },
                    },
                    orderBy: {
                        score: "desc",
                    },
                },
                _count: {
                    select: {
                        questions: true,
                    },
                },
            },
        });
        if (!quiz) {
            return res.status(404).json({ error: "Quiz not found" });
        }
        // Format leaderboard data
        const leaderboard = quiz.responses.map((response, index) => ({
            rank: index + 1,
            userId: response.userId,
            email: response.user.email,
            score: response.score,
            totalQuestions: quiz._count.questions,
            percentage: Math.round((response.score / quiz._count.questions) * 100),
            submittedAt: response.createdAt,
        }));
        return res.json({
            quizTitle: quiz.title,
            totalParticipants: leaderboard.length,
            leaderboard,
        });
    }
    catch (error) {
        console.error("Error fetching leaderboard:", error);
        return res.status(500).json({ error: "Failed to fetch leaderboard" });
    }
});
exports.getQuizLeaderboard = getQuizLeaderboard;
const prismaClient = new client_1.PrismaClient();
const searchQuizzes = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { searchTerm, sortBy = "createdAt", sortOrder = "desc", page = "1", limit = "10", teacherId, classId, isPublic, } = req.query;
        const where = {};
        if (searchTerm) {
            where.OR = [
                { title: { contains: searchTerm, mode: "insensitive" } },
                {
                    description: { contains: searchTerm, mode: "insensitive" },
                },
            ];
        }
        if (teacherId) {
            where.teacherId = teacherId;
        }
        if (classId) {
            where.classId = classId;
        }
        if (isPublic !== undefined) {
            where.isPublic = isPublic === "true";
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
                            email: true,
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
        console.error("Error searching quizzes:", error);
        res.status(500).json({ message: "Internal server error" });
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
            return res.status(404).json({ error: "Quiz not found" });
        }
        // If quiz is not public and user is not the teacher, check password
        if (!quiz.isPublic && quiz.teacherId !== ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id)) {
            return res.status(403).json({ error: "Quiz is not public" });
        }
        res.json(quiz);
    }
    catch (error) {
        console.error("Error getting quiz:", error);
        res.status(500).json({ error: "Failed to get quiz" });
    }
});
exports.getQuiz = getQuiz;
const getQuizzes = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const quizzes = yield db_1.default.quiz.findMany({
            where: {
                OR: [{ isPublic: true }, { teacherId: (_a = req.user) === null || _a === void 0 ? void 0 : _a.id }],
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
                createdAt: "desc",
            },
        });
        res.json(quizzes);
    }
    catch (error) {
        console.error("Error getting quizzes:", error);
        res.status(500).json({ error: "Failed to get quizzes" });
    }
});
exports.getQuizzes = getQuizzes;
const getResponseDetails = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { quizId, responseId } = req.params;
        if (!req.user) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        // Get response with quiz and questions
        const response = yield db_1.default.response.findMany({
            where: {
                quizId: quizId,
            },
            include: {
                quiz: {
                    include: {
                        questions: true,
                    },
                },
            },
        });
        if (!response) {
            return res.status(404).json({ error: "Response not found" });
        }
        // Check if user is authorized to view this response
        const responseDetails = [];
        response.map((e) => {
            var _a, _b;
            if (e.quiz.teacherId == ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) || e.userId == ((_b = req.user) === null || _b === void 0 ? void 0 : _b.id)) {
                responseDetails.push({
                    quizTitle: e.quiz.title,
                    score: e.score,
                    totalMarks: e.totalMarks,
                    percentage: Math.round((e.score / e.totalMarks) * 100),
                    submittedAt: e.createdAt,
                    questions: e.quiz.questions.map((question) => {
                        const userAnswers = e.answers;
                        const userAnswer = userAnswers.find((a) => a.questionId === question.id);
                        let isCorrect = false;
                        let obtainedMarks = 0;
                        // Calculate if answer is correct and marks obtained
                        switch (question.type) {
                            case "SINGLE_SELECT":
                                isCorrect = (userAnswer === null || userAnswer === void 0 ? void 0 : userAnswer.answer) === question.correctAnswer;
                                obtainedMarks = isCorrect ? question.marks : 0;
                                break;
                            case "MULTIPLE_SELECT":
                                if (Array.isArray(userAnswer === null || userAnswer === void 0 ? void 0 : userAnswer.answer) &&
                                    Array.isArray(question.correctAnswer)) {
                                    const correctAnswers = question.correctAnswer;
                                    const correctCount = userAnswer.answer.filter((a) => correctAnswers.includes(a)).length;
                                    const marksPerOption = question.marks / correctAnswers.length;
                                    obtainedMarks = correctCount * marksPerOption;
                                    isCorrect = correctCount === correctAnswers.length;
                                }
                                break;
                            case "FILL_IN_BLANK":
                                if (Array.isArray(question.correctAnswer)) {
                                    // Check if user's answer matches any of the correct answers
                                    const userAnswerStr = String(userAnswer === null || userAnswer === void 0 ? void 0 : userAnswer.answer).trim().toLowerCase();
                                    const correctAnswers = question.correctAnswer.map((ans) => ans.trim().toLowerCase());
                                    isCorrect = correctAnswers.includes(userAnswerStr);
                                }
                                else {
                                    // Backward compatibility
                                    isCorrect = (userAnswer === null || userAnswer === void 0 ? void 0 : userAnswer.answer) === question.correctAnswer;
                                }
                                obtainedMarks = isCorrect ? question.marks : 0;
                                break;
                            case "INTEGER":
                                isCorrect =
                                    Number(userAnswer === null || userAnswer === void 0 ? void 0 : userAnswer.answer) === question.correctAnswer;
                                obtainedMarks = isCorrect ? question.marks : 0;
                                break;
                        }
                        return {
                            id: question.id,
                            text: question.text,
                            type: question.type,
                            options: question.options,
                            correctAnswer: question.correctAnswer,
                            userAnswer: userAnswer === null || userAnswer === void 0 ? void 0 : userAnswer.answer,
                            isCorrect,
                            marks: question.marks,
                            obtainedMarks,
                        };
                    }),
                });
            }
        });
        // Format response details
        return res.json(responseDetails);
    }
    catch (error) {
        console.error("Error getting response details:", error);
        return res.status(500).json({ error: "Failed to get response details" });
    }
});
exports.getResponseDetails = getResponseDetails;
const getQuizMetadata = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        if (!req.user) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const quiz = yield db_1.default.quiz.findUnique({
            where: { id },
            include: {
                teacher: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                    },
                },
                images: true,
                _count: {
                    select: {
                        questions: true,
                    },
                },
            },
        });
        if (!quiz) {
            return res.status(404).json({ error: "Quiz not found" });
        }
        // Check if user is authorized to view this quiz
        if (!quiz.isPublic && quiz.teacherId !== req.user.id) {
            return res
                .status(403)
                .json({ error: "Not authorized to view this quiz" });
        }
        // Return only metadata
        return res.json({
            id: quiz.id,
            title: quiz.title,
            description: quiz.description,
            duration: quiz.duration,
            isPublic: quiz.isPublic,
            totalMarks: quiz.totalMarks,
            uniqueAttempts: quiz.uniqueAttempts,
            createdAt: quiz.createdAt,
            updatedAt: quiz.updatedAt,
            teacher: quiz.teacher,
            images: quiz.images,
            questionCount: quiz._count.questions,
        });
    }
    catch (error) {
        console.error("Error getting quiz metadata:", error);
        return res.status(500).json({ error: "Failed to get quiz metadata" });
    }
});
exports.getQuizMetadata = getQuizMetadata;
const getQuizQuestions = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        if (!req.user) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const quiz = yield db_1.default.quiz.findUnique({
            where: { id },
            include: {
                questions: {
                    include: {
                        images: true,
                    },
                },
            },
        });
        if (!quiz) {
            return res.status(404).json({ error: "Quiz not found" });
        }
        // Check if user is authorized to view this quiz
        if (!quiz.isPublic && quiz.teacherId !== req.user.id) {
            return res
                .status(403)
                .json({ error: "Not authorized to view this quiz" });
        }
        // Return questions without correct answers
        const questions = quiz.questions.map((question) => ({
            id: question.id,
            text: question.text,
            type: question.type,
            options: question.options,
            marks: question.marks,
            images: question.images,
        }));
        return res.json({
            quizId: quiz.id,
            title: quiz.title,
            questions,
        });
    }
    catch (error) {
        console.error("Error getting quiz questions:", error);
        return res.status(500).json({ error: "Failed to get quiz questions" });
    }
});
exports.getQuizQuestions = getQuizQuestions;
const getUserAttemptedQuizzes = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.user) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        // Get all responses for the user with quiz details
        const responses = yield db_1.default.response.findMany({
            where: {
                userId: req.user.id,
            },
            include: {
                quiz: {
                    include: {
                        teacher: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                            },
                        },
                        _count: {
                            select: {
                                questions: true,
                            },
                        },
                    },
                },
            },
            orderBy: {
                createdAt: "desc",
            },
        });
        // Format the response
        const attemptedQuizzes = responses.map((response) => ({
            quizId: response.quiz.id,
            quizTitle: response.quiz.title,
            teacher: response.quiz.teacher,
            score: response.score,
            totalMarks: response.totalMarks,
            percentage: Math.round((response.score / response.totalMarks) * 100),
            totalQuestions: response.quiz._count.questions,
            submittedAt: response.createdAt,
        }));
        return res.json({
            totalAttempts: attemptedQuizzes.length,
            quizzes: attemptedQuizzes,
        });
    }
    catch (error) {
        console.error("Error getting user attempted quizzes:", error);
        return res.status(500).json({ error: "Failed to get attempted quizzes" });
    }
});
exports.getUserAttemptedQuizzes = getUserAttemptedQuizzes;
