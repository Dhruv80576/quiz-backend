"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const quiz_1 = require("../controllers/quiz");
const router = (0, express_1.Router)();
// Protected routes (require authentication)
router.post('/', auth_1.authenticateToken, (req, res) => (0, quiz_1.createQuiz)(req, res));
router.put('/:id', auth_1.authenticateToken, (req, res) => (0, quiz_1.updateQuiz)(req, res));
router.delete('/:id', auth_1.authenticateToken, (req, res) => (0, quiz_1.deleteQuiz)(req, res));
router.post('/:quizId/questions', auth_1.authenticateToken, (req, res) => (0, quiz_1.addQuestion)(req, res));
router.put('/:quizId/questions/:questionId', auth_1.authenticateToken, (req, res) => (0, quiz_1.updateQuestion)(req, res));
router.delete('/:quizId/questions/:questionId', auth_1.authenticateToken, (req, res) => (0, quiz_1.deleteQuestion)(req, res));
router.post('/:id/public', auth_1.authenticateToken, (req, res) => (0, quiz_1.makeQuizPublic)(req, res));
router.post('/:id/submit', auth_1.authenticateToken, (req, res) => (0, quiz_1.submitQuiz)(req, res));
// Public route for password validation
router.post('/:id/validate-password', (req, res) => (0, quiz_1.validateQuizPassword)(req, res));
exports.default = router;
