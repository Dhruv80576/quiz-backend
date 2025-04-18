"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const quiz_1 = require("../controllers/quiz");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Quiz routes
router.post('/', auth_1.authenticateToken, auth_1.verifyTeacher, quiz_1.createQuiz);
router.put('/:id', auth_1.authenticateToken, auth_1.verifyTeacher, quiz_1.updateQuiz);
router.delete('/:id', auth_1.authenticateToken, auth_1.verifyTeacher, quiz_1.deleteQuiz);
// Question routes
router.post('/:quizId/questions', auth_1.authenticateToken, auth_1.verifyTeacher, quiz_1.addQuestion);
router.put('/questions/:questionId', auth_1.authenticateToken, auth_1.verifyTeacher, quiz_1.updateQuestion);
router.delete('/questions/:questionId', auth_1.authenticateToken, auth_1.verifyTeacher, quiz_1.deleteQuestion);
exports.default = router;
