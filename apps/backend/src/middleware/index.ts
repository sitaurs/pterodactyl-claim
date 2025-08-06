import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { rateLimitConfig } from '../config';
import { jidToPhone } from '../utils/crypto';

// Rate limiter by IP
export const ipRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: rateLimitConfig.ipPerMin,
  message: {
    error: 'Too many requests from this IP, please try again later.',
    code: 'RATE_LIMIT_IP'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    logger.warn('IP rate limit exceeded', { 
      ip: req.ip,
      path: req.path,
      limit: rateLimitConfig.ipPerMin 
    });
    
    res.status(429).json({
      error: 'Too many requests from this IP, please try again later.',
      code: 'RATE_LIMIT_IP'
    });
  }
});

// Rate limiter by WhatsApp JID (for claim endpoint)
interface JIDRateLimitStore {
  [jid: string]: {
    count: number;
    resetTime: number;
  };
}

class JIDRateLimiter {
  private store: JIDRateLimitStore = {};
  private windowMs: number;
  private maxRequests: number;

  constructor(windowMs: number, maxRequests: number) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    
    // Cleanup expired entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  isAllowed(jid: string): boolean {
    const now = Date.now();
    const entry = this.store[jid];

    if (!entry || now > entry.resetTime) {
      // First request or window expired
      this.store[jid] = {
        count: 1,
        resetTime: now + this.windowMs
      };
      return true;
    }

    if (entry.count >= this.maxRequests) {
      return false;
    }

    entry.count++;
    return true;
  }

  private cleanup(): void {
    const now = Date.now();
    Object.keys(this.store).forEach(jid => {
      if (now > this.store[jid].resetTime) {
        delete this.store[jid];
      }
    });
  }

  getResetTime(jid: string): number | null {
    const entry = this.store[jid];
    return entry ? entry.resetTime : null;
  }
}

const jidRateLimiter = new JIDRateLimiter(
  60 * 1000, // 1 minute window
  rateLimitConfig.jidPerMin
);

// Middleware for JID-based rate limiting
export const jidRateLimit = (req: Request, res: Response, next: NextFunction) => {
  const waNumberE164 = req.body?.wa_number_e164;
  
  if (!waNumberE164) {
    return next(); // Skip if no WA number in request
  }

  // Convert E.164 to JID format for rate limiting
  const jid = waNumberE164.replace(/^\+/, '') + '@s.whatsapp.net';
  
  if (!jidRateLimiter.isAllowed(jid)) {
    const resetTime = jidRateLimiter.getResetTime(jid);
    const resetDate = resetTime ? new Date(resetTime).toISOString() : null;
    
    logger.warn('JID rate limit exceeded', { 
      wa_jid: jid,
      path: req.path,
      limit: rateLimitConfig.jidPerMin,
      reset_at: resetDate
    });
    
    return res.status(429).json({
      error: 'Too many requests for this WhatsApp number, please try again later.',
      code: 'RATE_LIMIT_JID',
      reset_at: resetDate
    });
  }

  next();
};

// HMAC signature verification middleware
export const verifyHMACSignature = (req: Request, res: Response, next: NextFunction) => {
  const signature = req.headers['x-signature'] as string;
  const timestamp = req.headers['x-timestamp'] as string;
  
  if (!signature || !timestamp) {
    logger.warn('Missing HMAC signature or timestamp', { 
      path: req.path,
      has_signature: !!signature,
      has_timestamp: !!timestamp 
    });
    
    return res.status(401).json({
      error: 'Missing signature or timestamp headers',
      code: 'MISSING_SIGNATURE'
    });
  }

  // Import here to avoid circular dependency
  const { verifyHMACSignature, verifyTimestamp } = require('../utils/crypto');
  
  // Verify timestamp window (60 seconds)
  if (!verifyTimestamp(timestamp, 60)) {
    logger.warn('Invalid timestamp window', { 
      path: req.path,
      timestamp,
      current_time: new Date().toISOString()
    });
    
    return res.status(401).json({
      error: 'Request timestamp is outside allowed window',
      code: 'INVALID_TIMESTAMP'
    });
  }

  // Verify HMAC signature
  const payload = JSON.stringify(req.body);
  if (!verifyHMACSignature(payload, timestamp, signature)) {
    logger.warn('Invalid HMAC signature', { 
      path: req.path,
      timestamp 
    });
    
    return res.status(401).json({
      error: 'Invalid request signature',
      code: 'INVALID_SIGNATURE'
    });
  }

  logger.debug('HMAC signature verified', { path: req.path });
  next();
};

// Internal secret verification for bot RPC
export const verifyInternalSecret = (req: Request, res: Response, next: NextFunction) => {
  const secret = req.headers['x-internal-secret'] as string;
  
  if (!secret) {
    logger.warn('Missing internal secret', { path: req.path });
    return res.status(401).json({
      error: 'Missing internal secret',
      code: 'MISSING_SECRET'
    });
  }

  const { config } = require('../config');
  
  if (secret !== config.INTERNAL_SECRET) {
    logger.warn('Invalid internal secret', { path: req.path });
    return res.status(401).json({
      error: 'Invalid internal secret',
      code: 'INVALID_SECRET'
    });
  }

  next();
};

// Claim token verification middleware
export const verifyClaimToken = (req: Request, res: Response, next: NextFunction) => {
  const { config } = require('../config');
  
  if (!config.CLAIM_STATUS_REQUIRE_TOKEN) {
    return next(); // Token verification disabled
  }

  const token = req.headers['x-claim-token'] as string;
  
  if (!token) {
    return res.status(401).json({
      error: 'Missing claim token',
      code: 'MISSING_CLAIM_TOKEN'
    });
  }

  // Token verification will be done at repository level
  // This middleware just ensures the header is present
  req.claimToken = token;
  next();
};

// Error handling middleware
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  logger.error('Unhandled error in request', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method
  });

  if (res.headersSent) {
    return next(error);
  }

  res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR'
  });
};

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      claimToken?: string;
    }
  }
}

export default {
  ipRateLimit,
  jidRateLimit,
  verifyHMACSignature,
  verifyInternalSecret,
  verifyClaimToken,
  errorHandler
};
