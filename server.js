// Load environment variables first
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
// Gradually adding back routes
const profileRoutes = require('./routes/profile');
const propertyRoutes = require('./routes/properties');
// const brandRoutes = require('./routes/brands');
// const socialRoutes = require('./routes/social');
// const chatRoutes = require('./routes/chat');
// const analyticsRoutes = require('./routes/analytics');
// const uploadRoutes = require('./routes/upload');
// const webhookRoutes = require('./routes/webhooks');
const connectionPool = require('./config/connectionPool');
const sessionManager = require('./middlewares/sessionManager');
const performanceMonitor = require('./middlewares/performanceMonitor');

const app = express();
const PORT = process.env.EXPRESS_PORT || 3001;

// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "https://*.supabase.co", "wss://*.supabase.co"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

// CORS configuration for multiple origins
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://nester.studio',
      process.env.NEXT_PUBLIC_SITE_URL
    ].filter(Boolean);
    
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Rate limiting for API endpoints
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for certain IPs (optional)
  skip: (req) => {
    const trustedIPs = process.env.TRUSTED_IPS?.split(',') || [];
    return trustedIPs.includes(req.ip);
  }
});

// Stricter rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 50 auth requests per windowMs
  message: {
    error: 'Too many authentication attempts, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Body parsing middleware with size limits
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    // Store raw body for webhook verification if needed
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb' 
}));
app.use(cookieParser());

// Performance monitoring middleware
app.use(performanceMonitor.middleware());

// Session management middleware
app.use(sessionManager.middleware());

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms - ${req.ip}`);
  });
  next();
});

// Health check endpoint (no rate limiting)
app.get('/health', (req, res) => {
  const metrics = performanceMonitor.getMetrics();
  const poolStats = connectionPool.getAllPoolStats();
  const sessionStats = sessionManager.getSessionStats();
  
  res.status(200).json({
    status: metrics.healthStatus.status,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || '1.0.0',
    performance: {
      serverLoad: metrics.serverLoad,
      healthScore: metrics.healthStatus.score,
      activeRequests: metrics.requests.active,
      averageResponseTime: metrics.requests.averageResponseTime
    },
    database: poolStats,
    sessions: {
      total: sessionStats.total,
      active: sessionStats.active,
      uniqueUsers: sessionStats.uniqueUsers,
      utilization: sessionStats.utilization
    }
  });
});

// Performance metrics endpoint (admin only)
app.get('/admin/metrics', (req, res) => {
  // Basic auth check (in production, use proper authentication)
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${process.env.ADMIN_TOKEN}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const metrics = performanceMonitor.getMetrics();
  const poolStats = connectionPool.getAllPoolStats();
  const sessionStats = sessionManager.getSessionStats();
  const alerts = performanceMonitor.checkAlerts();
  
  res.json({
    performance: metrics,
    connectionPools: poolStats,
    sessions: sessionStats,
    alerts,
    timestamp: new Date().toISOString()
  });
});

// Session management endpoint (admin only)
app.get('/admin/sessions', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${process.env.ADMIN_TOKEN}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const stats = sessionManager.getSessionStats();
  res.json(stats);
});

// Force cleanup endpoint (admin only)
app.post('/admin/cleanup', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${process.env.ADMIN_TOKEN}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const cleanedSessions = sessionManager.cleanupExpiredSessions();
  connectionPool.cleanupIdleConnections();
  
  res.json({
    message: 'Cleanup completed',
    cleanedSessions,
    timestamp: new Date().toISOString()
  });
});

// Server status endpoint
app.get('/status', (req, res) => {
  const metrics = performanceMonitor.getMetrics();
  
  res.json({
    status: 'online',
    load: metrics.serverLoad,
    activeRequests: metrics.requests.active,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Apply rate limiting to API routes
app.use('/api', apiLimiter);
app.use('/api/auth', authLimiter);

// API documentation endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'Nester API',
    version: '1.0.0',
    description: 'AI-powered real estate marketing platform',
    endpoints: {
      auth: '/api/auth',
      properties: '/api/properties',
      profile: '/api/profile',
      brands: '/api/brands',
      social: '/api/social',
      chat: '/api/chat',
      analytics: '/api/analytics',
      upload: '/api/upload',
      webhooks: '/api/webhooks'
    },
    health: '/health'
  });
});

// Test profile endpoint without auth (before other routes)
app.get('/api/profile/test', (req, res) => {
  res.json({ 
    message: 'Profile endpoint is working!', 
    timestamp: new Date().toISOString(),
    mockProfile: {
      id: 'test-user-123',
      name: 'Test User',
      email: 'test@example.com'
    }
  });
});

// API routes
app.use('/api/auth', authRoutes);
// Gradually adding back routes
app.use('/api/profile', profileRoutes);
app.use('/api/properties', propertyRoutes);
// app.use('/api/brands', brandRoutes);
// app.use('/api/social', socialRoutes);
// app.use('/api/chat', chatRoutes);
// app.use('/api/analytics', analyticsRoutes);
// app.use('/api/upload', uploadRoutes);
// app.use('/api/webhooks', webhookRoutes);

// Serve static files with caching
app.use(express.static(path.join(__dirname, '..', 'public'), {
  maxAge: '1d', // Cache static files for 1 day
  etag: true
}));

// Basic route for testing
app.get('/', (req, res) => {
  res.json({
    message: 'Nester Backend Server is running!',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString()
  });
});

// Basic test route
app.get('/test', (req, res) => {
  res.json({ message: 'Server is working!', timestamp: new Date().toISOString() });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method
  });
});

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error('Error occurred:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });

  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(err.status || 500).json({
    error: isDevelopment ? err.message : 'Internal server error',
    ...(isDevelopment && { stack: err.stack }),
    timestamp: new Date().toISOString()
  });
});

// Graceful shutdown handling
const gracefulShutdown = async (signal) => {
  console.log(`${signal} received, shutting down gracefully`);
  
  try {
    // Stop accepting new requests
    server.close(async () => {
      console.log('HTTP server closed');
      
      // Cleanup resources
      const cleanupPromises = [];
      
      if (connectionPool && typeof connectionPool.closeAllConnections === 'function') {
        cleanupPromises.push(connectionPool.closeAllConnections());
      }
      
      if (sessionManager && typeof sessionManager.shutdown === 'function') {
        cleanupPromises.push(sessionManager.shutdown());
      }
      
      if (performanceMonitor && typeof performanceMonitor.shutdown === 'function') {
        cleanupPromises.push(performanceMonitor.shutdown());
      }
      
      if (cleanupPromises.length > 0) {
        await Promise.all(cleanupPromises);
      }
      
      console.log('All resources cleaned up');
      process.exit(0);
    });
    
    // Force shutdown after 30 seconds
    setTimeout(() => {
      console.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 30000);
    
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`⏰ Started at: ${new Date().toISOString()}`);
});

// Handle server errors
server.on('error', (err) => {
  console.error('Server error:', err);
});

module.exports = app;