const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/AuthController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/login', AuthController.login);
router.get('/me', authMiddleware, AuthController.me);

module.exports = router;