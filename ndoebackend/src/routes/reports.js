const router = require('express').Router();
const ctrl = require('../controllers/reports');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/dashboard', ctrl.getDashboard);
router.get('/transactions', ctrl.getTransactions);

module.exports = router;
