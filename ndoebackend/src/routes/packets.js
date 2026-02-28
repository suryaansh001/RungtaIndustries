const router = require('express').Router();
const ctrl = require('../controllers/packets');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getOne);
router.post('/', authorize('admin', 'operator'), ctrl.create);
router.put('/:id', authorize('admin', 'operator'), ctrl.update);
router.patch('/:id/dispatch', authorize('admin', 'operator'), ctrl.dispatch);

module.exports = router;
