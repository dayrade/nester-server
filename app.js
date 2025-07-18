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
const { ValidationService } = require('./services/validation/validationService');

// Import services
const { BrandService } = require('./services/brand/brandService');
const { StorageService } = require('./services/storage/storageService');
const { AnalyticsService } = require('./services/analytics/analyticsService');
const { SocialService } = require('./services/social/socialService');
const { EmailService } = require('./services/email/emailService');
const { ChatService } = require('./services/chat/chatService');
const { IntegrationService } = require('./services/integration/integrationService');
const { WorkflowService } = require('./services/workflow/workflowService');

// Import routes (to be created)
const authRoutes = require('./routes/auth');
const propertyRoutes = require('./routes/properties');
const profileRoutes = require('./routes/profile');
const brandRoutes = require('./routes/brands');
const socialRoutes = require('./routes/social');
const chatRoutes = require('./routes/chat');
const analyticsRoutes = require('./routes/analytics');
const uploadRoutes = require('./routes/upload');
const webhookRoutes = require('./routes/webhooks');

class NesterApp {
    constructor() {
        this.app = express();
        this.config = config;
        this.logger = logger;
        this.services = {};
        this.validation = new ValidationService();
        
        // Setup basic middleware and routes first
        this.setupMiddleware();
        this.setupRoutes();
        this.setupErrorHandling();
        
        // Initialize services asynchronously
        this.initializeServices().catch(error => {
            this.logger.error('Failed to initialize services', { error: error.message });
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
            this.logger.error('Failed to initialize services', { error: error.message });
            throw error;
        }
    }

    /**
     * Setup Express middleware
     */
    setupMiddleware() {
        // Security middleware
        this.app.use(helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
                    fontSrc: ["'self'", 'https://fonts.gstatic.com'],
                    imgSrc: ["'self'", 'data:', 'https:'],
                    scriptSrc: ["'self'"],
                    connectSrc: ["'self'", 'https://api.supabase.co']
                }
            },
            crossOriginEmbedderPolicy: false
        }));

        // CORS configuration
        this.app.use(cors({
            origin: this.config.get('cors.allowedOrigins') || ['http://localhost:3000'],
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
        }));

        // Compression
        this.app.use(compression());

        // Request logging
        this.app.use(morgan('combined', {
            stream: {
                write: (message) => this.logger.info(message.trim())
            }
        }));

        // Body parsing
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

        // Rate limiting
        const limiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100, // Limit each IP to 100 requests per windowMs
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

        // Services middleware - make services available to routes
        this.app.use((req, res, next) => {
            req.services = this.services;
            req.validation = this.validation;
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
                res.status(503).json({
                    status: 'unhealthy',
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // API routes
        this.app.use('/api/auth', authRoutes);
        this.app.use('/api/properties', propertyRoutes);
        this.app.use('/api/profile', profileRoutes);
        this.app.use('/api/brands', brandRoutes);
        this.app.use('/api/social', socialRoutes);
        this.app.use('/api/chat', chatRoutes);
        this.app.use('/api/analytics', analyticsRoutes);
        this.app.use('/api/upload', uploadRoutes);
        this.app.use('/api/webhooks', webhookRoutes);

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
        if (this.config.get('nodeEnv') === 'production') {
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
            this.logger.error('Unhandled error', {
                error: error.message,
                stack: error.stack,
                requestId: req.id,
                path: req.path,
                method: req.method
            });

            // Don't leak error details in production
            const isDevelopment = this.config.get('nodeEnv') === 'development';
            
            res.status(error.status || 500).json({
                success: false,
                error: isDevelopment ? error.message : 'Internal server error',
                requestId: req.id,
                ...(isDevelopment && { stack: error.stack })
            });
        });
    }

    /**
     * Perform health checks on all services
     */
    async performHealthChecks() {
        const checks = [
            { name: 'config', check: () => this.config.healthCheck() },
            { name: 'integration', check: () => this.services.integration.healthCheck() },
            { name: 'workflow', check: () => this.services.workflow.healthCheck() }
        ];

        for (const { name, check } of checks) {
            try {
                await check();
                this.logger.info(`${name} service health check passed`);
            } catch (error) {
                this.logger.warn(`${name} service health check failed`, { error: error.message });
            }
        }
    }

    /**
     * Get overall health status
     */
    async getHealthStatus() {
        const checks = {
            database: 'unknown',
            storage: 'unknown',
            integrations: 'unknown',
            workflows: 'unknown'
        };

        try {
            // Check database connection
            await this.services.analytics.supabase.from('users').select('count').limit(1);
            checks.database = 'healthy';
        } catch (error) {
            checks.database = 'unhealthy';
        }

        try {
            // Check storage
            await this.services.storage.supabase.storage.listBuckets();
            checks.storage = 'healthy';
        } catch (error) {
            checks.storage = 'unhealthy';
        }

        try {
            // Check integrations
            await this.services.integration.healthCheck();
            checks.integrations = 'healthy';
        } catch (error) {
            checks.integrations = 'unhealthy';
        }

        try {
            // Check workflows
            await this.services.workflow.healthCheck();
            checks.workflows = 'healthy';
        } catch (error) {
            checks.workflows = 'unhealthy';
        }

        const allHealthy = Object.values(checks).every(status => status === 'healthy');
        
        return {
            status: allHealthy ? 'healthy' : 'degraded',
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
            const port = this.config.get('port') || 5000;
            const host = this.config.get('host') || '0.0.0.0';

            this.server = this.app.listen(port, host, () => {
                this.logger.info(`Nester server started`, {
                    port,
                    host,
                    environment: this.config.get('nodeEnv'),
                    pid: process.pid
                });
            });

            // Graceful shutdown handling
            process.on('SIGTERM', () => this.shutdown('SIGTERM'));
            process.on('SIGINT', () => this.shutdown('SIGINT'));

        } catch (error) {
            this.logger.error('Failed to start server', { error: error.message });
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
    const app = new NesterApp();
    app.start().catch(error => {
        logger.error('Failed to start application', { error: error.message });
        process.exit(1);
    });
}