const validator = require('validator');
const rateLimit = require('express-rate-limit');
const logger = require('../../utils/logger');

class ValidationService {
    constructor() {
        this.emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        this.passwordMinLength = 8;
        this.passwordMaxLength = 128;
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
}

module.exports = new ValidationService();