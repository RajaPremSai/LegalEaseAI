import { Request, Response, NextFunction } from 'express';
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';

// Initialize DOMPurify with JSDOM for server-side use
const window = new JSDOM('').window;
const purify = DOMPurify(window);

/**
 * Input sanitization middleware
 * Sanitizes all string inputs to prevent XSS attacks
 */
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  try {
    // Recursively sanitize object properties
    const sanitizeObject = (obj: any): any => {
      if (typeof obj === 'string') {
        return purify.sanitize(obj, { 
          ALLOWED_TAGS: [], 
          ALLOWED_ATTR: [],
          KEEP_CONTENT: true 
        });
      }
      
      if (Array.isArray(obj)) {
        return obj.map(sanitizeObject);
      }
      
      if (obj && typeof obj === 'object') {
        const sanitized: any = {};
        for (const [key, value] of Object.entries(obj)) {
          sanitized[key] = sanitizeObject(value);
        }
        return sanitized;
      }
      
      return obj;
    };

    // Sanitize request body
    if (req.body) {
      req.body = sanitizeObject(req.body);
    }

    // Sanitize query parameters
    if (req.query) {
      req.query = sanitizeObject(req.query);
    }

    // Sanitize URL parameters
    if (req.params) {
      req.params = sanitizeObject(req.params);
    }

    next();
  } catch (error) {
    console.error('Input sanitization error:', error);
    return res.status(400).json({
      error: 'Invalid input data',
      message: 'Request contains invalid or potentially harmful content'
    });
  }
};

/**
 * XSS Protection middleware
 * Additional layer of XSS protection beyond input sanitization
 */
export const xssProtection = (req: Request, res: Response, next: NextFunction) => {
  // Set XSS protection headers
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  next();
};

/**
 * Rate limiting for API endpoints
 */
export const createRateLimit = (windowMs: number, max: number, message?: string) => {
  return rateLimit({
    windowMs,
    max,
    message: message || 'Too many requests from this IP, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'Too many requests from this IP, please try again later',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
  });
};

/**
 * Strict rate limiting for sensitive endpoints
 */
export const strictRateLimit = createRateLimit(15 * 60 * 1000, 5); // 5 requests per 15 minutes

/**
 * Standard rate limiting for API endpoints
 */
export const standardRateLimit = createRateLimit(15 * 60 * 1000, 100); // 100 requests per 15 minutes

/**
 * Upload rate limiting
 */
export const uploadRateLimit = createRateLimit(60 * 60 * 1000, 10); // 10 uploads per hour

/**
 * Input validation rules for common fields
 */
export const commonValidationRules = {
  email: body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
    
  password: body('password')
    .isLength({ min: 8, max: 128 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must be 8-128 characters with uppercase, lowercase, number, and special character'),
    
  documentId: body('documentId')
    .isUUID()
    .withMessage('Valid document ID is required'),
    
  userId: body('userId')
    .isUUID()
    .withMessage('Valid user ID is required'),
    
  text: body('text')
    .isLength({ min: 1, max: 10000 })
    .trim()
    .withMessage('Text must be 1-10000 characters'),
    
  filename: body('filename')
    .matches(/^[a-zA-Z0-9._-]+$/)
    .isLength({ min: 1, max: 255 })
    .withMessage('Filename must contain only alphanumeric characters, dots, hyphens, and underscores')
};

/**
 * Validation error handler
 */
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map(error => ({
        field: error.type === 'field' ? error.path : 'unknown',
        message: error.msg,
        value: error.type === 'field' ? error.value : undefined
      }))
    });
  }
  
  next();
};

/**
 * Security headers middleware
 */
export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Content Security Policy
  res.setHeader('Content-Security-Policy', 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' https://apis.google.com; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "img-src 'self' data: https:; " +
    "connect-src 'self' https://api.google.com https://*.googleapis.com; " +
    "frame-ancestors 'none';"
  );
  
  // Strict Transport Security
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  
  // Permissions Policy
  res.setHeader('Permissions-Policy', 
    'camera=(), microphone=(), geolocation=(), payment=(), usb=()'
  );
  
  next();
};

/**
 * Request size limiter
 */
export const requestSizeLimiter = (maxSize: string = '50mb') => {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = req.get('content-length');
    
    if (contentLength) {
      const sizeInMB = parseInt(contentLength) / (1024 * 1024);
      const maxSizeInMB = parseInt(maxSize.replace('mb', ''));
      
      if (sizeInMB > maxSizeInMB) {
        return res.status(413).json({
          error: 'Request too large',
          message: `Request size exceeds ${maxSize} limit`
        });
      }
    }
    
    next();
  };
};