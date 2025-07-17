const { getUser } = require('../services/auth/authService');
const path = require('path');
const fs = require("fs");

async function verifyAuth(req, res, next) {
  const token = req.cookies.access_token;

  if (!token) {
    return res.sendFile(path.join(__dirname, '..', 'public', 'login.html'));
  }

  const { data, error } = await getUser(token);

  if (error || !data?.user) {
    res.clearCookie('access_token');
    return res.redirect('/login');
  }

  const openRoutes = ['/', '/login', '/signup'];
  if (openRoutes.includes(req.path)) {
    return res.redirect('/dashboard');
  }

  req.user = data.user;
  next();
}

module.exports = verifyAuth;
