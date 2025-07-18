const express = require('express');
const router = express.Router();
const verifyAuth = require('../middlewares/authMiddleware');

// All chat routes require authentication
router.use(verifyAuth);

// GET /api/chat - Get chat sessions
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Chat routes - Coming soon',
    data: null
  });
});

module.exports = router;