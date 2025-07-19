// Load environment variables first
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const multer = require('multer');

// Import configuration and utilities
const config = require('./config/config');
const logger = require('./utils/logger');

// Import error tracking system
const errorHelper = require('../error-helper');
const errorTracker = require('../error-tracker');
// const { ValidationService } = require('./services/validation/validationService');

// Import services (temporarily commented out to debug)
// const { BrandService } = require('./services/brand/brandService');
// const { StorageService } = require('./services/storage/storageService');
// const { AnalyticsService } = require('./services/analytics/analyticsService');
// const { SocialService } = require('./services/social/socialService');
// const { EmailService } = require('./services/email/emailService');
// const { ChatService } = require('./services/chat/chatService');
// const { IntegrationService } = require('./services/integration/integrationService');
// const { WorkflowService } = require('./services/workflow/workflowService');

// Import routes (using test properties route)
const authRoutes = require('./routes/auth');
const propertyRoutes = require('./routes/properties');
const testPropertyRoutes = require('./routes/test-properties');
// const profileRoutes = require('./routes/profile');
// const brandRoutes = require('./routes/brands');
// const socialRoutes = require('./routes/social');
// const chatRoutes = require('./routes/chat');
// const analyticsRoutes = require('./routes/analytics');
// const uploadRoutes = require('./routes/upload');
// const webhookRoutes = require('./routes/webhooks');

class NesterApp {
    constructor() {
        console.log('Initializing NesterApp...');
        this.app = express();
        console.log('Express app created');
        
        // Load configuration
        console.log('Loading configuration...');
        this.config = config;
        console.log('Configuration loaded successfully');
        
        this.logger = logger;
        this.services = {};
        this.errorHelper = errorHelper;
        // this.validation = ValidationService;
        
        console.log('Starting middleware setup...');
        // Setup basic middleware and routes first
        try {
            this.setupMiddleware();
            console.log('Middleware setup completed');
        } catch (error) {
            const errorId = errorHelper.track(error, {
                function: 'setupMiddleware',
                file: 'app.js',
                phase: 'initialization'
            });
            console.error(`Error in setupMiddleware [${errorId}]:`, error);
            throw error;
        }
        
        try {
            this.setupRoutes();
            console.log('Routes setup completed');
        } catch (error) {
            const errorId = errorHelper.track(error, {
                function: 'setupRoutes',
                file: 'app.js',
                phase: 'initialization'
            });
            console.error(`Error in setupRoutes [${errorId}]:`, error);
            throw error;
        }
        
        try {
            this.setupErrorHandling();
            console.log('Error handling setup completed');
        } catch (error) {
            const errorId = errorHelper.track(error, {
                function: 'setupErrorHandling',
                file: 'app.js',
                phase: 'initialization'
            });
            console.error(`Error in setupErrorHandling [${errorId}]:`, error);
            throw error;
        }
        
        // Initialize services asynchronously
        this.initializeServices().catch(error => {
            const errorId = errorHelper.track(error, {
                function: 'initializeServices',
                file: 'app.js',
                phase: 'service_initialization'
            });
            this.logger.error(`Failed to initialize services [${errorId}]`, { error: error.message });
        });
    }

    /**
     * Initialize all services
     */
    async initializeServices() {
        try {
            this.logger.info('Initializing services...');

            // Initialize core services (simplified for now)
            // this.services.brand = new BrandService();
            // this.services.storage = new StorageService();
            // this.services.analytics = new AnalyticsService();
            // this.services.social = new SocialService();
            // this.services.email = new EmailService();
            // this.services.chat = new ChatService();
            // this.services.integration = new IntegrationService();
            // this.services.workflow = new WorkflowService();

            // Initialize storage buckets
            // await this.services.storage.initializeBuckets();

            // Perform health checks
            // await this.performHealthChecks();

            this.logger.info('Basic services initialized successfully');
        } catch (error) {
            const errorId = this.errorHelper.track(error, {
                function: 'initializeServices',
                file: 'app.js',
                phase: 'service_initialization',
                severity: 'HIGH'
            });
            this.logger.error(`Failed to initialize services [${errorId}]`, { error: error.message });
            throw error;
        }
    }

    /**
     * Setup Express middleware
     */
    setupMiddleware() {
        console.log('Setting up security middleware...');
        // Security middleware (simplified)
        this.app.use(helmet({
            contentSecurityPolicy: false, // Disable CSP for now to avoid issues
            crossOriginEmbedderPolicy: false
        }));
        console.log('Security middleware loaded');

        console.log('Setting up CORS...');
        // CORS configuration
        this.app.use(cors({
            origin: process.env.FRONTEND_URL || 'http://localhost:3000',
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
        }));
        console.log('CORS loaded');

        // Compression
        this.app.use(compression());

        // Request logging
        this.app.use(morgan('combined', {
            stream: {
                write: (message) => this.logger.info(message.trim())
            }
        }));

        // Body parsing
        this.app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: process.env.URLENCODED_BODY_LIMIT || '10mb' }));

        // Rate limiting
        const limiter = rateLimit({
            windowMs: parseInt(process.env.APP_RATE_WINDOW_MS || '900000'), // 15 minutes default
            max: parseInt(process.env.APP_RATE_MAX_REQUESTS || '100'), // Limit each IP to 100 requests per windowMs
            message: {
                success: false,
                error: 'Too many requests, please try again later'
            },
            standardHeaders: true,
            legacyHeaders: false
        });
        this.app.use('/api/', limiter);

        // Request ID middleware
        this.app.use((req, res, next) => {
            req.id = require('crypto').randomUUID();
            res.setHeader('X-Request-ID', req.id);
            next();
        });

        // Error tracking middleware - must be early in the chain
        this.app.use(errorHelper.middleware);
        
        // Services middleware - make services available to routes
        this.app.use((req, res, next) => {
            req.services = this.services;
            req.errorHelper = this.errorHelper;
            // req.validation = this.validation;
            next();
        });

        // Static files
        this.app.use('/static', express.static(path.join(__dirname, 'public')));
    }

    /**
     * Setup API routes
     */
    setupRoutes() {
        // Health check endpoint
        this.app.get('/health', async (req, res) => {
            try {
                const health = await this.getHealthStatus();
                res.status(health.status === 'healthy' ? 200 : 503).json(health);
            } catch (error) {
                const errorId = errorHelper.trackRequest(error, req, {
                    endpoint: '/health',
                    operation: 'health_check'
                });
                res.status(503).json({
                    status: 'unhealthy',
                    error: error.message,
                    errorId,
                    timestamp: new Date().toISOString()
                });
            }
        });
        
        // Error tracking status endpoint
        this.app.get('/api/errors/status', (req, res) => {
            try {
                const status = errorHelper.status();
                res.json({
                    success: true,
                    data: status
                });
            } catch (error) {
                const errorId = errorHelper.trackRequest(error, req, {
                    endpoint: '/api/errors/status',
                    operation: 'get_error_status'
                });
                res.status(500).json({
                    success: false,
                    error: error.message,
                    errorId
                });
            }
        });
        
        // Error tracking report endpoint
        this.app.get('/api/errors/report', (req, res) => {
            try {
                const report = errorHelper.report();
                res.json({
                    success: true,
                    data: report
                });
            } catch (error) {
                const errorId = errorHelper.trackRequest(error, req, {
                    endpoint: '/api/errors/report',
                    operation: 'generate_error_report'
                });
                res.status(500).json({
                    success: false,
                    error: error.message,
                    errorId
                });
            }
        });
        
        // Resolve error endpoint
        this.app.post('/api/errors/:errorId/resolve', (req, res) => {
            try {
                const { errorId } = req.params;
                const { resolution } = req.body;
                
                const success = errorHelper.resolve(errorId, resolution || 'Manually resolved');
                
                if (success) {
                    res.json({
                        success: true,
                        message: 'Error marked as resolved'
                    });
                } else {
                    res.status(404).json({
                        success: false,
                        error: 'Error not found'
                    });
                }
            } catch (error) {
                const errorId = errorHelper.trackRequest(error, req, {
                    endpoint: '/api/errors/:errorId/resolve',
                    operation: 'resolve_error'
                });
                res.status(500).json({
                    success: false,
                    error: error.message,
                    errorId
                });
            }
        });

        // API routes (enabling properties for testing)
        console.log('Loading routes...');
        try {
            this.app.use('/api/auth', authRoutes);
            console.log('Auth routes loaded');
            this.app.use('/api/properties', propertyRoutes);
            console.log('Properties routes loaded');
            this.app.use('/api/test-properties', testPropertyRoutes);
            console.log('Test properties routes loaded');
            // this.app.use('/api/profile', profileRoutes);
            // console.log('Profile routes loaded');
            // this.app.use('/api/brands', brandRoutes);
            // console.log('Brands routes loaded');
            // this.app.use('/api/social', socialRoutes);
            // console.log('Social routes loaded');
            // this.app.use('/api/chat', chatRoutes);
            // console.log('Chat routes loaded');
            // this.app.use('/api/analytics', analyticsRoutes);
            // console.log('Analytics routes loaded');
            // this.app.use('/api/upload', uploadRoutes);
            // console.log('Upload routes loaded');
            // this.app.use('/api/webhooks', webhookRoutes);
            // console.log('Webhooks routes loaded');
            console.log('Routes loading skipped for debugging');
        } catch (error) {
            console.error('Error loading routes:', error);
            process.exit(1);
        }

        // API documentation
        this.app.get('/api', (req, res) => {
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

        // 404 handler for API routes
        this.app.use('/api/*', (req, res) => {
            res.status(404).json({
                success: false,
                error: 'API endpoint not found',
                path: req.path
            });
        });

        // Serve frontend in production
        if (this.config.NODE_ENV === 'production') {
            this.app.use(express.static(path.join(__dirname, '../client/build')));
            
            this.app.get('*', (req, res) => {
                res.sendFile(path.join(__dirname, '../client/build/index.html'));
            });
        }
    }

    /**
     * Setup error handling middleware
     */
    setupErrorHandling() {
        // Multer error handling
        this.app.use((error, req, res, next) => {
            if (error instanceof multer.MulterError) {
                if (error.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({
                        success: false,
                        error: 'File too large'
                    });
                }
                if (error.code === 'LIMIT_FILE_COUNT') {
                    return res.status(400).json({
                        success: false,
                        error: 'Too many files'
                    });
                }
            }
            next(error);
        });

        // Global error handler
        this.app.use((error, req, res, next) => {
            // Track error if not already tracked
            let errorId = error.trackingId;
            if (!errorId) {
                errorId = errorHelper.trackRequest(error, req, {
                    handler: 'global_error_handler',
                    unhandled: true,
                    severity: 'HIGH'
                });
            }
            
            this.logger.error(`Unhandled error [${errorId}]`, {
                error: error.message,
                stack: error.stack,
                requestId: req.id,
                path: req.path,
                method: req.method,
                errorId
            });

            // Don't leak error details in production
            const isDevelopment = this.config.NODE_ENV === 'development';
            
            res.status(error.status || 500).json({
                success: false,
                error: isDevelopment ? error.message : 'Internal server error',
                requestId: req.id,
                errorId,
                ...(isDevelopment && { stack: error.stack })
            });
        });
    }

    /**
     * Perform health checks on all services
     */
    async performHealthChecks() {
        // Temporarily disabled until services are properly initialized
        // const checks = [
        //     { name: 'config', check: () => this.config.healthCheck() },
        //     { name: 'integration', check: () => this.services.integration.healthCheck() },
        //     { name: 'workflow', check: () => this.services.workflow.healthCheck() }
        // ];

        // for (const { name, check } of checks) {
        //     try {
        //         await check();
        //         this.logger.info(`${name} service health check passed`);
        //     } catch (error) {
        //         this.logger.warn(`${name} service health check failed`, { error: error.message });
        //     }
        // }
    }

    /**
     * Get overall health status
     */
    async getHealthStatus() {
        const checks = {
            server: 'healthy',
            config: 'healthy'
        };

        // Basic health check - server is running if we reach this point
        
        return {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            version: '1.0.0',
            uptime: process.uptime(),
            checks
        };
    }

    /**
     * Start the server
     */
    async start() {
        try {
            console.log('Server starting up...');
            
            const port = this.config.server.port;
            const host = this.config.server.host;
            console.log('Config PORT:', port);
            console.log('Config HOST:', host);

            // Perform health checks
            console.log('Performing health checks...');
            await this.performHealthChecks();
            console.log('Health checks completed');

            // Start the server
            console.log('Starting HTTP server...');
            this.server = this.app.listen(port, host, () => {
                this.logger.info(`Nester server started`, {
                    port,
                    host,
                    environment: this.config.NODE_ENV,
                    pid: process.pid
                });
                console.log(`Server details - Port: ${port}, Host: ${host}, PID: ${process.pid}`);
                console.log(`🚀 Server running on http://${host}:${port}`);
                console.log(`📊 Error tracking available at http://${host}:${port}/api/errors/status`);
            });
            
            // Handle server errors
            this.server.on('error', (error) => {
                const errorId = this.errorHelper.track(error, {
                    function: 'server.listen',
                    file: 'app.js',
                    port,
                    host,
                    severity: 'CRITICAL'
                });
                console.error(`Server error [${errorId}]:`, error);
                this.logger.error(`Server error [${errorId}]`, { error: error.message });
                if (error.code === 'EADDRINUSE') {
                    console.error(`Port ${port} is already in use`);
                    process.exit(1);
                }
            });
            
            // Keep the process alive
            this.server.on('listening', () => {
                console.log('Server is now listening for connections');
            });

            console.log('Setting up graceful shutdown handlers...');
            // Graceful shutdown handling
            process.on('SIGTERM', () => this.shutdown('SIGTERM'));
            process.on('SIGINT', () => this.shutdown('SIGINT'));
            
            console.log('Server startup completed successfully');

        } catch (error) {
            const errorId = this.errorHelper.track(error, {
                function: 'start',
                file: 'app.js',
                phase: 'server_startup',
                severity: 'CRITICAL'
            });
            this.logger.error(`Failed to start server [${errorId}]`, { error: error.message });
            console.error(`Failed to start server [${errorId}]:`, error.message);
            process.exit(1);
        }
    }

    /**
     * Graceful shutdown
     */
    async shutdown(signal) {
        this.logger.info(`Received ${signal}, starting graceful shutdown...`);

        if (this.server) {
            this.server.close(() => {
                this.logger.info('HTTP server closed');
                process.exit(0);
            });

            // Force close after 30 seconds
            setTimeout(() => {
                this.logger.error('Could not close connections in time, forcefully shutting down');
                process.exit(1);
            }, 30000);
        }
    }

    /**
     * Get Express app instance
     */
    getApp() {
        return this.app;
    }
}

module.exports = NesterApp;

// Start server if this file is run directly
if (require.main === module) {
    try {
        console.log('Creating NesterApp instance...');
        const app = new NesterApp();
        console.log('Starting server...');
        app.start().catch(error => {
            console.error('Failed to start application:', error);
            logger.error('Failed to start application', { error: error.message });
            process.exit(1);
        });
    } catch (error) {
        console.error('Error during app initialization:', error);
        process.exit(1);
    }
}