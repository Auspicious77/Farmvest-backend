const express = require('express');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

// TODO: Implement history routes
// GET /api/v1/history/transactions - Get wallet transactions
// GET /api/v1/history/investments - Get investment history

router.use(protect);

router.get('/transactions', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Transaction history endpoint - To be implemented',
  });
});

router.get('/investments', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Investment history endpoint - To be implemented',
  });
});

module.exports = router;
