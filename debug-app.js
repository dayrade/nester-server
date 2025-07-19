// Debug version of app.js to isolate the issue
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const multer = require('multer');

const config = require('./config/config');
const logger = require('./utils/logger');
const testPropertyRoutes = require('./routes/test-properties');

console.log('Starting debug app...');

class DebugApp {
    constructor() {
        console.log('Creating express app...');
        this.app = express();
        this.config = config;
        this.logger = logger;
        this.services = {};
        
        console.log('Setting up middleware step by step...');
        this.setupMiddlewareStepByStep();
    }
    
    setupMiddlewareStepByStep() {
        try {
            console.log('Step 1: Basic body parsing...');
            this.app.use(express.json({ limit: '10mb' }));
            this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
            console.log('✅ Basic body parsing completed');
            
            console.log('Step 2: CORS...');
            this.app.use(cors({
                origin: 'http://localhost:3000',
                credentials: true,
                methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
                allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
            }));
            console.log('✅ CORS completed');
            
            console.log('Step 3: Compression...');
            this.app.use(compression());
            console.log('✅ Compression completed');
            
            console.log('Step 4: Request ID middleware...');
            this.app.use((req, res, next) => {
                req.id = require('crypto').randomUUID();
                res.setHeader('X-Request-ID', req.id);
                next();
            });
            console.log('✅ Request ID middleware completed');
            
            console.log('Step 5: Services middleware...');
            this.app.use((req, res, next) => {
                req.services = this.services;
                next();
            });
            console.log('✅ Services middleware completed');
            
            console.log('Step 6: Static files...');
            this.app.use('/static', express.static(path.join(__dirname, 'public')));
            console.log('✅ Static files completed');
            
            console.log('Step 7: Health check route...');
            this.app.get('/health', (req, res) => {
                res.json({ status: 'healthy', timestamp: new Date().toISOString() });
            });
            console.log('✅ Health check route completed');
            
            console.log('Step 8: Test property routes...');
            this.app.use('/api/properties', testPropertyRoutes);
            console.log('✅ Test property routes completed');
            
            console.log('Step 9: 404 handler...');
            this.app.use('/api/*', (req, res) => {
                res.status(404).json({
                    success: false,
                    error: 'API endpoint not found',
                    path: req.path
                });
            });
            console.log('✅ 404 handler completed');
            
            console.log('Step 10: Error handling...');
            this.app.use((error, req, res, next) => {
                console.error('Error caught:', error);
                res.status(500).json({
                    success: false,
                    error: 'Internal server error',
                    message: error.message
                });
            });
            console.log('✅ Error handling completed');
            
        } catch (error) {
            console.error('❌ Error in middleware setup:', error);
            throw error;
        }
    }
    
    async start() {
        try {
            console.log('Starting debug server...');
            const port = 3004;
            const host = 'localhost';
            
            this.server = this.app.listen(port, host, () => {
                console.log(`✅ Debug server started successfully on http://${host}:${port}`);
                console.log('Test endpoints:');
                console.log('- Health: http://localhost:3004/health');
                console.log('- Test properties: http://localhost:3004/api/properties/test');
            });
            
            this.server.on('error', (error) => {
                console.error('❌ Server error:', error);
                process.exit(1);
            });
            
        } catch (error) {
            console.error('❌ Failed to start debug server:', error);
            process.exit(1);
        }
    }
}

if (require.main === module) {
    try {
        const app = new DebugApp();
        app.start();
    } catch (error) {
        console.error('❌ Error during debug app initialization:', error);
        process.exit(1);
    }
}