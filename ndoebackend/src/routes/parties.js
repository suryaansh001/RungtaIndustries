const router = require('express').Router();
const ctrl = require('../controllers/parties');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getOne);
router.post('/', authorize('admin', 'operator'), ctrl.create);
router.put('/:id', authorize('admin', 'operator'), ctrl.update);
router.delete('/:id', authorize('admin'), ctrl.remove);

module.exports = router;
