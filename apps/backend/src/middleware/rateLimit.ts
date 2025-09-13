import { Request, Response, NextFunction } from 'express';
import { rateLimitConfig } from '../config/environment';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

// In-memory store for rate limiting (use Redis in production)
const store: RateLimitStore = {};

/**
 * Rate limiting middleware
 * Limits requests per IP address within a time window
 */
export const rateLimitMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const clientId = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = rateLimitConfig.windowMs;
  const maxRequests = rateLimitConfig.maxRequests;

  // Clean up expired entries
  Object.keys(store).forEach(key => {
    if (store[key].resetTime < now) {
      delete store[key];
    }
  });

  // Initialize or get current count for client
  if (!store[clientId] || store[clientId].resetTime < now) {
    store[clientId] = {
      count: 0,
      resetTime: now + windowMs,
    };
  }

  // Increment request count
  store[clientId].count++;

  // Set rate limit headers
  const remaining = Math.max(0, maxRequests - store[clientId].count);
  const resetTime = Math.ceil(store[clientId].resetTime / 1000);

  res.set({
    'X-RateLimit-Limit': maxRequests.toString(),
    'X-RateLimit-Remaining': remaining.toString(),
    'X-RateLimit-Reset': resetTime.toString(),
  });

  // Check if limit exceeded
  if (store[clientId].count > maxRequests) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: `Too many requests. Limit: ${maxRequests} per ${windowMs / 1000} seconds`,
      retryAfter: Math.ceil((store[clientId].resetTime - now) / 1000),
    });
  }

  next();
};

/**
 * Upload-specific rate limiting
 * More restrictive limits for file uploads
 */
export const uploadRateLimitMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const clientId = req.ip || req.connection.remoteAddress || 'unknown';
  const uploadKey = `upload:${clientId}`;
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute window
  const maxUploads = 5; // Max 5 uploads per minute

  // Clean up expired entries
  Object.keys(store).forEach(key => {
    if (key.startsWith('upload:') && store[key].resetTime < now) {
      delete store[key];
    }
  });

  // Initialize or get current count for client
  if (!store[uploadKey] || store[uploadKey].resetTime < now) {
    store[uploadKey] = {
      count: 0,
      resetTime: now + windowMs,
    };
  }

  // Increment upload count
  store[uploadKey].count++;

  // Set upload rate limit headers
  const remaining = Math.max(0, maxUploads - store[uploadKey].count);
  const resetTime = Math.ceil(store[uploadKey].resetTime / 1000);

  res.set({
    'X-Upload-RateLimit-Limit': maxUploads.toString(),
    'X-Upload-RateLimit-Remaining': remaining.toString(),
    'X-Upload-RateLimit-Reset': resetTime.toString(),
  });

  // Check if upload limit exceeded
  if (store[uploadKey].count > maxUploads) {
    return res.status(429).json({
      error: 'Upload rate limit exceeded',
      message: `Too many file uploads. Limit: ${maxUploads} per minute`,
      retryAfter: Math.ceil((store[uploadKey].resetTime - now) / 1000),
    });
  }

  next();
};