const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/clients');
const { protect } = require('../middleware/auth');
const { atLeast } = require('../middleware/rbac');
const validate = require('../middleware/validate');

router.use(protect);
router.get('/', ctrl.getAll);
router.post('/', atLeast('manager'), [
  body('name').trim().notEmpty().withMessage('Client name is required'),
  body('gst_number').optional({ nullable: true }).trim(),
  body('mobile').optional().trim(),
  body('contact_person').optional().trim(),
  body('address').optional().trim(),
], validate, ctrl.create);
router.put('/:id', atLeast('manager'), ctrl.update);
router.delete('/:id', atLeast('manager'), ctrl.remove);
router.get('/:id/outstanding', ctrl.getOutstanding);

module.exports = router;
