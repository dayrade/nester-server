const validator = require('validator');
const Joi = require('joi');
const rateLimit = require('express-rate-limit');
const logger = require('../../utils/logger');

class ValidationService {
    constructor() {
        this.emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        this.passwordMinLength = 8;
        this.passwordMaxLength = 128;
        this.schemas = this.initializeSchemas();
    }

    /**
     * Initialize all validation schemas
     */
    initializeSchemas() {
        return {
            // Property validation schemas
            property: {
                create: Joi.object({
                    title: Joi.string().min(5).max(200).required(),
                    description: Joi.string().min(20).max(2000).required(),
                    price: Joi.number().positive().required(),
                    address: Joi.object({
                        street: Joi.string().required(),
                        city: Joi.string().required(),
                        state: Joi.string().length(2).required(),
                        zipCode: Joi.string().pattern(/^\d{5}(-\d{4})?$/).required(),
                        country: Joi.string().default('US')
                    }).required(),
                    propertyType: Joi.string().valid(
                        'single_family', 'condo', 'townhouse', 'multi_family',
                        'land', 'commercial', 'other'
                    ).required(),
                    bedrooms: Joi.number().integer().min(0).max(20),
                    bathrooms: Joi.number().min(0).max(20),
                    squareFootage: Joi.number().positive(),
                    lotSize: Joi.number().positive(),
                    yearBuilt: Joi.number().integer().min(1800).max(new Date().getFullYear()),
                    features: Joi.array().items(Joi.string()),
                    amenities: Joi.array().items(Joi.string()),
                    listingStatus: Joi.string().valid(
                        'active', 'pending', 'sold', 'off_market'
                    ).default('active'),
                    mlsNumber: Joi.string().optional(),
                    virtualTourUrl: Joi.string().uri().optional(),
                    videoUrl: Joi.string().uri().optional(),
                    documents: Joi.array().items(Joi.string().uri()).optional()
                }),
                
                update: Joi.object({
                    title: Joi.string().min(5).max(200),
                    description: Joi.string().min(20).max(2000),
                    price: Joi.number().positive(),
                    address: Joi.object({
                        street: Joi.string(),
                        city: Joi.string(),
                        state: Joi.string().length(2),
                        zipCode: Joi.string().pattern(/^\d{5}(-\d{4})?$/),
                        country: Joi.string()
                    }),
                    propertyType: Joi.string().valid(
                        'single_family', 'condo', 'townhouse', 'multi_family',
                        'land', 'commercial', 'other'
                    ),
                    bedrooms: Joi.number().integer().min(0).max(20),
                    bathrooms: Joi.number().min(0).max(20),
                    squareFootage: Joi.number().positive(),
                    lotSize: Joi.number().positive(),
                    yearBuilt: Joi.number().integer().min(1800).max(new Date().getFullYear()),
                    features: Joi.array().items(Joi.string()),
                    amenities: Joi.array().items(Joi.string()),
                    listingStatus: Joi.string().valid(
                        'active', 'pending', 'sold', 'off_market'
                    ),
                    mlsNumber: Joi.string(),
                    virtualTourUrl: Joi.string().uri(),
                    videoUrl: Joi.string().uri(),
                    documents: Joi.array().items(Joi.string().uri())
                }).min(1)
            },

            // User/Agent validation schemas
            user: {
                register: Joi.object({
                    email: Joi.string().email().required(),
                    password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/).required(),
                    firstName: Joi.string().min(2).max(50).required(),
                    lastName: Joi.string().min(2).max(50).required(),
                    phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required(),
                    licenseNumber: Joi.string().optional(),
                    brokerage: Joi.string().max(100).optional(),
                    website: Joi.string().uri().optional(),
                    bio: Joi.string().max(1000).optional()
                }),
                
                login: Joi.object({
                    email: Joi.string().email().required(),
                    password: Joi.string().required()
                }),
                
                update: Joi.object({
                    firstName: Joi.string().min(2).max(50),
                    lastName: Joi.string().min(2).max(50),
                    phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/),
                    licenseNumber: Joi.string(),
                    brokerage: Joi.string().max(100),
                    website: Joi.string().uri(),
                    bio: Joi.string().max(1000)
                }).min(1)
            },

            // Brand validation schemas
            brand: {
                create: Joi.object({
                    name: Joi.string().min(2).max(100).required(),
                    primaryColor: Joi.string().pattern(/^#[0-9A-F]{6}$/i).required(),
                    secondaryColor: Joi.string().pattern(/^#[0-9A-F]{6}$/i).required(),
                    accentColor: Joi.string().pattern(/^#[0-9A-F]{6}$/i).optional(),
                    fontFamily: Joi.string().max(50).optional(),
                    logoUrl: Joi.string().uri().optional(),
                    websiteUrl: Joi.string().uri().optional(),
                    tagline: Joi.string().max(200).optional(),
                    description: Joi.string().max(500).optional()
                }),
                
                update: Joi.object({
                    name: Joi.string().min(2).max(100),
                    primaryColor: Joi.string().pattern(/^#[0-9A-F]{6}$/i),
                    secondaryColor: Joi.string().pattern(/^#[0-9A-F]{6}$/i),
                    accentColor: Joi.string().pattern(/^#[0-9A-F]{6}$/i),
                    fontFamily: Joi.string().max(50),
                    logoUrl: Joi.string().uri(),
                    websiteUrl: Joi.string().uri(),
                    tagline: Joi.string().max(200),
                    description: Joi.string().max(500)
                }).min(1)
            },

            // Chat validation schemas
            chat: {
                message: Joi.object({
                    message: Joi.string().min(1).max(1000).required(),
                    sessionId: Joi.string().uuid().optional(),
                    propertyId: Joi.string().uuid().required(),
                    visitorInfo: Joi.object({
                        name: Joi.string().max(100).optional(),
                        email: Joi.string().email().optional(),
                        phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional()
                    }).optional()
                }),
                
                leadCapture: Joi.object({
                    name: Joi.string().min(2).max(100).required(),
                    email: Joi.string().email().required(),
                    phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required(),
                    message: Joi.string().max(500).optional(),
                    propertyId: Joi.string().uuid().required(),
                    sessionId: Joi.string().uuid().required()
                })
            },

            // File upload validation schemas
            upload: {
                image: Joi.object({
                    mimetype: Joi.string().valid(
                        'image/jpeg', 'image/jpg', 'image/png', 'image/webp'
                    ).required(),
                    size: Joi.number().max(10 * 1024 * 1024).required(), // 10MB
                    filename: Joi.string().required()
                }),
                
                document: Joi.object({
                    mimetype: Joi.string().valid(
                        'application/pdf', 'application/msword',
                        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                    ).required(),
                    size: Joi.number().max(25 * 1024 * 1024).required(), // 25MB
                    filename: Joi.string().required()
                })
            },

            // Query parameter validation schemas
            query: {
                pagination: Joi.object({
                    page: Joi.number().integer().min(1).default(1),
                    limit: Joi.number().integer().min(1).max(100).default(20),
                    sortBy: Joi.string().optional(),
                    sortOrder: Joi.string().valid('asc', 'desc').default('desc')
                }),
                
                propertyFilters: Joi.object({
                    minPrice: Joi.number().positive(),
                    maxPrice: Joi.number().positive(),
                    propertyType: Joi.string().valid(
                        'single_family', 'condo', 'townhouse', 'multi_family',
                        'land', 'commercial', 'other'
                    ),
                    minBedrooms: Joi.number().integer().min(0),
                    maxBedrooms: Joi.number().integer().min(0),
                    minBathrooms: Joi.number().min(0),
                    maxBathrooms: Joi.number().min(0),
                    minSquareFootage: Joi.number().positive(),
                    maxSquareFootage: Joi.number().positive(),
                    city: Joi.string(),
                    state: Joi.string().length(2),
                    zipCode: Joi.string().pattern(/^\d{5}(-\d{4})?$/),
                    listingStatus: Joi.string().valid(
                        'active', 'pending', 'sold', 'off_market'
                    ),
                    features: Joi.array().items(Joi.string()),
                    search: Joi.string().max(100)
                })
            },

            // Social media validation schemas
            social: {
                campaign: Joi.object({
                    propertyId: Joi.string().uuid().required(),
                    platforms: Joi.array().items(
                        Joi.string().valid(
                            'instagram', 'facebook', 'linkedin', 'tiktok',
                            'twitter', 'bluesky', 'threads'
                        )
                    ).min(1).required(),
                    duration: Joi.number().integer().min(7).max(70).default(70),
                    postsPerDay: Joi.number().integer().min(1).max(5).default(3),
                    startDate: Joi.date().min('now').optional()
                }),
                
                post: Joi.object({
                    content: Joi.string().min(10).max(2200).required(),
                    platform: Joi.string().valid(
                        'instagram', 'facebook', 'linkedin', 'tiktok',
                        'twitter', 'bluesky', 'threads'
                    ).required(),
                    scheduledFor: Joi.date().min('now').required(),
                    imageUrl: Joi.string().uri().optional(),
                    hashtags: Joi.array().items(Joi.string().pattern(/^#[a-zA-Z0-9_]+$/)).optional()
                })
            }
        };
    }

    // Email validation
    validateEmail(email) {
        if (!email || typeof email !== 'string') {
            return { isValid: false, error: 'Email is required and must be a string' };
        }

        const trimmedEmail = email.trim().toLowerCase();
        
        if (!this.emailRegex.test(trimmedEmail)) {
            return { isValid: false, error: 'Invalid email format' };
        }

        if (!validator.isEmail(trimmedEmail)) {
            return { isValid: false, error: 'Invalid email address' };
        }

        if (trimmedEmail.length > 254) {
            return { isValid: false, error: 'Email address too long' };
        }

        return { isValid: true, sanitized: trimmedEmail };
    }

    // Password validation
    validatePassword(password) {
        if (!password || typeof password !== 'string') {
            return { isValid: false, error: 'Password is required and must be a string' };
        }

        if (password.length < this.passwordMinLength) {
            return { 
                isValid: false, 
                error: `Password must be at least ${this.passwordMinLength} characters long` 
            };
        }

        if (password.length > this.passwordMaxLength) {
            return { 
                isValid: false, 
                error: `Password must not exceed ${this.passwordMaxLength} characters` 
            };
        }

        // Check for at least one uppercase, lowercase, number, and special character
        const hasUppercase = /[A-Z]/.test(password);
        const hasLowercase = /[a-z]/.test(password);
        const hasNumber = /\d/.test(password);
        const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

        if (!hasUppercase || !hasLowercase || !hasNumber || !hasSpecialChar) {
            return {
                isValid: false,
                error: 'Password must contain at least one uppercase letter, lowercase letter, number, and special character'
            };
        }

        return { isValid: true };
    }

    // Sanitize user input
    sanitizeInput(input) {
        if (typeof input !== 'string') {
            return input;
        }

        // Remove potential XSS and injection attempts
        return validator.escape(input.trim());
    }

    // Validate request body for signup
    validateSignupRequest(body) {
        const errors = [];
        const sanitized = {};

        // Validate email
        const emailValidation = this.validateEmail(body.email);
        if (!emailValidation.isValid) {
            errors.push(emailValidation.error);
        } else {
            sanitized.email = emailValidation.sanitized;
        }

        // Validate password if provided
        if (body.password) {
            const passwordValidation = this.validatePassword(body.password);
            if (!passwordValidation.isValid) {
                errors.push(passwordValidation.error);
            } else {
                sanitized.password = body.password; // Don't sanitize passwords
            }
        }

        // Validate userId if provided
        if (body.userId) {
            if (typeof body.userId !== 'string' || !validator.isUUID(body.userId)) {
                errors.push('Invalid user ID format');
            } else {
                sanitized.userId = body.userId;
            }
        }

        return {
            isValid: errors.length === 0,
            errors,
            sanitized
        };
    }

    // Validate request body for signin
    validateSigninRequest(body) {
        const errors = [];
        const sanitized = {};

        // Validate email
        const emailValidation = this.validateEmail(body.email);
        if (!emailValidation.isValid) {
            errors.push(emailValidation.error);
        } else {
            sanitized.email = emailValidation.sanitized;
        }

        // Validate password
        if (!body.password || typeof body.password !== 'string') {
            errors.push('Password is required');
        } else if (body.password.length < 1) {
            errors.push('Password cannot be empty');
        } else {
            sanitized.password = body.password;
        }

        // Validate userId if provided
        if (body.userId) {
            if (typeof body.userId !== 'string' || !validator.isUUID(body.userId)) {
                errors.push('Invalid user ID format');
            } else {
                sanitized.userId = body.userId;
            }
        }

        return {
            isValid: errors.length === 0,
            errors,
            sanitized
        };
    }

    // Rate limiting configurations
    createAuthRateLimit() {
        return rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 5, // Limit each IP to 5 requests per windowMs
            message: {
                success: false,
                error: 'Too many authentication attempts, please try again later',
                retryAfter: '15 minutes'
            },
            standardHeaders: true,
            legacyHeaders: false,
            handler: (req, res) => {
                logger.warn('Rate limit exceeded for authentication', {
                    ip: req.ip,
                    userAgent: req.headers['user-agent'],
                    path: req.path
                });
                res.status(429).json({
                    success: false,
                    error: 'Too many authentication attempts, please try again later',
                    retryAfter: '15 minutes'
                });
            }
        });
    }

    createSignupRateLimit() {
        return rateLimit({
            windowMs: 60 * 60 * 1000, // 1 hour
            max: 3, // Limit each IP to 3 signup attempts per hour
            message: {
                success: false,
                error: 'Too many signup attempts, please try again later',
                retryAfter: '1 hour'
            },
            standardHeaders: true,
            legacyHeaders: false
        });
    }

    /**
     * Validate data against a schema
     * @param {Object} data - Data to validate
     * @param {string} schemaPath - Path to schema (e.g., 'property.create')
     * @param {Object} options - Joi validation options
     * @returns {Object} Validation result
     */
    validate(data, schemaPath, options = {}) {
        try {
            const schema = this.getSchema(schemaPath);
            if (!schema) {
                throw new Error(`Schema not found: ${schemaPath}`);
            }

            const defaultOptions = {
                abortEarly: false,
                allowUnknown: false,
                stripUnknown: true
            };

            const validationOptions = { ...defaultOptions, ...options };
            const result = schema.validate(data, validationOptions);

            if (result.error) {
                const errors = result.error.details.map(detail => ({
                    field: detail.path.join('.'),
                    message: detail.message,
                    value: detail.context?.value
                }));

                logger.warn('Validation failed', {
                    schema: schemaPath,
                    errors,
                    data: this.sanitizeLogData(data)
                });

                return {
                    isValid: false,
                    errors,
                    data: null
                };
            }

            return {
                isValid: true,
                errors: null,
                data: result.value
            };

        } catch (error) {
            logger.error('Validation error', {
                schema: schemaPath,
                error: error.message,
                data: this.sanitizeLogData(data)
            });

            return {
                isValid: false,
                errors: [{ field: 'general', message: error.message }],
                data: null
            };
        }
    }

    /**
     * Get schema by path
     * @param {string} schemaPath - Path to schema
     * @returns {Object} Joi schema
     */
    getSchema(schemaPath) {
        const parts = schemaPath.split('.');
        let schema = this.schemas;

        for (const part of parts) {
            if (schema[part]) {
                schema = schema[part];
            } else {
                return null;
            }
        }

        return schema;
    }

    /**
     * Validate middleware for Express routes
     * @param {string} schemaPath - Path to schema
     * @param {string} source - Source of data ('body', 'query', 'params')
     * @returns {Function} Express middleware
     */
    validateMiddleware(schemaPath, source = 'body') {
        return (req, res, next) => {
            const data = req[source];
            const result = this.validate(data, schemaPath);

            if (!result.isValid) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: result.errors
                });
            }

            // Replace request data with validated/sanitized data
            req[source] = result.data;
            next();
        };
    }

    /**
     * Validate file upload
     * @param {Object} file - Uploaded file object
     * @param {string} type - File type ('image' or 'document')
     * @returns {Object} Validation result
     */
    validateFile(file, type = 'image') {
        if (!file) {
            return {
                isValid: false,
                errors: [{ field: 'file', message: 'No file provided' }]
            };
        }

        return this.validate(file, `upload.${type}`);
    }

    /**
     * Validate multiple files
     * @param {Array} files - Array of file objects
     * @param {string} type - File type
     * @param {number} maxFiles - Maximum number of files allowed
     * @returns {Object} Validation result
     */
    validateFiles(files, type = 'image', maxFiles = 10) {
        if (!Array.isArray(files) || files.length === 0) {
            return {
                isValid: false,
                errors: [{ field: 'files', message: 'No files provided' }]
            };
        }

        if (files.length > maxFiles) {
            return {
                isValid: false,
                errors: [{ field: 'files', message: `Maximum ${maxFiles} files allowed` }]
            };
        }

        const errors = [];
        const validFiles = [];

        files.forEach((file, index) => {
            const result = this.validateFile(file, type);
            if (!result.isValid) {
                errors.push(...result.errors.map(error => ({
                    ...error,
                    field: `files[${index}].${error.field}`
                })));
            } else {
                validFiles.push(file);
            }
        });

        return {
            isValid: errors.length === 0,
            errors: errors.length > 0 ? errors : null,
            data: validFiles
        };
    }

    /**
     * Sanitize data for logging (remove sensitive information)
     * @param {Object} data - Data to sanitize
     * @returns {Object} Sanitized data
     */
    sanitizeLogData(data) {
        if (!data || typeof data !== 'object') {
            return data;
        }

        const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'authorization'];
        const sanitized = { ...data };

        sensitiveFields.forEach(field => {
            if (sanitized[field]) {
                sanitized[field] = '[REDACTED]';
            }
        });

        return sanitized;
    }
}

module.exports = new ValidationService();