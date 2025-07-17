const { createClient } = require('@supabase/supabase-js');

class ConnectionPool {
  constructor() {
    this.pools = new Map();
    this.maxConnections = parseInt(process.env.MAX_DB_CONNECTIONS) || 20;
    this.connectionTimeout = parseInt(process.env.CONNECTION_TIMEOUT) || 30000;
    this.idleTimeout = parseInt(process.env.IDLE_TIMEOUT) || 300000; // 5 minutes
    this.retryAttempts = 3;
    this.retryDelay = 1000;
    
    // Initialize default pool
    this.initializePool('default');
    
    // Cleanup idle connections periodically
    setInterval(() => this.cleanupIdleConnections(), 60000); // Every minute
  }

  initializePool(poolName = 'default') {
    if (this.pools.has(poolName)) {
      return this.pools.get(poolName);
    }

    const pool = {
      connections: [],
      activeConnections: 0,
      totalConnections: 0,
      lastUsed: Date.now(),
      stats: {
        created: 0,
        destroyed: 0,
        errors: 0,
        timeouts: 0
      }
    };

    this.pools.set(poolName, pool);
    console.log(`📊 Initialized connection pool: ${poolName}`);
    return pool;
  }

  async getConnection(poolName = 'default') {
    const pool = this.pools.get(poolName) || this.initializePool(poolName);
    pool.lastUsed = Date.now();

    // Try to get an existing idle connection
    const idleConnection = pool.connections.find(conn => !conn.inUse && !conn.expired);
    if (idleConnection) {
      idleConnection.inUse = true;
      idleConnection.lastUsed = Date.now();
      pool.activeConnections++;
      return idleConnection.client;
    }

    // Create new connection if under limit
    if (pool.totalConnections < this.maxConnections) {
      return await this.createConnection(pool);
    }

    // Wait for available connection
    return await this.waitForConnection(pool);
  }

  async createConnection(pool) {
    try {
      const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY, {
        auth: {
          autoRefreshToken: true,
          persistSession: false,
          detectSessionInUrl: false
        },
        db: {
          schema: 'public'
        },
        global: {
          headers: {
            'x-application-name': 'nester-backend-pool',
            'x-connection-id': `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
          }
        }
      });

      // Test connection
      const { error } = await client.from('users').select('count').limit(1);
      if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows found" which is OK
        throw error;
      }

      const connection = {
        client,
        id: `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        created: Date.now(),
        lastUsed: Date.now(),
        inUse: true,
        expired: false
      };

      pool.connections.push(connection);
      pool.totalConnections++;
      pool.activeConnections++;
      pool.stats.created++;

      console.log(`🔗 Created new connection: ${connection.id} (Total: ${pool.totalConnections})`);
      return client;
    } catch (error) {
      pool.stats.errors++;
      console.error('Failed to create database connection:', error);
      throw new Error('Database connection failed');
    }
  }

  async waitForConnection(pool, attempt = 1) {
    if (attempt > this.retryAttempts) {
      pool.stats.timeouts++;
      throw new Error('Connection pool timeout - no available connections');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Connection timeout after ${this.connectionTimeout}ms`));
      }, this.connectionTimeout);

      const checkForConnection = () => {
        const idleConnection = pool.connections.find(conn => !conn.inUse && !conn.expired);
        if (idleConnection) {
          clearTimeout(timeout);
          idleConnection.inUse = true;
          idleConnection.lastUsed = Date.now();
          pool.activeConnections++;
          resolve(idleConnection.client);
        } else {
          setTimeout(checkForConnection, this.retryDelay * attempt);
        }
      };

      checkForConnection();
    });
  }

  releaseConnection(client, poolName = 'default') {
    const pool = this.pools.get(poolName);
    if (!pool) return;

    const connection = pool.connections.find(conn => conn.client === client);
    if (connection && connection.inUse) {
      connection.inUse = false;
      connection.lastUsed = Date.now();
      pool.activeConnections--;
    }
  }

  cleanupIdleConnections() {
    const now = Date.now();
    
    for (const [poolName, pool] of this.pools) {
      const idleConnections = pool.connections.filter(conn => 
        !conn.inUse && (now - conn.lastUsed) > this.idleTimeout
      );

      idleConnections.forEach(conn => {
        conn.expired = true;
        pool.totalConnections--;
        pool.stats.destroyed++;
      });

      pool.connections = pool.connections.filter(conn => !conn.expired);

      if (idleConnections.length > 0) {
        console.log(`🧹 Cleaned up ${idleConnections.length} idle connections from pool: ${poolName}`);
      }
    }
  }

  getPoolStats(poolName = 'default') {
    const pool = this.pools.get(poolName);
    if (!pool) return null;

    return {
      poolName,
      totalConnections: pool.totalConnections,
      activeConnections: pool.activeConnections,
      idleConnections: pool.totalConnections - pool.activeConnections,
      maxConnections: this.maxConnections,
      utilization: (pool.activeConnections / this.maxConnections * 100).toFixed(2) + '%',
      stats: pool.stats,
      lastUsed: new Date(pool.lastUsed).toISOString()
    };
  }

  getAllPoolStats() {
    const stats = {};
    for (const poolName of this.pools.keys()) {
      stats[poolName] = this.getPoolStats(poolName);
    }
    return stats;
  }

  async closeAllConnections() {
    console.log('🔒 Closing all database connections...');
    
    for (const [poolName, pool] of this.pools) {
      pool.connections.forEach(conn => {
        conn.expired = true;
      });
      pool.connections = [];
      pool.totalConnections = 0;
      pool.activeConnections = 0;
      console.log(`Closed all connections in pool: ${poolName}`);
    }
    
    this.pools.clear();
  }
}

// Create singleton instance
const connectionPool = new ConnectionPool();

// Graceful shutdown
process.on('SIGTERM', async () => {
  await connectionPool.closeAllConnections();
});

process.on('SIGINT', async () => {
  await connectionPool.closeAllConnections();
});

module.exports = connectionPool;