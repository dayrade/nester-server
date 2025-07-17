const crypto = require('crypto');

class SessionManager {
  constructor() {
    this.sessions = new Map();
    this.userSessions = new Map(); // Track sessions by user ID
    this.maxSessions = parseInt(process.env.MAX_SESSIONS) || 10000;
    this.sessionTimeout = parseInt(process.env.SESSION_TIMEOUT) || 24 * 60 * 60 * 1000; // 24 hours
    this.cleanupInterval = parseInt(process.env.CLEANUP_INTERVAL) || 60 * 60 * 1000; // 1 hour
    this.maxSessionsPerUser = parseInt(process.env.MAX_SESSIONS_PER_USER) || 5;
    
    // Start cleanup process
    this.startCleanup();
    
    console.log('🔐 Session Manager initialized');
    console.log(`📊 Max sessions: ${this.maxSessions}`);
    console.log(`⏰ Session timeout: ${this.sessionTimeout / 1000 / 60} minutes`);
  }

  generateSessionId() {
    return crypto.randomBytes(32).toString('hex');
  }

  createSession(userId, userData = {}) {
    // Check if we're at max capacity
    if (this.sessions.size >= this.maxSessions) {
      this.cleanupExpiredSessions();
      
      if (this.sessions.size >= this.maxSessions) {
        throw new Error('Maximum session capacity reached');
      }
    }

    // Check user session limit
    const userSessionIds = this.userSessions.get(userId) || [];
    if (userSessionIds.length >= this.maxSessionsPerUser) {
      // Remove oldest session for this user
      const oldestSessionId = userSessionIds[0];
      this.destroySession(oldestSessionId);
    }

    const sessionId = this.generateSessionId();
    const session = {
      id: sessionId,
      userId,
      userData,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      accessCount: 1,
      ipAddress: null,
      userAgent: null,
      isActive: true
    };

    this.sessions.set(sessionId, session);
    
    // Update user sessions tracking
    const updatedUserSessions = [...userSessionIds, sessionId];
    this.userSessions.set(userId, updatedUserSessions);

    console.log(`✅ Created session ${sessionId} for user ${userId}`);
    return sessionId;
  }

  getSession(sessionId) {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return null;
    }

    // Check if session is expired
    if (this.isSessionExpired(session)) {
      this.destroySession(sessionId);
      return null;
    }

    // Update last accessed time
    session.lastAccessed = Date.now();
    session.accessCount++;
    
    return session;
  }

  updateSession(sessionId, updates) {
    const session = this.sessions.get(sessionId);
    
    if (!session || this.isSessionExpired(session)) {
      return false;
    }

    Object.assign(session, updates, {
      lastAccessed: Date.now()
    });

    return true;
  }

  destroySession(sessionId) {
    const session = this.sessions.get(sessionId);
    
    if (session) {
      // Remove from user sessions tracking
      const userSessionIds = this.userSessions.get(session.userId) || [];
      const updatedUserSessions = userSessionIds.filter(id => id !== sessionId);
      
      if (updatedUserSessions.length === 0) {
        this.userSessions.delete(session.userId);
      } else {
        this.userSessions.set(session.userId, updatedUserSessions);
      }
      
      this.sessions.delete(sessionId);
      console.log(`🗑️ Destroyed session ${sessionId} for user ${session.userId}`);
      return true;
    }
    
    return false;
  }

  destroyUserSessions(userId) {
    const userSessionIds = this.userSessions.get(userId) || [];
    let destroyedCount = 0;
    
    userSessionIds.forEach(sessionId => {
      if (this.sessions.delete(sessionId)) {
        destroyedCount++;
      }
    });
    
    this.userSessions.delete(userId);
    
    if (destroyedCount > 0) {
      console.log(`🗑️ Destroyed ${destroyedCount} sessions for user ${userId}`);
    }
    
    return destroyedCount;
  }

  isSessionExpired(session) {
    return (Date.now() - session.lastAccessed) > this.sessionTimeout;
  }

  cleanupExpiredSessions() {
    let cleanedCount = 0;
    const now = Date.now();
    
    for (const [sessionId, session] of this.sessions) {
      if (this.isSessionExpired(session)) {
        this.destroySession(sessionId);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} expired sessions`);
    }
    
    return cleanedCount;
  }

  startCleanup() {
    setInterval(() => {
      this.cleanupExpiredSessions();
    }, this.cleanupInterval);
    
    console.log(`🔄 Session cleanup started (every ${this.cleanupInterval / 1000 / 60} minutes)`);
  }

  getSessionStats() {
    const now = Date.now();
    let activeCount = 0;
    let expiredCount = 0;
    const userCounts = {};
    
    for (const [sessionId, session] of this.sessions) {
      if (this.isSessionExpired(session)) {
        expiredCount++;
      } else {
        activeCount++;
      }
      
      userCounts[session.userId] = (userCounts[session.userId] || 0) + 1;
    }
    
    return {
      total: this.sessions.size,
      active: activeCount,
      expired: expiredCount,
      maxCapacity: this.maxSessions,
      utilization: ((this.sessions.size / this.maxSessions) * 100).toFixed(2) + '%',
      uniqueUsers: this.userSessions.size,
      averageSessionsPerUser: this.userSessions.size > 0 
        ? (this.sessions.size / this.userSessions.size).toFixed(2) 
        : 0,
      topUsers: Object.entries(userCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([userId, count]) => ({ userId, sessionCount: count }))
    };
  }

  getUserSessions(userId) {
    const userSessionIds = this.userSessions.get(userId) || [];
    return userSessionIds
      .map(sessionId => this.sessions.get(sessionId))
      .filter(session => session && !this.isSessionExpired(session));
  }

  // Middleware function for Express
  middleware() {
    return (req, res, next) => {
      const sessionId = req.cookies?.sessionId || req.headers['x-session-id'];
      
      if (sessionId) {
        const session = this.getSession(sessionId);
        if (session) {
          req.session = session;
          req.sessionId = sessionId;
          
          // Update session with request info
          this.updateSession(sessionId, {
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
          });
        }
      }
      
      // Add session methods to request
      req.createSession = (userId, userData) => {
        const newSessionId = this.createSession(userId, userData);
        res.cookie('sessionId', newSessionId, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: this.sessionTimeout
        });
        return newSessionId;
      };
      
      req.destroySession = () => {
        if (req.sessionId) {
          this.destroySession(req.sessionId);
          res.clearCookie('sessionId');
          delete req.session;
          delete req.sessionId;
        }
      };
      
      next();
    };
  }

  // Graceful shutdown
  async shutdown() {
    console.log('🔒 Shutting down Session Manager...');
    console.log(`📊 Final stats: ${this.sessions.size} sessions for ${this.userSessions.size} users`);
    
    this.sessions.clear();
    this.userSessions.clear();
    
    console.log('✅ Session Manager shutdown complete');
  }
}

// Create singleton instance
const sessionManager = new SessionManager();

// Graceful shutdown handlers
process.on('SIGTERM', async () => {
  await sessionManager.shutdown();
});

process.on('SIGINT', async () => {
  await sessionManager.shutdown();
});

module.exports = sessionManager;