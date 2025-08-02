"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const quiz_1 = require("../controllers/quiz");
const router = (0, express_1.Router)();
// Get all quizzes (public and user's own)
router.get('/', auth_1.authenticateToken, (req, res) => (0, quiz_1.getQuizzes)(req, res));
// Get user's attempted quizzes
router.get('/attempted', auth_1.authenticateToken, (req, res) => (0, quiz_1.getUserAttemptedQuizzes)(req, res));
// Get quiz metadata (without questions)
router.get('/:id/metadata', auth_1.authenticateToken, (req, res) => (0, quiz_1.getQuizMetadata)(req, res));
// Get quiz questions (without answers)
router.get('/:id/questions', auth_1.authenticateToken, (req, res) => (0, quiz_1.getQuizQuestions)(req, res));
// Protected routes (require authentication)
router.post('/', auth_1.authenticateToken, (req, res) => (0, quiz_1.createQuiz)(req, res));
router.put('/:id', auth_1.authenticateToken, (req, res) => (0, quiz_1.updateQuiz)(req, res));
router.delete('/:id', auth_1.authenticateToken, (req, res) => (0, quiz_1.deleteQuiz)(req, res));
router.post('/:quizId/questions', auth_1.authenticateToken, (req, res) => (0, quiz_1.addQuestion)(req, res));
router.put('/:quizId/questions/:questionId', auth_1.authenticateToken, (req, res) => (0, quiz_1.updateQuestion)(req, res));
router.delete('/:quizId/questions/:questionId', auth_1.authenticateToken, (req, res) => (0, quiz_1.deleteQuestion)(req, res));
router.post('/:id/public', auth_1.authenticateToken, (req, res) => (0, quiz_1.makeQuizPublic)(req, res));
router.post('/:quizId/submit', auth_1.authenticateToken, (req, res) => (0, quiz_1.submitQuiz)(req, res));
// Search and filter quizzes
router.get('/search', auth_1.authenticateToken, (req, res) => (0, quiz_1.searchQuizzes)(req, res));
// Public route for password validation
router.post('/:id/validate-password', (req, res) => (0, quiz_1.validateQuizPassword)(req, res));
// Get quiz leaderboard
router.get('/:id/leaderboard', (req, res) => (0, quiz_1.getQuizLeaderboard)(req, res));
// Get response details
router.get('/:quizId/responses', auth_1.authenticateToken, quiz_1.getResponseDetails);
exports.default = router;
