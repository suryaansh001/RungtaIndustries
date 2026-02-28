const router = require('express').Router();
const ctrl = require('../controllers/export');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/products', ctrl.exportProducts);
router.get('/clients', ctrl.exportClients);
router.get('/invoices', ctrl.exportInvoices);

module.exports = router;
