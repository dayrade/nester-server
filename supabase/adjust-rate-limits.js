// Script to adjust rate limiting configuration
// This helps modify rate limits without manual file editing

const fs = require('fs');
const path = require('path');

const serverFilePath = path.join(__dirname, '..', 'server.js');

function adjustRateLimits(mode = 'development') {
    console.log(`🔧 Adjusting rate limits for ${mode} mode...`);
    
    try {
        // Read the current server.js file
        let serverContent = fs.readFileSync(serverFilePath, 'utf8');
        
        if (mode === 'development') {
            console.log('📝 Setting development-friendly rate limits...');
            
            // Replace auth limiter with more lenient settings
            const authLimiterRegex = /const authLimiter = rateLimit\({[\s\S]*?}\);/;
            const newAuthLimiter = `const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Very high limit for development
  message: {
    error: 'Too many authentication attempts, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for localhost in development
  skip: (req) => {
    const isDevelopment = process.env.NODE_ENV === 'development';
    const isLocalhost = req.ip === '127.0.0.1' || req.ip === '::1' || req.ip.includes('localhost');
    return isDevelopment && isLocalhost;
  }
});`;
            
            serverContent = serverContent.replace(authLimiterRegex, newAuthLimiter);
            
        } else if (mode === 'production') {
            console.log('📝 Setting production rate limits...');
            
            // Replace with production settings
            const authLimiterRegex = /const authLimiter = rateLimit\({[\s\S]*?}\);/;
            const newAuthLimiter = `const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Strict limit for production
  message: {
    error: 'Too many authentication attempts, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false
});`;
            
            serverContent = serverContent.replace(authLimiterRegex, newAuthLimiter);
            
        } else if (mode === 'disable') {
            console.log('📝 Disabling rate limiting...');
            
            // Comment out rate limiting middleware
            serverContent = serverContent.replace(
                /app\.use\('\/api', apiLimiter\);/,
                '// app.use(\'/api\', apiLimiter); // Disabled for testing'
            );
            serverContent = serverContent.replace(
                /app\.use\('\/api\/auth', authLimiter\);/,
                '// app.use(\'/api/auth\', authLimiter); // Disabled for testing'
            );
        }
        
        // Create backup
        const backupPath = serverFilePath + '.backup';
        if (!fs.existsSync(backupPath)) {
            fs.writeFileSync(backupPath, fs.readFileSync(serverFilePath));
            console.log('💾 Created backup at server.js.backup');
        }
        
        // Write the modified content
        fs.writeFileSync(serverFilePath, serverContent);
        
        console.log('✅ Rate limiting configuration updated!');
        console.log('🔄 Please restart the server for changes to take effect.');
        
        if (mode === 'disable') {
            console.log('⚠️  WARNING: Rate limiting is now DISABLED!');
            console.log('🔒 Remember to re-enable it before production deployment.');
        }
        
    } catch (error) {
        console.error('❌ Error adjusting rate limits:', error.message);
        process.exit(1);
    }
}

function restoreBackup() {
    const backupPath = serverFilePath + '.backup';
    
    if (!fs.existsSync(backupPath)) {
        console.log('❌ No backup file found at server.js.backup');
        return;
    }
    
    try {
        fs.writeFileSync(serverFilePath, fs.readFileSync(backupPath));
        console.log('✅ Restored server.js from backup');
        console.log('🔄 Please restart the server for changes to take effect.');
    } catch (error) {
        console.error('❌ Error restoring backup:', error.message);
    }
}

function showCurrentConfig() {
    try {
        const serverContent = fs.readFileSync(serverFilePath, 'utf8');
        
        // Extract auth limiter configuration
        const authLimiterMatch = serverContent.match(/const authLimiter = rateLimit\({[\s\S]*?}\);/);
        
        console.log('📊 Current Rate Limiting Configuration:');
        console.log('=====================================');
        
        if (authLimiterMatch) {
            console.log(authLimiterMatch[0]);
        } else {
            console.log('❌ Could not find authLimiter configuration');
        }
        
        // Check if middleware is enabled
        const apiLimiterEnabled = !serverContent.includes('// app.use(\'/api\', apiLimiter);');
        const authLimiterEnabled = !serverContent.includes('// app.use(\'/api/auth\', authLimiter);');
        
        console.log('\n📈 Middleware Status:');
        console.log(`API Rate Limiting: ${apiLimiterEnabled ? '✅ Enabled' : '❌ Disabled'}`);
        console.log(`Auth Rate Limiting: ${authLimiterEnabled ? '✅ Enabled' : '❌ Disabled'}`);
        
    } catch (error) {
        console.error('❌ Error reading configuration:', error.message);
    }
}

// Command line interface
if (require.main === module) {
    const args = process.argv.slice(2);
    const command = args[0];
    
    console.log('🔧 Rate Limiting Configuration Tool');
    console.log('===================================\n');
    
    switch (command) {
        case 'development':
        case 'dev':
            adjustRateLimits('development');
            break;
            
        case 'production':
        case 'prod':
            adjustRateLimits('production');
            break;
            
        case 'disable':
            adjustRateLimits('disable');
            break;
            
        case 'restore':
            restoreBackup();
            break;
            
        case 'status':
        case 'show':
            showCurrentConfig();
            break;
            
        default:
            console.log('Usage: node adjust-rate-limits.js <command>');
            console.log('\nCommands:');
            console.log('  development  - Set development-friendly rate limits');
            console.log('  production   - Set production rate limits');
            console.log('  disable      - Disable rate limiting (for testing)');
            console.log('  restore      - Restore from backup');
            console.log('  status       - Show current configuration');
            console.log('\nExamples:');
            console.log('  node adjust-rate-limits.js development');
            console.log('  node adjust-rate-limits.js disable');
            console.log('  node adjust-rate-limits.js status');
            break;
    }
}

module.exports = {
    adjustRateLimits,
    restoreBackup,
    showCurrentConfig
};