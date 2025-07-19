// Minimal test to isolate the server startup issue
console.log('Starting minimal test...');

try {
    console.log('Loading path module...');
    const path = require('path');
    console.log('Path module loaded successfully');
    
    console.log('Loading dotenv...');
    require('dotenv').config({ path: path.join(__dirname, '.env') });
    console.log('Dotenv loaded successfully');
    
    console.log('Loading express...');
    const express = require('express');
    console.log('Express loaded successfully');
    
    console.log('Loading config...');
    const config = require('./config/config');
    console.log('Config loaded successfully');
    
    console.log('Loading logger...');
    const logger = require('./utils/logger');
    console.log('Logger loaded successfully');
    
    console.log('Creating express app...');
    const app = express();
    console.log('Express app created successfully');
    
    console.log('Setting up basic middleware...');
    app.use(express.json());
    console.log('Basic middleware setup completed');
    
    console.log('Setting up test route...');
    app.get('/test', (req, res) => {
        res.json({ message: 'Test successful' });
    });
    console.log('Test route setup completed');
    
    console.log('Starting server...');
    const server = app.listen(3003, 'localhost', () => {
        console.log('✅ Minimal server started successfully on http://localhost:3003');
        console.log('Test the server by visiting: http://localhost:3003/test');
    });
    
    server.on('error', (error) => {
        console.error('❌ Server error:', error);
        process.exit(1);
    });
    
} catch (error) {
    console.error('❌ Error during startup:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
}