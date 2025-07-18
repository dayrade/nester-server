const express = require('express');
const router = express.Router();
const verifyAuth = require('../middlewares/authMiddleware');

// All brand routes require authentication
router.use(verifyAuth);

// GET /api/brands - Get brand settings
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Brand routes - Coming soon',
    data: null
  });
});

module.exports = router;