const logger = require('../../utils/logger');

/**
 * Centralized error handling service
 * Provides consistent error formatting, logging, and response handling
 */
class ErrorService {
    constructor() {
        this.errorCodes = {
            // Authentication errors
            AUTH_INVALID_CREDENTIALS: {
                code: 'AUTH_INVALID_CREDENTIALS',
                message: 'Invalid email or password',
                httpStatus: 401
            },
            AUTH_USER_NOT_FOUND: {
                code: 'AUTH_USER_NOT_FOUND',
                message: 'User not found',
                httpStatus: 404
            },
            AUTH_USER_EXISTS: {
                code: 'AUTH_USER_EXISTS',
                message: 'User already exists',
                httpStatus: 409
            },
            AUTH_EMAIL_NOT_CONFIRMED: {
                code: 'AUTH_EMAIL_NOT_CONFIRMED',
                message: 'Email not confirmed',
                httpStatus: 401
            },
            AUTH_TOKEN_INVALID: {
                code: 'AUTH_TOKEN_INVALID',
                message: 'Invalid or expired token',
                httpStatus: 401
            },
            AUTH_SESSION_EXPIRED: {
                code: 'AUTH_SESSION_EXPIRED',
                message: 'Session has expired',
                httpStatus: 401
            },
            
            // Validation errors
            VALIDATION_FAILED: {
                code: 'VALIDATION_FAILED',
                message: 'Validation failed',
                httpStatus: 400
            },
            VALIDATION_EMAIL_INVALID: {
                code: 'VALIDATION_EMAIL_INVALID',
                message: 'Invalid email format',
                httpStatus: 400
            },
            VALIDATION_PASSWORD_WEAK: {
                code: 'VALIDATION_PASSWORD_WEAK',
                message: 'Password does not meet security requirements',
                httpStatus: 400
            },
            
            // Database errors
            DATABASE_CONNECTION_FAILED: {
                code: 'DATABASE_CONNECTION_FAILED',
                message: 'Database connection failed',
                httpStatus: 503
            },
            DATABASE_QUERY_FAILED: {
                code: 'DATABASE_QUERY_FAILED',
                message: 'Database query failed',
                httpStatus: 500
            },
            DATABASE_TIMEOUT: {
                code: 'DATABASE_TIMEOUT',
                message: 'Database operation timed out',
                httpStatus: 504
            },
            
            // Rate limiting
            RATE_LIMIT_EXCEEDED: {
                code: 'RATE_LIMIT_EXCEEDED',
                message: 'Too many requests, please try again later',
                httpStatus: 429
            },
            
            // Generic errors
            INTERNAL_ERROR: {
                code: 'INTERNAL_ERROR',
                message: 'Internal server error',
                httpStatus: 500
            },
            SERVICE_UNAVAILABLE: {
                code: 'SERVICE_UNAVAILABLE',
                message: 'Service temporarily unavailable',
                httpStatus: 503
            },
            INVALID_REQUEST: {
                code: 'INVALID_REQUEST',
                message: 'Invalid request format',
                httpStatus: 400
            }
        };
    }

    /**
     * Create a standardized error object
     * @param {string} errorCode - Error code from this.errorCodes
     * @param {Object} options - Additional error options
     * @returns {Object} Standardized error object
     */
    createError(errorCode, options = {}) {
        const errorDef = this.errorCodes[errorCode];
        if (!errorDef) {
            throw new Error(`Unknown error code: ${errorCode}`);
        }

        return {
            code: errorDef.code,
            message: options.message || errorDef.message,
            httpStatus: options.httpStatus || errorDef.httpStatus,
            details: options.details || null,
            timestamp: new Date().toISOString(),
            correlationId: options.correlationId || null
        };
    }

    /**
     * Map Supabase errors to application errors
     * @param {Object} supabaseError - Error from Supabase
     * @param {Object} options - Additional options
     * @returns {Object} Mapped error object
     */
    mapSupabaseError(supabaseError, options = {}) {
        if (!supabaseError) {
            return this.createError('INTERNAL_ERROR', options);
        }

        const errorMessage = supabaseError.message || supabaseError.error_description || 'Unknown error';
        const errorCode = supabaseError.error || supabaseError.code;

        // Map common Supabase errors
        switch (errorCode) {
            case 'invalid_credentials':
            case 'email_not_confirmed':
                return this.createError('AUTH_INVALID_CREDENTIALS', {
                    ...options,
                    details: errorMessage
                });
                
            case 'user_not_found':
                return this.createError('AUTH_USER_NOT_FOUND', {
                    ...options,
                    details: errorMessage
                });
                
            case 'user_already_registered':
            case 'email_address_already_registered':
                return this.createError('AUTH_USER_EXISTS', {
                    ...options,
                    details: errorMessage
                });
                
            case 'email_not_confirmed':
                return this.createError('AUTH_EMAIL_NOT_CONFIRMED', {
                    ...options,
                    details: errorMessage
                });
                
            case 'invalid_token':
            case 'token_expired':
                return this.createError('AUTH_TOKEN_INVALID', {
                    ...options,
                    details: errorMessage
                });
                
            case 'session_not_found':
                return this.createError('AUTH_SESSION_EXPIRED', {
                    ...options,
                    details: errorMessage
                });
                
            default:
                // Check for database connection issues
                if (errorMessage.includes('connection') || errorMessage.includes('timeout')) {
                    return this.createError('DATABASE_CONNECTION_FAILED', {
                        ...options,
                        details: errorMessage
                    });
                }
                
                // Default to internal error
                return this.createError('INTERNAL_ERROR', {
                    ...options,
                    details: errorMessage
                });
        }
    }

    /**
     * Log error with appropriate level and context
     * @param {Object} error - Error object
     * @param {Object} context - Additional context
     * @param {Object} log - Logger instance
     */
    logError(error, context = {}, log = logger) {
        const logData = {
            errorCode: error.code,
            message: error.message,
            httpStatus: error.httpStatus,
            details: error.details,
            correlationId: error.correlationId,
            ...context
        };

        // Log level based on error severity
        if (error.httpStatus >= 500) {
            log.error('Server error occurred', logData);
        } else if (error.httpStatus >= 400) {
            log.warn('Client error occurred', logData);
        } else {
            log.info('Error handled', logData);
        }
    }

    /**
     * Create HTTP response for error
     * @param {Object} res - Express response object
     * @param {Object} error - Error object
     * @param {Object} options - Response options
     */
    sendErrorResponse(res, error, options = {}) {
        const response = {
            error: error.message,
            code: error.code,
            timestamp: error.timestamp
        };

        // Include details in development mode
        if (process.env.NODE_ENV === 'development' && error.details) {
            response.details = error.details;
        }

        // Include correlation ID if present
        if (error.correlationId) {
            response.correlationId = error.correlationId;
        }

        // Add any additional response data
        if (options.additionalData) {
            Object.assign(response, options.additionalData);
        }

        res.status(error.httpStatus).json(response);
    }

    /**
     * Handle async errors in Express routes
     * @param {Function} fn - Async route handler
     * @returns {Function} Wrapped route handler
     */
    asyncHandler(fn) {
        return (req, res, next) => {
            Promise.resolve(fn(req, res, next)).catch(next);
        };
    }

    /**
     * Express error middleware
     * @param {Object} err - Error object
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     * @param {Function} next - Next middleware
     */
    errorMiddleware(err, req, res, next) {
        const log = logger.child({ correlationId: req.correlationId });
        
        // If error is already formatted, use it
        if (err.code && err.httpStatus) {
            this.logError(err, {
                url: req.url,
                method: req.method,
                userAgent: req.get('User-Agent'),
                ip: req.ip
            }, log);
            
            return this.sendErrorResponse(res, err);
        }

        // Handle validation errors
        if (err.name === 'ValidationError') {
            const validationError = this.createError('VALIDATION_FAILED', {
                correlationId: req.correlationId,
                details: err.message
            });
            
            this.logError(validationError, {
                url: req.url,
                method: req.method
            }, log);
            
            return this.sendErrorResponse(res, validationError);
        }

        // Handle unknown errors
        const internalError = this.createError('INTERNAL_ERROR', {
            correlationId: req.correlationId,
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
        
        this.logError(internalError, {
            url: req.url,
            method: req.method,
            stack: err.stack
        }, log);
        
        this.sendErrorResponse(res, internalError);
    }
}

// Export singleton instance
module.exports = new ErrorService();