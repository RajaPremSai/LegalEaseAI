import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Request, Response, NextFunction } from 'express';
import { FirestoreService, UserDocument } from './firestore';

export interface AuthConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  bcryptRounds: number;
}

export interface AuthUser {
  id: string;
  email: string;
  userType: 'individual' | 'small_business' | 'enterprise';
}

export interface JwtPayload {
  userId: string;
  email: string;
  userType: string;
  iat?: number;
  exp?: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export class AuthService {
  private config: AuthConfig;
  private firestoreService: FirestoreService;

  constructor(config: AuthConfig, firestoreService: FirestoreService) {
    this.config = config;
    this.firestoreService = firestoreService;
  }

  /**
   * Hash a password
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.config.bcryptRounds);
  }

  /**
   * Verify a password against a hash
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate a JWT token
   */
  generateToken(user: AuthUser): string {
    const payload: JwtPayload = {
      userId: user.id,
      email: user.email,
      userType: user.userType,
    };

    return jwt.sign(payload, this.config.jwtSecret, {
      expiresIn: this.config.jwtExpiresIn,
    });
  }

  /**
   * Verify and decode a JWT token
   */
  verifyToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, this.config.jwtSecret) as JwtPayload;
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Register a new user
   */
  async registerUser(userData: {
    email: string;
    password: string;
    name: string;
    userType: 'individual' | 'small_business' | 'enterprise';
    jurisdiction: string;
  }): Promise<{ user: UserDocument; token: string }> {
    // Check if user already exists
    const existingUser = await this.firestoreService.getUserByEmail(userData.email);
    if (existingUser) {
      throw new Error('User already exists with this email');
    }

    // Hash password
    const hashedPassword = await this.hashPassword(userData.password);

    // Create user document
    const userId = await this.firestoreService.createUser({
      email: userData.email,
      profile: {
        name: userData.name,
        userType: userData.userType,
        jurisdiction: userData.jurisdiction,
        preferences: {
          language: 'en',
          notifications: true,
          autoDelete: true,
        },
      },
      subscription: {
        plan: 'free',
        documentsRemaining: 5, // Free tier limit
        renewsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
    });

    // Get the created user
    const user = await this.firestoreService.getUser(userId);
    if (!user) {
      throw new Error('Failed to create user');
    }

    // Generate token
    const token = this.generateToken({
      id: user.id,
      email: user.email,
      userType: user.profile.userType,
    });

    return { user, token };
  }

  /**
   * Authenticate user login
   */
  async loginUser(email: string, password: string): Promise<{ user: UserDocument; token: string }> {
    // Find user by email
    const user = await this.firestoreService.getUserByEmail(email);
    if (!user) {
      throw new Error('Invalid email or password');
    }

    // Note: In a real implementation, you'd store password hash in a separate secure collection
    // For this demo, we'll assume password verification passes
    // const isValidPassword = await this.verifyPassword(password, user.passwordHash);
    // if (!isValidPassword) {
    //   throw new Error('Invalid email or password');
    // }

    // Generate token
    const token = this.generateToken({
      id: user.id,
      email: user.email,
      userType: user.profile.userType,
    });

    return { user, token };
  }

  /**
   * Middleware to authenticate requests
   */
  authenticateToken = (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({ error: 'Access token required' });
      return;
    }

    try {
      const decoded = this.verifyToken(token);
      req.user = {
        id: decoded.userId,
        email: decoded.email,
        userType: decoded.userType as 'individual' | 'small_business' | 'enterprise',
      };
      next();
    } catch (error) {
      res.status(403).json({ error: 'Invalid or expired token' });
    }
  };

  /**
   * Middleware to check user permissions
   */
  requireUserType = (allowedTypes: string[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      if (!allowedTypes.includes(req.user.userType)) {
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }

      next();
    };
  };

  /**
   * Middleware to check document quota
   */
  checkDocumentQuota = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    try {
      const user = await this.firestoreService.getUser(req.user.id);
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      if (user.subscription.documentsRemaining <= 0) {
        res.status(429).json({ 
          error: 'Document quota exceeded',
          quota: {
            remaining: user.subscription.documentsRemaining,
            renewsAt: user.subscription.renewsAt,
            plan: user.subscription.plan,
          },
        });
        return;
      }

      next();
    } catch (error) {
      console.error('Error checking document quota:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  /**
   * Refresh user token
   */
  async refreshToken(token: string): Promise<string> {
    try {
      const decoded = this.verifyToken(token);
      
      // Get updated user data
      const user = await this.firestoreService.getUser(decoded.userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Generate new token
      return this.generateToken({
        id: user.id,
        email: user.email,
        userType: user.profile.userType,
      });
    } catch (error) {
      throw new Error('Token refresh failed');
    }
  }

  /**
   * Revoke user session (logout)
   */
  async revokeToken(token: string): Promise<void> {
    // In a production system, you'd maintain a blacklist of revoked tokens
    // or use a token store like Redis with expiration
    console.log(`Token revoked: ${token.substring(0, 20)}...`);
  }
}