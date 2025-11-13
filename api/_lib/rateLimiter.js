/**
 * Token Bucket Rate Limiter
 * Tracks requests per IP address with configurable limits
 */

const stores = new Map();

/**
 * Rate limiter configuration
 * @typedef {Object} RateLimitConfig
 * @property {number} maxRequests - Maximum requests allowed
 * @property {number} windowMs - Time window in milliseconds
 */

/**
 * Create a rate limiter for an endpoint
 * @param {RateLimitConfig} config
 * @returns {Function} Middleware function
 */
export function createRateLimiter({ maxRequests = 100, windowMs = 15 * 60 * 1000 }) {
  const storeKey = `${maxRequests}_${windowMs}`;
  
  if (!stores.has(storeKey)) {
    stores.set(storeKey, new Map());
  }
  
  const store = stores.get(storeKey);
  
  // Clean up old entries every 5 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [key, data] of store.entries()) {
      if (now - data.resetTime > windowMs) {
        store.delete(key);
      }
    }
  }, 5 * 60 * 1000);
  
  return function rateLimitMiddleware(req) {
    const identifier = getClientIdentifier(req);
    const now = Date.now();
    
    let clientData = store.get(identifier);
    
    if (!clientData || now - clientData.resetTime > windowMs) {
      // New window
      clientData = {
        count: 0,
        resetTime: now
      };
      store.set(identifier, clientData);
    }
    
    clientData.count++;
    
    const remaining = Math.max(0, maxRequests - clientData.count);
    const resetTime = new Date(clientData.resetTime + windowMs).toISOString();
    
    return {
      allowed: clientData.count <= maxRequests,
      remaining,
      resetTime,
      limit: maxRequests
    };
  };
}

/**
 * Get client identifier from request
 * Uses multiple headers to handle proxies/CDNs
 */
function getClientIdentifier(req) {
  // Vercel provides x-real-ip and x-forwarded-for
  const forwarded = req.headers['x-forwarded-for'];
  const realIp = req.headers['x-real-ip'];
  
  if (realIp) return realIp;
  if (forwarded) return forwarded.split(',')[0].trim();
  
  // Fallback to connection info
  return req.socket?.remoteAddress || 'unknown';
}

/**
 * Helper to add rate limit headers to response
 */
export function addRateLimitHeaders(res, limitResult) {
  res.setHeader('X-RateLimit-Limit', limitResult.limit);
  res.setHeader('X-RateLimit-Remaining', limitResult.remaining);
  res.setHeader('X-RateLimit-Reset', limitResult.resetTime);
}
