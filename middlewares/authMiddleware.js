const { getUser } = require('../services/auth/authService');
const path = require('path');
const fs = require("fs");

async function verifyAuth(req, res, next) {
  const token = req.cookies.access_token || req.headers.authorization?.replace('Bearer ', '');
  const isApiRoute = req.path.startsWith('/api/');

  if (!token) {
    if (isApiRoute) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'UNAUTHORIZED'
      });
    }
    return res.sendFile(path.join(__dirname, '..', 'public', 'login.html'));
  }

  const { data, error } = await getUser(token);

  if (error || !data?.user) {
    res.clearCookie('access_token');
    if (isApiRoute) {
      return res.status(401).json({
        error: 'Invalid or expired token',
        code: 'INVALID_TOKEN'
      });
    }
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
