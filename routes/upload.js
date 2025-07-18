const express = require('express');
const router = express.Router();
const verifyAuth = require('../middlewares/authMiddleware');

// All upload routes require authentication
router.use(verifyAuth);

// POST /api/upload - Handle file uploads
router.post('/', (req, res) => {
  res.json({
    success: true,
    message: 'Upload routes - Coming soon',
    data: null
  });
});

module.exports = router;