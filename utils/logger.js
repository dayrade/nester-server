const winston = require('winston');

// Create a structured logger with correlation IDs
class Logger {
    constructor() {
        this.winston = winston.createLogger({
            level: process.env.LOG_LEVEL || 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.errors({ stack: true }),
                winston.format.json()
            ),
            defaultMeta: { service: 'nester-auth' },
            transports: [
                new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
                new winston.transports.File({ filename: 'logs/combined.log' }),
                new winston.transports.Console({
                    format: winston.format.combine(
                        winston.format.colorize(),
                        winston.format.simple()
                    )
                })
            ]
        });
    }

    log(level, message, meta = {}) {
        const timestamp = new Date().toISOString();
        const logData = {
            timestamp,
            level: level.toUpperCase(),
            service: 'AUTH',
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
}

module.exports = new Logger();