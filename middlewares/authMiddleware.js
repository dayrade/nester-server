const { getUser } = require('../services/auth/authService');
const path = require('path');
const fs = require("fs");

async function verifyAuth(req, res, next) {
  const token = (req.cookies && req.cookies.access_token) || 
                (req.headers.authorization && req.headers.authorization.replace('Bearer ', ''));
  // Use originalUrl to get the full path, not just the relative path within the router
  const fullPath = req.originalUrl || req.path;
  const isApiRoute = fullPath.startsWith('/api/');
  
  // Check for test_mode in development environment
  const isTestMode = process.env.NODE_ENV === 'development' && 
    (req.body?.test_mode === true || req.query?.test_mode === 'true');
  
  if (isTestMode) {
    // Create a mock user for test mode
    req.user = {
      id: '2db617a1-e6b1-4d58-b6eb-37ec7476af37',
      email: 'test@example.com',
      role: 'user'
    };
    return next();
  }
  
  // Debug logging removed - middleware working correctly

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
  if (openRoutes.includes(fullPath)) {
    return res.redirect('/dashboard');
  }

  req.user = data.user;
  next();
}

module.exports = verifyAuth;
