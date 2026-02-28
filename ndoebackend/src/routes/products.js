const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/products');
const { protect } = require('../middleware/auth');
const { atLeast } = require('../middleware/rbac');
const validate = require('../middleware/validate');

router.use(protect);
router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getOne);
router.post('/', atLeast('manager'), [
  body('name').trim().notEmpty(),
  body('client_id').isUUID(),
  body('quantity').isInt({ min: 1 }),
  body('price_per_unit').isFloat({ min: 0 }),
  body('category').isIn(['STAGE_BASED', 'DIRECT', 'stage-based', 'direct']),
  body('notes').optional().trim(),
], validate, ctrl.create);
router.put('/:id', atLeast('manager'), ctrl.update);
router.delete('/:id', atLeast('manager'), ctrl.remove);
router.patch('/:id/stage', atLeast('operator'), [
  body('notes').optional().trim(),
], validate, ctrl.updateStage);

module.exports = router;
