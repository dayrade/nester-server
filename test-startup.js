// Comprehensive test to isolate startup issues
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

console.log('Environment variables loaded');

try {
    console.log('Testing basic imports...');
    const express = require('express');
    const config = require('./config/config');
    const logger = require('./utils/logger');
    console.log('Basic imports successful');
    
    console.log('Testing route imports one by one...');
    
    console.log('Testing auth routes...');
    const authRoutes = require('./routes/auth');
    console.log('Auth routes imported successfully');
    
    console.log('Testing properties routes...');
    const propertyRoutes = require('./routes/properties');
    console.log('Properties routes imported successfully');
    
    console.log('Testing profile routes...');
    const profileRoutes = require('./routes/profile');
    console.log('Profile routes imported successfully');
    
    console.log('Testing brands routes...');
    const brandRoutes = require('./routes/brands');
    console.log('Brands routes imported successfully');
    
    console.log('Testing social routes...');
    const socialRoutes = require('./routes/social');
    console.log('Social routes imported successfully');
    
    console.log('Testing chat routes...');
    const chatRoutes = require('./routes/chat');
    console.log('Chat routes imported successfully');
    
    console.log('Testing analytics routes...');
    const analyticsRoutes = require('./routes/analytics');
    console.log('Analytics routes imported successfully');
    
    console.log('Testing upload routes...');
    const uploadRoutes = require('./routes/upload');
    console.log('Upload routes imported successfully');
    
    console.log('Testing webhook routes...');
    const webhookRoutes = require('./routes/webhooks');
    console.log('Webhook routes imported successfully');
    
    console.log('All route imports successful!');
    
    // Test creating the app
    console.log('Testing app creation...');
    const NesterApp = require('./app');
    console.log('NesterApp class imported successfully');
    
    console.log('Creating app instance...');
    const app = new NesterApp();
    console.log('App instance created successfully');
    
    console.log('All tests passed!');
    
} catch (error) {
    console.error('Error occurred:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
}