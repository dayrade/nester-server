const path = require('path');
const logger = require('../utils/logger');

/**
 * Centralized configuration management
 * Validates and provides typed access to environment variables
 */
class Config {
    constructor() {
        this.env = process.env.NODE_ENV || 'development';
        this.isDevelopment = this.env === 'development';
        this.isProduction = this.env === 'production';
        this.isTest = this.env === 'test';
        
        // Load and validate configuration
        this.loadConfig();
        this.validateConfig();
    }

    loadConfig() {
        // Server configuration
        this.server = {
            port: parseInt(process.env.PORT) || 3000,
            host: process.env.HOST || 'localhost',
            corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
            trustProxy: process.env.TRUST_PROXY === 'true'
        };

        // Supabase configuration
        this.supabase = {
            url: process.env.SUPABASE_URL,
            anonKey: process.env.SUPABASE_ANON_KEY,
            serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
            jwtSecret: process.env.SUPABASE_JWT_SECRET
        };

        // Database configuration
        this.database = {
            connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 5000,
            queryTimeout: parseInt(process.env.DB_QUERY_TIMEOUT) || 10000,
            maxRetries: parseInt(process.env.DB_MAX_RETRIES) || 3,
            healthCheckInterval: parseInt(process.env.DB_HEALTH_CHECK_INTERVAL) || 300000, // 5 minutes
            maxConsecutiveFailures: parseInt(process.env.DB_MAX_CONSECUTIVE_FAILURES) || 5
        };

        // Authentication configuration
        this.auth = {
            sessionCookieName: process.env.SESSION_COOKIE_NAME || 'session_token',
            sessionMaxAge: parseInt(process.env.SESSION_MAX_AGE) || 24 * 60 * 60 * 1000, // 24 hours
            passwordMinLength: parseInt(process.env.PASSWORD_MIN_LENGTH) || 8,
            passwordRequireSpecialChar: process.env.PASSWORD_REQUIRE_SPECIAL_CHAR !== 'false',
            passwordRequireNumber: process.env.PASSWORD_REQUIRE_NUMBER !== 'false',
            passwordRequireUppercase: process.env.PASSWORD_REQUIRE_UPPERCASE !== 'false',
            emailVerificationRequired: process.env.EMAIL_VERIFICATION_REQUIRED !== 'false'
        };

        // Rate limiting configuration
        this.rateLimiting = {
            signup: {
                windowMs: parseInt(process.env.SIGNUP_RATE_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
                maxAttempts: parseInt(process.env.SIGNUP_RATE_MAX_ATTEMPTS) || 5
            },
            signin: {
                windowMs: parseInt(process.env.SIGNIN_RATE_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
                maxAttempts: parseInt(process.env.SIGNIN_RATE_MAX_ATTEMPTS) || 10
            },
            general: {
                windowMs: parseInt(process.env.GENERAL_RATE_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
                maxAttempts: parseInt(process.env.GENERAL_RATE_MAX_ATTEMPTS) || 100
            }
        };

        // Logging configuration
        this.logging = {
            level: process.env.LOG_LEVEL || (this.isDevelopment ? 'debug' : 'info'),
            file: {
                enabled: process.env.LOG_FILE_ENABLED !== 'false',
                path: process.env.LOG_FILE_PATH || path.join(process.cwd(), 'logs'),
                maxSize: process.env.LOG_FILE_MAX_SIZE || '10m',
                maxFiles: parseInt(process.env.LOG_FILE_MAX_FILES) || 5
            },
            console: {
                enabled: process.env.LOG_CONSOLE_ENABLED !== 'false',
                colorize: process.env.LOG_CONSOLE_COLORIZE !== 'false'
            }
        };

        // Security configuration
        this.security = {
            helmet: {
                enabled: process.env.HELMET_ENABLED !== 'false',
                contentSecurityPolicy: process.env.CSP_ENABLED !== 'false'
            },
            cors: {
                credentials: process.env.CORS_CREDENTIALS !== 'false',
                optionsSuccessStatus: 200
            },
            cookies: {
                httpOnly: true,
                secure: this.isProduction,
                sameSite: process.env.COOKIE_SAME_SITE || 'lax',
                maxAge: this.auth.sessionMaxAge
            }
        };

        // Validation configuration
        this.validation = {
            email: {
                maxLength: parseInt(process.env.EMAIL_MAX_LENGTH) || 254,
                allowedDomains: process.env.EMAIL_ALLOWED_DOMAINS ? 
                    process.env.EMAIL_ALLOWED_DOMAINS.split(',').map(d => d.trim()) : null
            },
            input: {
                maxLength: parseInt(process.env.INPUT_MAX_LENGTH) || 1000,
                sanitizeHtml: process.env.SANITIZE_HTML !== 'false'
            }
        };

        // Feature flags
        this.features = {
            emailVerification: process.env.FEATURE_EMAIL_VERIFICATION !== 'false',
            socialAuth: process.env.FEATURE_SOCIAL_AUTH === 'true',
            passwordReset: process.env.FEATURE_PASSWORD_RESET !== 'false',
            userProfiles: process.env.FEATURE_USER_PROFILES !== 'false',
            adminPanel: process.env.FEATURE_ADMIN_PANEL === 'true'
        };
    }

    validateConfig() {
        const requiredEnvVars = [
            'SUPABASE_URL',
            'SUPABASE_ANON_KEY'
        ];

        const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
        
        if (missingVars.length > 0) {
            const error = `Missing required environment variables: ${missingVars.join(', ')}`;
            logger.error('Configuration validation failed', { missingVars });
            throw new Error(error);
        }

        // Validate Supabase URL format
        if (!this.supabase.url.startsWith('https://')) {
            throw new Error('SUPABASE_URL must be a valid HTTPS URL');
        }

        // Warn about missing optional but recommended variables
        const recommendedVars = [
            'SUPABASE_SERVICE_ROLE_KEY',
            'SUPABASE_JWT_SECRET'
        ];

        const missingRecommended = recommendedVars.filter(varName => !process.env[varName]);
        if (missingRecommended.length > 0) {
            logger.warn('Missing recommended environment variables', { 
                missingRecommended,
                impact: 'Some features may be limited'
            });
        }

        // Validate numeric configurations
        if (this.server.port < 1 || this.server.port > 65535) {
            throw new Error('PORT must be between 1 and 65535');
        }

        if (this.auth.passwordMinLength < 6) {
            logger.warn('Password minimum length is less than 6 characters', {
                current: this.auth.passwordMinLength,
                recommended: 8
            });
        }

        logger.info('Configuration loaded and validated successfully', {
            environment: this.env,
            server: {
                port: this.server.port,
                host: this.server.host
            },
            features: this.features
        });
    }

    /**
     * Get configuration for a specific section
     * @param {string} section - Configuration section name
     * @returns {Object} Configuration section
     */
    get(section) {
        if (!this[section]) {
            throw new Error(`Configuration section '${section}' not found`);
        }
        return this[section];
    }

    /**
     * Check if a feature is enabled
     * @param {string} featureName - Feature name
     * @returns {boolean} Whether feature is enabled
     */
    isFeatureEnabled(featureName) {
        return this.features[featureName] === true;
    }

    /**
     * Get database connection string (if using traditional DB)
     * @returns {string} Database connection string
     */
    getDatabaseUrl() {
        return process.env.DATABASE_URL || null;
    }

    /**
     * Get Redis connection configuration
     * @returns {Object} Redis configuration
     */
    getRedisConfig() {
        return {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT) || 6379,
            password: process.env.REDIS_PASSWORD || null,
            db: parseInt(process.env.REDIS_DB) || 0,
            retryDelayOnFailover: 100,
            maxRetriesPerRequest: 3
        };
    }

    /**
     * Get email service configuration
     * @returns {Object} Email configuration
     */
    getEmailConfig() {
        return {
            provider: process.env.EMAIL_PROVIDER || 'supabase',
            smtp: {
                host: process.env.SMTP_HOST,
                port: parseInt(process.env.SMTP_PORT) || 587,
                secure: process.env.SMTP_SECURE === 'true',
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS
                }
            },
            from: {
                name: process.env.EMAIL_FROM_NAME || 'Nester',
                address: process.env.EMAIL_FROM_ADDRESS || 'noreply@nester.com'
            }
        };
    }

    /**
     * Get monitoring and metrics configuration
     * @returns {Object} Monitoring configuration
     */
    getMonitoringConfig() {
        return {
            enabled: process.env.MONITORING_ENABLED === 'true',
            endpoint: process.env.MONITORING_ENDPOINT,
            apiKey: process.env.MONITORING_API_KEY,
            sampleRate: parseFloat(process.env.MONITORING_SAMPLE_RATE) || 0.1,
            enableMetrics: process.env.ENABLE_METRICS !== 'false',
            enableTracing: process.env.ENABLE_TRACING === 'true'
        };
    }
}

// Export singleton instance
module.exports = new Config();