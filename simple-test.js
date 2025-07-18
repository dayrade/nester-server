// Load environment variables
require('dotenv').config();

const express = require('express');
const cookieParser = require('cookie-parser');
const app = express();

// Basic middleware
app.use(express.json());
app.use(cookieParser());

// Create a simple mock profile controller for testing
const mockProfileController = {
    getProfile: async (req, res) => {
        res.json({
            success: true,
            data: {
                id: 'test-user-id',
                email: 'test@example.com',
                full_name: 'Test User',
                avatar_url: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }
        });
    },
    
    updateProfile: async (req, res) => {
        const { full_name, avatar_url } = req.body;
        res.json({
            success: true,
            data: {
                id: 'test-user-id',
                email: 'test@example.com',
                full_name: full_name || 'Test User',
                avatar_url: avatar_url || null,
                updated_at: new Date().toISOString()
            },
            message: 'Profile updated successfully'
        });
    },
    
    getProfileStats: async (req, res) => {
        res.json({
            success: true,
            data: {
                total_properties: 5,
                active_campaigns: 3,
                total_views: 1250,
                total_leads: 45,
                conversion_rate: 3.6
            }
        });
    },
    
    uploadAvatar: async (req, res) => {
        res.json({
            success: true,
            data: {
                avatar_url: 'https://example.com/avatar.jpg'
            },
            message: 'Avatar uploaded successfully'
        });
    }
};

// Test routes
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
    res.json({
        message: 'Nester API Server',
        status: 'running',
        endpoints: {
            health: '/health',
            profile: '/api/profile (GET)',
            updateProfile: '/api/profile (PUT)',
            profileStats: '/api/profile/stats (GET)',
            uploadAvatar: '/api/profile/avatar (POST)'
        }
    });
});

// Profile API routes
app.get('/api/profile', mockProfileController.getProfile);
app.put('/api/profile', mockProfileController.updateProfile);
app.get('/api/profile/stats', mockProfileController.getProfileStats);
app.post('/api/profile/avatar', mockProfileController.uploadAvatar);

// Start server
const port = process.env.EXPRESS_PORT || 3000;
const host = 'localhost';

app.listen(port, host, () => {
    console.log(`🚀 Simple server running on http://${host}:${port}`);
    console.log('✅ Server started successfully');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 Shutting down server...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🛑 Shutting down server...');
    process.exit(0);
});