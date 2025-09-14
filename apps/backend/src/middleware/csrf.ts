import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

interface CSRFRequest extends Request {
  csrfToken?: string;
  session?: {
    csrfSecret?: string;
    [key: string]: any;
  };
}

/**
 * CSRF Protection Middleware
 * Implements double-submit cookie pattern for CSRF protection
 */
export class CSRFProtection {
  private static readonly TOKEN_LENGTH = 32;
  private static readonly SECRET_LENGTH = 32;

  /**
   * Generate a cryptographically secure random token
   */
  private static generateToken(): string {
    return crypto.randomBytes(this.TOKEN_LENGTH).toString('hex');
  }

  /**
   * Generate CSRF secret for session
   */
  private static generateSecret(): string {
    return crypto.randomBytes(this.SECRET_LENGTH).toString('hex');
  }

  /**
   * Create HMAC hash of token with secret
   */
  private static createTokenHash(token: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(token).digest('hex');
  }

  /**
   * Verify CSRF token against secret
   */
  private static verifyToken(token: string, secret: string, expectedHash: string): boolean {
    const computedHash = this.createTokenHash(token, secret);
    return crypto.timingSafeEqual(Buffer.from(computedHash), Buffer.from(expectedHash));
  }

  /**
   * Generate CSRF token for client
   */
  static generateCSRFToken(req: CSRFRequest): string {
    // Ensure session has CSRF secret
    if (!req.session) {
      req.session = {};
    }
    
    if (!req.session.csrfSecret) {
      req.session.csrfSecret = this.generateSecret();
    }

    // Generate token and create hash
    const token = this.generateToken();
    const hash = this.createTokenHash(token, req.session.csrfSecret);
    
    // Store token in request for use in response
    req.csrfToken = `${token}.${hash}`;
    
    return req.csrfToken;
  }

  /**
   * Middleware to add CSRF token to response
   */
  static addTokenToResponse() {
    return (req: CSRFRequest, res: Response, next: NextFunction) => {
      const token = this.generateCSRFToken(req);
      
      // Add token to response headers
      res.setHeader('X-CSRF-Token', token);
      
      // Add token to response body if it's JSON
      const originalSend = res.send;
      res.send = function(data) {
        if (res.getHeader('content-type')?.includes('application/json')) {
          try {
            const jsonData = typeof data === 'string' ? JSON.parse(data) : data;
            if (typeof jsonData === 'object' && jsonData !== null) {
              jsonData.csrfToken = token;
              data = JSON.stringify(jsonData);
            }
          } catch (error) {
            // If parsing fails, just send original data
          }
        }
        return originalSend.call(this, data);
      };
      
      next();
    };
  }

  /**
   * Middleware to verify CSRF token
   */
  static verifyCSRFToken() {
    return (req: CSRFRequest, res: Response, next: NextFunction) => {
      // Skip CSRF check for safe methods
      if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return next();
      }

      // Skip CSRF check for API endpoints using JWT authentication
      // (CSRF is primarily a concern for cookie-based authentication)
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        return next();
      }

      const token = req.headers['x-csrf-token'] as string || 
                   req.body.csrfToken || 
                   req.query.csrfToken as string;

      if (!token) {
        return res.status(403).json({
          error: 'CSRF token missing',
          message: 'CSRF token is required for this request'
        });
      }

      if (!req.session?.csrfSecret) {
        return res.status(403).json({
          error: 'Invalid session',
          message: 'Session does not contain CSRF secret'
        });
      }

      // Parse token and hash
      const [tokenPart, hashPart] = token.split('.');
      if (!tokenPart || !hashPart) {
        return res.status(403).json({
          error: 'Invalid CSRF token format',
          message: 'CSRF token must be in format: token.hash'
        });
      }

      // Verify token
      if (!this.verifyToken(tokenPart, req.session.csrfSecret, hashPart)) {
        return res.status(403).json({
          error: 'Invalid CSRF token',
          message: 'CSRF token verification failed'
        });
      }

      next();
    };
  }

  /**
   * Middleware for routes that need CSRF protection
   */
  static protect() {
    return [
      this.addTokenToResponse(),
      this.verifyCSRFToken()
    ];
  }
}

/**
 * Simple CSRF middleware for basic protection
 */
export const csrfProtection = CSRFProtection.protect();

/**
 * CSRF token generator middleware
 */
export const csrfTokenGenerator = CSRFProtection.addTokenToResponse();

/**
 * CSRF token verifier middleware
 */
export const csrfTokenVerifier = CSRFProtection.verifyCSRFToken();