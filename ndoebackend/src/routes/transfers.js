const router = require('express').Router();
const ctrl = require('../controllers/transfers');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getOne);
router.post('/', authorize('admin', 'operator'), ctrl.create);

module.exports = router;
