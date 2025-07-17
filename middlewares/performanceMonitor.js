const os = require('os');
const process = require('process');

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      requests: {
        total: 0,
        active: 0,
        completed: 0,
        failed: 0,
        averageResponseTime: 0,
        slowRequests: 0 // Requests taking > 5 seconds
      },
      system: {
        cpuUsage: 0,
        memoryUsage: 0,
        freeMemory: 0,
        totalMemory: 0,
        loadAverage: [],
        uptime: 0
      },
      database: {
        activeConnections: 0,
        totalQueries: 0,
        slowQueries: 0,
        failedQueries: 0,
        averageQueryTime: 0
      },
      errors: {
        total: 0,
        rate: 0,
        lastError: null
      }
    };
    
    this.requestTimes = [];
    this.maxRequestTimeHistory = 1000;
    this.slowRequestThreshold = 5000; // 5 seconds
    this.monitoringInterval = 30000; // 30 seconds
    
    this.startMonitoring();
    console.log('📊 Performance Monitor initialized');
  }

  startMonitoring() {
    // Update system metrics periodically
    setInterval(() => {
      this.updateSystemMetrics();
    }, this.monitoringInterval);
    
    // Log performance summary every 5 minutes
    setInterval(() => {
      this.logPerformanceSummary();
    }, 5 * 60 * 1000);
  }

  updateSystemMetrics() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    this.metrics.system = {
      cpuUsage: this.calculateCPUPercentage(cpuUsage),
      memoryUsage: memUsage.heapUsed,
      freeMemory: os.freemem(),
      totalMemory: os.totalmem(),
      loadAverage: os.loadavg(),
      uptime: process.uptime()
    };
    
    // Calculate request rate and error rate
    this.calculateRates();
  }

  calculateCPUPercentage(cpuUsage) {
    if (!this.lastCpuUsage) {
      this.lastCpuUsage = cpuUsage;
      return 0;
    }
    
    const userDiff = cpuUsage.user - this.lastCpuUsage.user;
    const systemDiff = cpuUsage.system - this.lastCpuUsage.system;
    const totalDiff = userDiff + systemDiff;
    
    this.lastCpuUsage = cpuUsage;
    
    // Convert microseconds to percentage
    return (totalDiff / 1000000 / (this.monitoringInterval / 1000) * 100).toFixed(2);
  }

  calculateRates() {
    const now = Date.now();
    const timeWindow = 60000; // 1 minute
    
    // Filter recent request times
    this.requestTimes = this.requestTimes.filter(time => now - time < timeWindow);
    
    // Calculate average response time
    if (this.requestTimes.length > 0) {
      const totalTime = this.requestTimes.reduce((sum, time) => sum + time, 0);
      this.metrics.requests.averageResponseTime = Math.round(totalTime / this.requestTimes.length);
    }
  }

  // Middleware function
  middleware() {
    return (req, res, next) => {
      const startTime = Date.now();
      
      // Increment active requests
      this.metrics.requests.active++;
      this.metrics.requests.total++;
      
      // Track request completion
      const originalSend = res.send;
      const originalJson = res.json;
      
      const trackCompletion = () => {
        const duration = Date.now() - startTime;
        
        // Update metrics
        this.metrics.requests.active--;
        this.metrics.requests.completed++;
        
        // Track response time
        this.requestTimes.push(duration);
        if (this.requestTimes.length > this.maxRequestTimeHistory) {
          this.requestTimes.shift();
        }
        
        // Track slow requests
        if (duration > this.slowRequestThreshold) {
          this.metrics.requests.slowRequests++;
          console.warn(`🐌 Slow request detected: ${req.method} ${req.path} - ${duration}ms`);
        }
        
        // Add performance headers
        res.set({
          'X-Response-Time': `${duration}ms`,
          'X-Server-Load': this.getServerLoadStatus(),
          'X-Active-Requests': this.metrics.requests.active.toString()
        });
      };
      
      // Override response methods to track completion
      res.send = function(body) {
        trackCompletion();
        return originalSend.call(this, body);
      };
      
      res.json = function(obj) {
        trackCompletion();
        return originalJson.call(this, obj);
      };
      
      // Track errors
      res.on('error', (err) => {
        this.metrics.requests.failed++;
        this.metrics.errors.total++;
        this.metrics.errors.lastError = {
          message: err.message,
          timestamp: new Date().toISOString(),
          path: req.path,
          method: req.method
        };
      });
      
      next();
    };
  }

  getServerLoadStatus() {
    const cpuLoad = parseFloat(this.metrics.system.cpuUsage);
    const memoryUsage = (this.metrics.system.memoryUsage / this.metrics.system.totalMemory) * 100;
    const activeRequests = this.metrics.requests.active;
    
    if (cpuLoad > 80 || memoryUsage > 85 || activeRequests > 100) {
      return 'high';
    } else if (cpuLoad > 60 || memoryUsage > 70 || activeRequests > 50) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  getMetrics() {
    return {
      ...this.metrics,
      timestamp: new Date().toISOString(),
      serverLoad: this.getServerLoadStatus(),
      healthStatus: this.getHealthStatus()
    };
  }

  getHealthStatus() {
    const cpuLoad = parseFloat(this.metrics.system.cpuUsage);
    const memoryUsage = (this.metrics.system.memoryUsage / this.metrics.system.totalMemory) * 100;
    const errorRate = this.metrics.requests.total > 0 
      ? (this.metrics.requests.failed / this.metrics.requests.total) * 100 
      : 0;
    
    const issues = [];
    
    if (cpuLoad > 90) issues.push('High CPU usage');
    if (memoryUsage > 90) issues.push('High memory usage');
    if (errorRate > 5) issues.push('High error rate');
    if (this.metrics.requests.active > 200) issues.push('High concurrent requests');
    
    return {
      status: issues.length === 0 ? 'healthy' : 'warning',
      issues,
      score: Math.max(0, 100 - (cpuLoad + memoryUsage + errorRate))
    };
  }

  logPerformanceSummary() {
    const metrics = this.getMetrics();
    
    console.log('\n📊 Performance Summary:');
    console.log(`🔄 Requests: ${metrics.requests.total} total, ${metrics.requests.active} active`);
    console.log(`⏱️  Avg Response Time: ${metrics.requests.averageResponseTime}ms`);
    console.log(`🐌 Slow Requests: ${metrics.requests.slowRequests}`);
    console.log(`💾 Memory: ${(metrics.system.memoryUsage / 1024 / 1024).toFixed(2)}MB used`);
    console.log(`🖥️  CPU: ${metrics.system.cpuUsage}%`);
    console.log(`📈 Server Load: ${metrics.serverLoad}`);
    console.log(`❤️  Health: ${metrics.healthStatus.status} (Score: ${metrics.healthStatus.score.toFixed(1)})`);
    
    if (metrics.healthStatus.issues.length > 0) {
      console.log(`⚠️  Issues: ${metrics.healthStatus.issues.join(', ')}`);
    }
    
    console.log('\n');
  }

  // Database performance tracking
  trackDatabaseQuery(duration, success = true) {
    this.metrics.database.totalQueries++;
    
    if (!success) {
      this.metrics.database.failedQueries++;
    }
    
    if (duration > 1000) { // Slow query threshold: 1 second
      this.metrics.database.slowQueries++;
      console.warn(`🐌 Slow database query detected: ${duration}ms`);
    }
    
    // Update average query time
    const totalTime = this.metrics.database.averageQueryTime * (this.metrics.database.totalQueries - 1) + duration;
    this.metrics.database.averageQueryTime = Math.round(totalTime / this.metrics.database.totalQueries);
  }

  // Connection pool tracking
  updateConnectionPoolStats(stats) {
    this.metrics.database.activeConnections = stats.activeConnections || 0;
  }

  // Alert system for critical issues
  checkAlerts() {
    const alerts = [];
    const metrics = this.getMetrics();
    
    // CPU alert
    if (parseFloat(metrics.system.cpuUsage) > 95) {
      alerts.push({
        type: 'critical',
        message: `Critical CPU usage: ${metrics.system.cpuUsage}%`,
        timestamp: new Date().toISOString()
      });
    }
    
    // Memory alert
    const memoryUsagePercent = (metrics.system.memoryUsage / metrics.system.totalMemory) * 100;
    if (memoryUsagePercent > 95) {
      alerts.push({
        type: 'critical',
        message: `Critical memory usage: ${memoryUsagePercent.toFixed(2)}%`,
        timestamp: new Date().toISOString()
      });
    }
    
    // Active requests alert
    if (metrics.requests.active > 500) {
      alerts.push({
        type: 'warning',
        message: `High concurrent requests: ${metrics.requests.active}`,
        timestamp: new Date().toISOString()
      });
    }
    
    // Error rate alert
    const errorRate = metrics.requests.total > 0 
      ? (metrics.requests.failed / metrics.requests.total) * 100 
      : 0;
    if (errorRate > 10) {
      alerts.push({
        type: 'warning',
        message: `High error rate: ${errorRate.toFixed(2)}%`,
        timestamp: new Date().toISOString()
      });
    }
    
    return alerts;
  }

  // Reset metrics (useful for testing)
  reset() {
    this.metrics.requests = {
      total: 0,
      active: 0,
      completed: 0,
      failed: 0,
      averageResponseTime: 0,
      slowRequests: 0
    };
    
    this.metrics.database = {
      activeConnections: 0,
      totalQueries: 0,
      slowQueries: 0,
      failedQueries: 0,
      averageQueryTime: 0
    };
    
    this.metrics.errors = {
      total: 0,
      rate: 0,
      lastError: null
    };
    
    this.requestTimes = [];
  }
}

// Create singleton instance
const performanceMonitor = new PerformanceMonitor();

module.exports = performanceMonitor;