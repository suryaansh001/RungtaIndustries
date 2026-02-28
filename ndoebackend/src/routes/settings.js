const router = require('express').Router();
const ctrl = require('../controllers/settings');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.get('/', ctrl.get);
router.put('/', authorize('admin'), ctrl.update);

module.exports = router;
