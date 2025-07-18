const express = require('express');
const router = express.Router();

// Webhooks don't require authentication as they come from external services
// POST /api/webhooks - Handle webhook callbacks
router.post('/', (req, res) => {
  res.json({
    success: true,
    message: 'Webhook routes - Coming soon',
    data: null
  });
});

module.exports = router;