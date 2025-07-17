const { supabase } = require('../../config/supabaseClient');
const logger = require('../../utils/logger');

class DatabaseHealthService {
    constructor() {
        this.connectionStatus = {
            isHealthy: false,
            lastCheck: null,
            consecutiveFailures: 0,
            lastError: null
        };
        this.maxConsecutiveFailures = 3;
        this.cacheTimeout = 30000; // 30 seconds
    }

    async testConnection(forceCheck = false) {
        const now = Date.now();
        
        // Return cached result if recent and not forcing check
        if (!forceCheck && 
            this.connectionStatus.lastCheck && 
            (now - this.connectionStatus.lastCheck) < this.cacheTimeout) {
            return {
                connected: this.connectionStatus.isHealthy,
                error: this.connectionStatus.lastError,
                cached: true
            };
        }

        try {
            logger.debug('Testing database connection...');
            
            const startTime = Date.now();
            const { data, error } = await supabase
                .from('users')
                .select('count')
                .limit(1);
            
            const responseTime = Date.now() - startTime;
            
            if (error) {
                this.connectionStatus.consecutiveFailures++;
                this.connectionStatus.isHealthy = false;
                this.connectionStatus.lastError = error;
                
                logger.error('Database connection test failed', {
                    error: error.message,
                    code: error.code,
                    details: error.details,
                    hint: error.hint,
                    consecutiveFailures: this.connectionStatus.consecutiveFailures,
                    responseTime
                });
                
                return { connected: false, error, responseTime };
            }
            
            // Reset failure count on success
            this.connectionStatus.consecutiveFailures = 0;
            this.connectionStatus.isHealthy = true;
            this.connectionStatus.lastError = null;
            this.connectionStatus.lastCheck = now;
            
            logger.debug('Database connection successful', { responseTime });
            return { connected: true, error: null, responseTime };
            
        } catch (err) {
            this.connectionStatus.consecutiveFailures++;
            this.connectionStatus.isHealthy = false;
            this.connectionStatus.lastError = err;
            
            logger.error('Database connection exception', {
                message: err.message,
                stack: err.stack,
                consecutiveFailures: this.connectionStatus.consecutiveFailures
            });
            
            return { connected: false, error: err };
        } finally {
            this.connectionStatus.lastCheck = now;
        }
    }

    isCircuitBreakerOpen() {
        return this.connectionStatus.consecutiveFailures >= this.maxConsecutiveFailures;
    }

    getHealthStatus() {
        return {
            ...this.connectionStatus,
            circuitBreakerOpen: this.isCircuitBreakerOpen()
        };
    }

    async waitForHealthy(maxWaitTime = 30000, checkInterval = 1000) {
        const startTime = Date.now();
        
        while (Date.now() - startTime < maxWaitTime) {
            const result = await this.testConnection(true);
            if (result.connected) {
                return true;
            }
            
            await new Promise(resolve => setTimeout(resolve, checkInterval));
        }
        
        return false;
    }
}

module.exports = new DatabaseHealthService();