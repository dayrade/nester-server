const express = require('express');
const router = express.Router();
const verifyAuth = require('../middlewares/authMiddleware');

// All social routes require authentication
router.use(verifyAuth);

// GET /api/social - Get social media integrations
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Social routes - Coming soon',
    data: null
  });
});

module.exports = router;