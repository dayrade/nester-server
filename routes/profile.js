const express = require('express');
const router = express.Router();
const {
  getProfile,
  updateProfile,
  uploadAvatar,
  getProfileStats
} = require('../controller/profileController');
const verifyAuth = require('../middlewares/authMiddleware');

// All profile routes require authentication
router.use(verifyAuth);

// GET /api/profile - Get user profile
router.get('/', getProfile);

// PUT /api/profile - Update user profile
router.put('/', updateProfile);

// POST /api/profile/avatar - Upload avatar
router.post('/avatar', uploadAvatar);

// GET /api/profile/stats - Get profile statistics
router.get('/stats', getProfileStats);

module.exports = router;