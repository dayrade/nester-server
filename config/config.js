const path = require('path');
const fs = require('fs');
const axios = require('axios');
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
        
        // Doppler secrets cache
        this.secretsCache = new Map();
        this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
        this.lastCacheUpdate = null;
        
        // Load and validate configuration
        this.loadConfig();
        this.validateConfig();
    }

    loadConfig() {
        // Server configuration
        this.server = {
            port: parseInt(process.env.EXPRESS_PORT) || parseInt(process.env.PORT) || 3001, // Use environment variable or default to 3001
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

        // AI Services Configuration
        this.ai = {
            anthropic: {
                apiKey: process.env.ANTHROPIC_API_KEY,
                model: process.env.ANTHROPIC_MODEL || 'claude-3-sonnet-20240229',
                maxTokens: parseInt(process.env.ANTHROPIC_MAX_TOKENS) || 4000,
                temperature: parseFloat(process.env.ANTHROPIC_TEMPERATURE) || 0.7
            },
            replicate: {
                apiKey: process.env.REPLICATE_API_KEY,
                fluxModel: process.env.REPLICATE_FLUX_MODEL || 'black-forest-labs/flux-schnell',
                webhookUrl: process.env.REPLICATE_WEBHOOK_URL
            },
            gemini: {
                apiKey: process.env.GEMINI_API_KEY,
                model: process.env.GEMINI_MODEL || 'gemini-pro'
            }
        };

        // Scraping Services Configuration
        this.scraping = {
            puppeteer: {
                headless: process.env.PUPPETEER_HEADLESS !== 'false',
                timeout: parseInt(process.env.PUPPETEER_TIMEOUT) || 30000,
                userAgent: process.env.PUPPETEER_USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            brightData: {
                username: process.env.BRIGHTDATA_USERNAME,
                password: process.env.BRIGHTDATA_PASSWORD,
                endpoint: process.env.BRIGHTDATA_ENDPOINT,
                port: parseInt(process.env.BRIGHTDATA_PORT) || 22225
            },
            retries: {
                maxRetries: parseInt(process.env.SCRAPING_MAX_RETRIES) || 3,
                retryDelay: parseInt(process.env.SCRAPING_RETRY_DELAY) || 5000
            }
        };

        // External APIs Configuration
        this.apis = {
            googlePlaces: {
                apiKey: process.env.GOOGLE_PLACES_API_KEY,
                baseUrl: 'https://maps.googleapis.com/maps/api/place'
            },
            walkScore: {
                apiKey: process.env.WALKSCORE_API_KEY,
                baseUrl: 'https://api.walkscore.com'
            },
            greatSchools: {
                apiKey: process.env.GREATSCHOOLS_API_KEY,
                baseUrl: 'https://api.greatschools.org'
            },
            apiNinjas: {
                apiKey: process.env.API_NINJAS_KEY,
                baseUrl: 'https://api.api-ninjas.com/v1'
            },
            mixPost: {
                apiKey: process.env.MIXPOST_API_KEY,
                baseUrl: process.env.MIXPOST_BASE_URL,
                webhookSecret: process.env.MIXPOST_WEBHOOK_SECRET
            }
        };

        // Email Configuration
        this.email = {
            brevo: {
                apiKey: process.env.BREVO_API_KEY,
                baseUrl: 'https://api.brevo.com/v3',
                defaultSender: {
                    name: process.env.BREVO_SENDER_NAME || 'Nester',
                    email: process.env.BREVO_SENDER_EMAIL || 'noreply@nester.ai'
                }
            },
            templates: {
                welcome: parseInt(process.env.BREVO_WELCOME_TEMPLATE_ID) || 1,
                propertyBrochure: parseInt(process.env.BREVO_BROCHURE_TEMPLATE_ID) || 2,
                leadNotification: parseInt(process.env.BREVO_LEAD_TEMPLATE_ID) || 3,
                chatTranscript: parseInt(process.env.BREVO_CHAT_TEMPLATE_ID) || 4
            }
        };

        // Payment Configuration
        this.payment = {
            lemonSqueezy: {
                apiKey: process.env.LEMONSQUEEZY_API_KEY,
                storeId: process.env.LEMONSQUEEZY_STORE_ID,
                webhookSecret: process.env.LEMONSQUEEZY_WEBHOOK_SECRET,
                baseUrl: 'https://api.lemonsqueezy.com/v1'
            }
        };

        // Workflow Configuration
        this.workflow = {
            n8n: {
                baseUrl: process.env.N8N_BASE_URL || 'http://localhost:5678',
                apiKey: process.env.N8N_API_KEY,
                webhookUrl: process.env.N8N_WEBHOOK_URL
            }
        };

        // Doppler Configuration
        this.doppler = {
            token: process.env.DOPPLER_TOKEN,
            project: process.env.DOPPLER_PROJECT || 'nester',
            config: process.env.DOPPLER_CONFIG || (this.isProduction ? 'prd' : 'dev'),
            apiUrl: 'https://api.doppler.com/v3'
        };

        // Storage Configuration
        this.storage = {
            supabase: {
                buckets: {
                    propertyImages: 'property-images',
                    brandAssets: 'brand-assets',
                    generatedContent: 'generated-content',
                    socialMedia: 'social-media',
                    documents: 'documents',
                    temp: 'temp'
                }
            },
            upload: {
                maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760, // 10MB
                allowedImageTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'],
                allowedDocumentTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
                tempDir: process.env.TEMP_DIR || './temp'
            }
        };

        // Cache Configuration
        this.cache = {
            redis: {
                url: process.env.REDIS_URL,
                host: process.env.REDIS_HOST || 'localhost',
                port: parseInt(process.env.REDIS_PORT) || 6379,
                password: process.env.REDIS_PASSWORD,
                db: parseInt(process.env.REDIS_DB) || 0,
                ttl: parseInt(process.env.CACHE_TTL) || 3600 // 1 hour
            },
            memory: {
                maxSize: parseInt(process.env.MEMORY_CACHE_MAX_SIZE) || 100,
                ttl: parseInt(process.env.MEMORY_CACHE_TTL) || 300 // 5 minutes
            }
        };

        // Feature flags
        this.features = {
            emailVerification: process.env.FEATURE_EMAIL_VERIFICATION !== 'false',
            socialAuth: process.env.FEATURE_SOCIAL_AUTH === 'true',
            passwordReset: process.env.FEATURE_PASSWORD_RESET !== 'false',
            userProfiles: process.env.FEATURE_USER_PROFILES !== 'false',
            adminPanel: process.env.FEATURE_ADMIN_PANEL === 'true',
            aiImageRestyling: process.env.FEATURE_AI_IMAGE_RESTYLING !== 'false',
            socialCampaigns: process.env.FEATURE_SOCIAL_CAMPAIGNS !== 'false',
            emailAutomation: process.env.FEATURE_EMAIL_AUTOMATION !== 'false',
            chatAgent: process.env.FEATURE_CHAT_AGENT !== 'false',
            analytics: process.env.FEATURE_ANALYTICS !== 'false',
            brandCustomization: process.env.FEATURE_BRAND_CUSTOMIZATION !== 'false'
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

    /**
     * Doppler Integration Methods
     */
    async fetchSecretsFromDoppler() {
        try {
            if (!this.doppler.token) {
                logger.warn('Doppler token not configured, skipping secrets fetch');
                return {};
            }

            const response = await axios.get(
                `${this.doppler.apiUrl}/configs/config/secrets`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.doppler.token}`
                    },
                    params: {
                        project: this.doppler.project,
                        config: this.doppler.config
                    },
                    timeout: 10000
                }
            );

            const secrets = {};
            Object.entries(response.data.secrets).forEach(([key, value]) => {
                secrets[key] = value.computed;
            });

            // Update cache
            this.secretsCache.clear();
            Object.entries(secrets).forEach(([key, value]) => {
                this.secretsCache.set(key, {
                    value: value,
                    timestamp: Date.now()
                });
            });
            
            this.lastCacheUpdate = Date.now();
            logger.info(`Fetched ${Object.keys(secrets).length} secrets from Doppler`);
            
            return secrets;

        } catch (error) {
            logger.error('Error fetching secrets from Doppler', {
                error: error.response?.data || error.message
            });
            return {};
        }
    }

    async getSecret(key, defaultValue = null) {
        try {
            // Check if cache is expired
            const now = Date.now();
            if (!this.lastCacheUpdate || (now - this.lastCacheUpdate) > this.cacheExpiry) {
                await this.fetchSecretsFromDoppler();
            }

            // Get from cache
            const cached = this.secretsCache.get(key);
            if (cached && (now - cached.timestamp) < this.cacheExpiry) {
                return cached.value;
            }

            // Fallback to environment variable
            return process.env[key] || defaultValue;

        } catch (error) {
            logger.error(`Error getting secret ${key}`, { error: error.message });
            return process.env[key] || defaultValue;
        }
    }

    async updateSecret(key, value) {
        try {
            if (!this.doppler.token) {
                throw new Error('Doppler token not configured');
            }

            await axios.post(
                `${this.doppler.apiUrl}/configs/config/secrets`,
                {
                    secrets: {
                        [key]: value
                    }
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.doppler.token}`,
                        'Content-Type': 'application/json'
                    },
                    params: {
                        project: this.doppler.project,
                        config: this.doppler.config
                    }
                }
            );

            // Update cache
            this.secretsCache.set(key, {
                value: value,
                timestamp: Date.now()
            });

            logger.info(`Updated secret ${key} in Doppler`);
            return true;

        } catch (error) {
            logger.error(`Error updating secret ${key}`, {
                error: error.response?.data || error.message
            });
            throw error;
        }
    }

    /**
     * Additional Configuration Getters
     */
    getAIConfig() {
        return this.ai;
    }

    getScrapingConfig() {
        return this.scraping;
    }

    getAPIConfig() {
        return this.apis;
    }

    getWorkflowConfig() {
        return this.workflow;
    }

    getStorageConfig() {
        return this.storage;
    }

    getCacheConfig() {
        return this.cache;
    }

    getPaymentConfig() {
        return this.payment;
    }

    /**
     * Enhanced Configuration Validation
     */
    validateExtendedConfig() {
        const warnings = [];
        const errors = [];

        // AI service validations
        if (this.features.aiImageRestyling) {
            if (!this.ai.anthropic.apiKey) {
                warnings.push('AI image restyling enabled but ANTHROPIC_API_KEY missing');
            }
            if (!this.ai.replicate.apiKey) {
                warnings.push('AI image restyling enabled but REPLICATE_API_KEY missing');
            }
        }

        // Email automation validations
        if (this.features.emailAutomation && !this.email.brevo.apiKey) {
            warnings.push('Email automation enabled but BREVO_API_KEY missing');
        }

        // Social campaigns validations
        if (this.features.socialCampaigns && !this.apis.mixPost.apiKey) {
            warnings.push('Social campaigns enabled but MIXPOST_API_KEY missing');
        }

        // Payment validations
        if (this.isProduction && !this.payment.lemonSqueezy.apiKey) {
            warnings.push('Production environment but LEMONSQUEEZY_API_KEY missing');
        }

        // Workflow validations
        if (!this.workflow.n8n.apiKey) {
            warnings.push('N8N_API_KEY missing - workflow automation may be limited');
        }

        // Log warnings
        if (warnings.length > 0) {
            logger.warn('Configuration validation warnings', { warnings });
        }

        if (errors.length > 0) {
            logger.error('Configuration validation errors', { errors });
            throw new Error(`Configuration errors: ${errors.join(', ')}`);
        }

        return { warnings, errors };
    }

    /**
     * Dynamic configuration refresh
     */
    async refreshConfiguration() {
        try {
            logger.info('Refreshing configuration from Doppler...');
            
            // Fetch latest secrets
            const secrets = await this.fetchSecretsFromDoppler();
            
            // Update process.env with new secrets
            Object.entries(secrets).forEach(([key, value]) => {
                process.env[key] = value;
            });
            
            // Rebuild configuration
            this.loadConfig();
            this.validateConfig();
            this.validateExtendedConfig();
            
            logger.info('Configuration refreshed successfully');
            return true;

        } catch (error) {
            logger.error('Error refreshing configuration', { error: error.message });
            return false;
        }
    }

    /**
     * Health check for configuration service
     */
    async healthCheck() {
        try {
            const results = {
                timestamp: new Date().toISOString(),
                doppler_connection: 'unknown',
                configuration_valid: false,
                secrets_cached: this.secretsCache.size,
                last_cache_update: this.lastCacheUpdate
            };

            // Test Doppler connection
            if (this.doppler.token) {
                try {
                    await this.fetchSecretsFromDoppler();
                    results.doppler_connection = 'healthy';
                } catch (error) {
                    results.doppler_connection = 'unhealthy';
                    results.doppler_error = error.message;
                }
            } else {
                results.doppler_connection = 'not_configured';
            }

            // Validate configuration
            try {
                this.validateConfig();
                const extendedValidation = this.validateExtendedConfig();
                results.configuration_valid = true;
                results.validation_warnings = extendedValidation.warnings;
            } catch (error) {
                results.configuration_valid = false;
                results.validation_error = error.message;
            }

            return results;

        } catch (error) {
            logger.error('Error in configuration health check', { error: error.message });
            throw error;
        }
    }
}

// Export singleton instance
module.exports = new Config();