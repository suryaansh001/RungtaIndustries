const router = require('express').Router();
const ctrl = require('../controllers/coils');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getOne);
router.post('/', authorize('admin', 'operator'), ctrl.create);
router.put('/:id', authorize('admin', 'operator'), ctrl.update);
router.patch('/:id/stage', authorize('admin', 'operator'), ctrl.updateStage);

module.exports = router;
