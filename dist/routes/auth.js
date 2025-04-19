"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../controllers/auth");
const googleAuth_1 = require("../middleware/googleAuth");
const auth_2 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Public routes
router.post('/signup', (req, res) => (0, auth_1.signup)(req, res));
router.post('/login', (req, res) => (0, auth_1.login)(req, res));
router.post('/google', googleAuth_1.verifyGoogleToken, auth_1.googleLogin);
// Protected route
router.get('/me', auth_2.authenticateToken, (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    res.json({ user: req.user });
});
exports.default = router;
