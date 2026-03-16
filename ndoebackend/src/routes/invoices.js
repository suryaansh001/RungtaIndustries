const router = require('express').Router();
const ctrl = require('../controllers/invoices');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.post('/', authorize('admin', 'operator'), ctrl.create);
router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getOne);
router.patch('/:id/status', authorize('admin', 'operator'), ctrl.updateStatus);

module.exports = router;
