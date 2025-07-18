// Load environment variables first
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

// Import configuration and utilities
const config = require('./config/config');
const logger = require('./utils/logger');

class NesterApp {
    constructor() {
        this.app = express();
        this.config = config;
        this.logger = logger;
        
        this.setupBasicMiddleware();
        this.setupBasicRoutes();
        this.setupErrorHandling();
    }

    setupBasicMiddleware() {
        // Basic security
        this.app.use(helmet());
        
        // CORS
        this.app.use(cors({
            origin: ['http://localhost:3000', 'http://localhost:3002'],
            credentials: true
        }));
        
        // Body parsing
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));
    }

    setupBasicRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                service: 'Nester API'
            });
        });

        // Basic API info
        this.app.get('/api', (req, res) => {
            res.json({
                name: 'Nester API',
                version: '1.0.0',
                status: 'running'
            });
        });
    }

    setupErrorHandling() {
        // 404 handler
        this.app.use('*', (req, res) => {
            res.status(404).json({
                error: 'Not found',
                path: req.originalUrl
            });
        });

        // Error handler
        this.app.use((err, req, res, next) => {
            this.logger.error('Unhandled error:', err);
            res.status(500).json({
                error: 'Internal server error'
            });
        });
    }

    async start() {
        try {
            const port = process.env.EXPRESS_PORT || this.config.get('server.port') || 3000;
            const host = this.config.get('server.host') || 'localhost';
            
            this.server = this.app.listen(port, host, () => {
                this.logger.info(`🚀 Nester server running on http://${host}:${port}`);
                this.logger.info('✅ Server started successfully');
            });

            // Graceful shutdown
            process.on('SIGTERM', () => this.shutdown());
            process.on('SIGINT', () => this.shutdown());

        } catch (error) {
            this.logger.error('Failed to start server:', error);
            process.exit(1);
        }
    }

    async shutdown() {
        this.logger.info('🛑 Shutting down server...');
        if (this.server) {
            this.server.close(() => {
                this.logger.info('✅ Server shut down gracefully');
                process.exit(0);
            });
        }
    }
}

// Start the application
const app = new NesterApp();
app.start().catch(error => {
    console.error('Failed to start application:', error);
    process.exit(1);
});

module.exports = NesterApp;