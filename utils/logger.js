const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Custom format for console output
const consoleFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        let metaStr = '';
        if (Object.keys(meta).length > 0) {
            metaStr = ` ${JSON.stringify(meta, null, 2)}`;
        }
        return `${timestamp} [${level}]: ${message}${metaStr}`;
    })
);

// Custom format for file output
const fileFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
);

// Create a structured logger with correlation IDs
class Logger {
    constructor() {
        this.winston = winston.createLogger({
            level: process.env.LOG_LEVEL || 'info',
            format: fileFormat,
            defaultMeta: {
                service: 'nester-backend',
                environment: process.env.NODE_ENV || 'development'
            },
            transports: [
                // Error log file
                new winston.transports.File({
                    filename: path.join(logsDir, 'error.log'),
                    level: 'error',
                    maxsize: 5242880, // 5MB
                    maxFiles: 5,
                    format: fileFormat
                }),
                
                // Combined log file
                new winston.transports.File({
                    filename: path.join(logsDir, 'combined.log'),
                    maxsize: 5242880, // 5MB
                    maxFiles: 5,
                    format: fileFormat
                }),
                
                // Console output (only in development)
                ...(process.env.NODE_ENV !== 'production' ? [
                    new winston.transports.Console({
                        format: consoleFormat
                    })
                ] : [])
            ],
            
            // Handle uncaught exceptions
            exceptionHandlers: [
                new winston.transports.File({
                    filename: path.join(logsDir, 'exceptions.log'),
                    format: fileFormat
                })
            ],
            
            // Handle unhandled promise rejections
            rejectionHandlers: [
                new winston.transports.File({
                    filename: path.join(logsDir, 'rejections.log'),
                    format: fileFormat
                })
            ]
        });
    }

    log(level, message, meta = {}) {
        const timestamp = new Date().toISOString();
        const logData = {
            timestamp,
            level: level.toUpperCase(),
            service: 'NESTER',
            message,
            ...meta
        };
        
        this.winston.log(level, message, logData);
    }

    debug(message, meta = {}) {
        this.log('debug', message, meta);
    }

    info(message, meta = {}) {
        this.log('info', message, meta);
    }

    warn(message, meta = {}) {
        this.log('warn', message, meta);
    }

    error(message, meta = {}) {
        this.log('error', message, meta);
    }

    // Create child logger with correlation ID
    child(correlationId) {
        return {
            debug: (message, meta = {}) => this.debug(message, { correlationId, ...meta }),
            info: (message, meta = {}) => this.info(message, { correlationId, ...meta }),
            warn: (message, meta = {}) => this.warn(message, { correlationId, ...meta }),
            error: (message, meta = {}) => this.error(message, { correlationId, ...meta })
        };
    }

    // Add request logging middleware helper
    requestLogger(req, res, next) {
        const start = Date.now();
        const { method, url, ip, headers } = req;
        
        // Log request
        this.info('Incoming request', {
            method,
            url,
            ip,
            userAgent: headers['user-agent'],
            requestId: req.id || 'unknown'
        });
        
        // Log response when finished
        res.on('finish', () => {
            const duration = Date.now() - start;
            const { statusCode } = res;
            
            const logLevel = statusCode >= 400 ? 'warn' : 'info';
            this[logLevel]('Request completed', {
                method,
                url,
                statusCode,
                duration: `${duration}ms`,
                requestId: req.id || 'unknown'
            });
        });
        
        next();
    }

    // Add structured logging helpers
    logError(error, context = {}) {
        this.error('Error occurred', {
            message: error.message,
            stack: error.stack,
            name: error.name,
            ...context
        });
    }

    logPerformance(operation, duration, metadata = {}) {
        this.info('Performance metric', {
            operation,
            duration: `${duration}ms`,
            ...metadata
        });
    }

    logSecurity(event, details = {}) {
        this.warn('Security event', {
            event,
            timestamp: new Date().toISOString(),
            ...details
        });
    }

    logAudit(action, userId, details = {}) {
        this.info('Audit log', {
            action,
            userId,
            timestamp: new Date().toISOString(),
            ...details
        });
    }

    // Add database query logging
    logQuery(query, duration, params = {}) {
        if (process.env.LOG_QUERIES === 'true') {
            this.debug('Database query', {
                query: query.substring(0, 500), // Truncate long queries
                duration: `${duration}ms`,
                params: Object.keys(params).length > 0 ? params : undefined
            });
        }
    }

    // Add API integration logging
    logAPICall(service, endpoint, method, duration, statusCode, error = null) {
        const logData = {
            service,
            endpoint,
            method,
            duration: `${duration}ms`,
            statusCode
        };
        
        if (error) {
            logData.error = error.message;
            this.error('API call failed', logData);
        } else {
            this.info('API call completed', logData);
        }
    }

    // Add workflow logging
    logWorkflow(workflowId, status, step, metadata = {}) {
        this.info('Workflow event', {
            workflowId,
            status,
            step,
            timestamp: new Date().toISOString(),
            ...metadata
        });
    }

    // Add AI operation logging
    logAI(operation, model, tokens, duration, metadata = {}) {
        this.info('AI operation', {
            operation,
            model,
            tokens,
            duration: `${duration}ms`,
            timestamp: new Date().toISOString(),
            ...metadata
        });
    }
}

// Create logger instance
const logger = new Logger();

// Environment-specific configuration
if (process.env.NODE_ENV === 'production') {
    // In production, also log to external service if configured
    if (process.env.LOG_EXTERNAL_ENDPOINT) {
        logger.winston.add(new winston.transports.Http({
            host: process.env.LOG_EXTERNAL_HOST,
            port: process.env.LOG_EXTERNAL_PORT,
            path: process.env.LOG_EXTERNAL_PATH,
            ssl: process.env.LOG_EXTERNAL_SSL === 'true'
        }));
    }
}

// Export logger instance
module.exports = logger;