const express = require('express');
const router = express.Router();
const verifyAuth = require('../middlewares/authMiddleware');

// All analytics routes require authentication
router.use(verifyAuth);

// GET /api/analytics - Get analytics data
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Analytics routes - Coming soon',
    data: null
  });
});

module.exports = router;