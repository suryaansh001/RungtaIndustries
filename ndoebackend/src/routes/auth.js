const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/auth');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: { success: false, message: 'Too many login attempts' } });

router.post('/login', loginLimiter, [
  body('username').trim().notEmpty().withMessage('username is required'),
  body('password').notEmpty().withMessage('password is required'),
], validate, ctrl.login);

router.post('/refresh', [body('refreshToken').notEmpty()], validate, ctrl.refresh);
router.post('/logout', protect, ctrl.logout);
router.get('/me', protect, ctrl.me);

module.exports = router;
