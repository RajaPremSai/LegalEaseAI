import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { AuthService } from '../services/auth';
import { firestoreService } from '../services/firestore';
import { authConfig } from '../config/environment';
import { authMiddleware } from '../middleware/auth';
import { validationMiddleware } from '../middleware/validation';

const router = Router();

// Initialize auth service
const authService = new AuthService(authConfig, firestoreService);

// Validation schemas
const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required'),
  userType: z.enum(['individual', 'small_business', 'enterprise']),
  jurisdiction: z.string().min(1, 'Jurisdiction is required'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

const updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  jurisdiction: z.string().min(1).optional(),
  preferences: z.object({
    language: z.string().optional(),
    notifications: z.boolean().optional(),
    autoDelete: z.boolean().optional(),
  }).optional(),
});

const googleAuthSchema = z.object({
  idToken: z.string().min(1, 'Google ID token is required'),
});

/**
 * POST /auth/register
 * Register a new user
 */
router.post('/register', validationMiddleware(registerSchema), async (req: Request, res: Response) => {
  try {
    const userData = req.body;
    
    const result = await authService.registerUser(userData);
    
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: result.user.id,
          email: result.user.email,
          profile: result.user.profile,
          subscription: result.user.subscription,
        },
        token: result.token,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    
    if (error instanceof Error) {
      if (error.message === 'User already exists with this email') {
        return res.status(409).json({
          success: false,
          error: 'User already exists',
          message: 'An account with this email already exists',
        });
      }
    }
    
    res.status(500).json({
      success: false,
      error: 'Registration failed',
      message: 'Failed to create user account',
    });
  }
});

/**
 * POST /auth/login
 * Authenticate user login
 */
router.post('/login', validationMiddleware(loginSchema), async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    
    const result = await authService.loginUser(email, password);
    
    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: result.user.id,
          email: result.user.email,
          profile: result.user.profile,
          subscription: result.user.subscription,
        },
        token: result.token,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    
    if (error instanceof Error && error.message === 'Invalid email or password') {
      return res.status(401).json({
        success: false,
        error: 'Authentication failed',
        message: 'Invalid email or password',
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Login failed',
      message: 'Authentication service unavailable',
    });
  }
});

/**
 * POST /auth/refresh
 * Refresh authentication token
 */
router.post('/refresh', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];
    
    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Token required',
        message: 'Authentication token is required for refresh',
      });
    }
    
    const newToken = await authService.refreshToken(token);
    
    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        token: newToken,
      },
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    
    res.status(401).json({
      success: false,
      error: 'Token refresh failed',
      message: 'Unable to refresh authentication token',
    });
  }
});

/**
 * POST /auth/logout
 * Logout user and revoke token
 */
router.post('/logout', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];
    
    if (token) {
      await authService.revokeToken(token);
    }
    
    res.json({
      success: true,
      message: 'Logout successful',
    });
  } catch (error) {
    console.error('Logout error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Logout failed',
      message: 'Failed to logout user',
    });
  }
});

/**
 * GET /auth/profile
 * Get current user profile
 */
router.get('/profile', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'User not authenticated',
      });
    }
    
    const user = await firestoreService.getUser(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        message: 'User profile not found',
      });
    }
    
    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          profile: user.profile,
          subscription: user.subscription,
          createdAt: user.createdAt,
        },
      },
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Profile fetch failed',
      message: 'Failed to retrieve user profile',
    });
  }
});

/**
 * PUT /auth/profile
 * Update user profile
 */
router.put('/profile', authMiddleware, validationMiddleware(updateProfileSchema), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'User not authenticated',
      });
    }
    
    const updates = req.body;
    
    // Build update object for nested profile fields
    const updateData: any = {};
    
    if (updates.name) {
      updateData['profile.name'] = updates.name;
    }
    
    if (updates.jurisdiction) {
      updateData['profile.jurisdiction'] = updates.jurisdiction;
    }
    
    if (updates.preferences) {
      Object.keys(updates.preferences).forEach(key => {
        updateData[`profile.preferences.${key}`] = updates.preferences[key];
      });
    }
    
    await firestoreService.updateUser(req.user.id, updateData);
    
    // Fetch updated user data
    const updatedUser = await firestoreService.getUser(req.user.id);
    
    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: {
          id: updatedUser!.id,
          email: updatedUser!.email,
          profile: updatedUser!.profile,
          subscription: updatedUser!.subscription,
        },
      },
    });
  } catch (error) {
    console.error('Profile update error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Profile update failed',
      message: 'Failed to update user profile',
    });
  }
});

/**
 * GET /auth/subscription
 * Get user subscription details
 */
router.get('/subscription', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'User not authenticated',
      });
    }
    
    const user = await firestoreService.getUser(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        message: 'User not found',
      });
    }
    
    res.json({
      success: true,
      data: {
        subscription: user.subscription,
        usage: {
          documentsProcessed: Math.max(0, 5 - user.subscription.documentsRemaining), // Free tier starts with 5
          documentsRemaining: user.subscription.documentsRemaining,
        },
      },
    });
  } catch (error) {
    console.error('Subscription fetch error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Subscription fetch failed',
      message: 'Failed to retrieve subscription details',
    });
  }
});

/**
 * POST /auth/google
 * Authenticate with Google OAuth
 */
router.post('/google', validationMiddleware(googleAuthSchema), async (req: Request, res: Response) => {
  try {
    const { idToken } = req.body;
    
    const result = await authService.authenticateWithGoogle(idToken);
    
    res.json({
      success: true,
      message: result.isNewUser ? 'Account created successfully' : 'Login successful',
      data: {
        user: {
          id: result.user.id,
          email: result.user.email,
          profile: result.user.profile,
          subscription: result.user.subscription,
        },
        token: result.token,
        isNewUser: result.isNewUser,
      },
    });
  } catch (error) {
    console.error('Google authentication error:', error);
    
    if (error instanceof Error) {
      if (error.message === 'Google OAuth not configured') {
        return res.status(501).json({
          success: false,
          error: 'Service unavailable',
          message: 'Google authentication is not configured',
        });
      }
      
      if (error.message === 'Google authentication failed') {
        return res.status(401).json({
          success: false,
          error: 'Authentication failed',
          message: 'Invalid Google credentials',
        });
      }
    }
    
    res.status(500).json({
      success: false,
      error: 'Authentication failed',
      message: 'Google authentication service unavailable',
    });
  }
});

/**
 * POST /auth/verify-token
 * Verify if a token is valid (for client-side validation)
 */
router.post('/verify-token', async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Token required',
        message: 'Token is required for verification',
      });
    }
    
    const decoded = authService.verifyToken(token);
    
    // Verify user still exists
    const user = await firestoreService.getUser(decoded.userId);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token',
        message: 'User associated with token not found',
      });
    }
    
    res.json({
      success: true,
      message: 'Token is valid',
      data: {
        user: {
          id: user.id,
          email: user.email,
          userType: user.profile.userType,
        },
        expiresAt: decoded.exp ? new Date(decoded.exp * 1000) : null,
      },
    });
  } catch (error) {
    console.error('Token verification error:', error);
    
    res.status(401).json({
      success: false,
      error: 'Invalid token',
      message: 'Token verification failed',
    });
  }
});

export default router;