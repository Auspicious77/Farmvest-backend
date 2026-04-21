const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhook.controller');

// Paystack webhook
router.post('/paystack', webhookController.paystackWebhook);

// Monnify webhook
router.post('/monnify', webhookController.monnifyWebhook);

// PalmPay webhook
router.post('/palmpay', webhookController.palmpayWebhook);

module.exports = router;
