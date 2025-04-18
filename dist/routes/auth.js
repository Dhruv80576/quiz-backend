"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../controllers/auth");
const auth_2 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Public routes
router.post('/signup', (req, res) => (0, auth_1.signup)(req, res));
router.post('/login', (req, res) => (0, auth_1.login)(req, res));
// Protected routes
router.get('/me', auth_2.authenticateToken, (req, res) => {
    res.json({ user: req.user });
});
exports.default = router;
