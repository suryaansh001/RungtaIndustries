const router = require('express').Router();
const ctrl = require('../controllers/invoices');
const { protect } = require('../middleware/auth');
const { atLeast } = require('../middleware/rbac');

router.use(protect);
router.post('/generate/:product_id', atLeast('manager'), ctrl.generate);
router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getOne);
router.patch('/:id/mark-paid', atLeast('manager'), ctrl.markPaid);
router.get('/:id/pdf', ctrl.downloadPdf);

module.exports = router;
