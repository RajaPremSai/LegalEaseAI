import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authConfig } from '../config/environment';

export interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    userType: 'individual' | 'small_business' | 'enterprise';
  };
}

/**
 * Authentication middleware
 * Verifies JWT token and adds user info to request
 */
export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please provide a valid authentication token',
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    try {
      const decoded = jwt.verify(token, authConfig.jwtSecret) as any;
      
      // Add user info to request
      (req as AuthenticatedRequest).user = {
        id: decoded.userId,
        email: decoded.email,
        userType: decoded.userType,
      };

      next();
    } catch (jwtError) {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'Authentication token is invalid or expired',
      });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      error: 'Authentication error',
      message: 'Internal authentication error',
    });
  }
};

/**
 * Optional authentication middleware
 * Adds user info if token is present, but doesn't require it
 */
export const optionalAuthMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    
    try {
      const decoded = jwt.verify(token, authConfig.jwtSecret) as any;
      (req as AuthenticatedRequest).user = {
        id: decoded.userId,
        email: decoded.email,
        userType: decoded.userType,
      };
    } catch (error) {
      // Ignore invalid tokens in optional auth
    }
  }
  
  next();
};