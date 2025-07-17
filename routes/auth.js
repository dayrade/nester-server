const express = require("express");
const router = express.Router();
const {signInApi, signUpApi, logout, resetPasswordApi} = require("../controller/authController");
const verifyAuth = require('../middlewares/authMiddleware');

// POST /api/auth/signup
router.post("/signup", signUpApi);
// POST /api/auth/login
router.post("/login", signInApi);
// POST /api/auth/reset-password
router.post("/reset-password", resetPasswordApi);
// GET /api/auth/logout
router.get("/logout", logout);

module.exports = router;