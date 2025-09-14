import { AuthService, AuthConfig } from '../../services/auth';
import { FirestoreService, UserDocument } from '../../services/firestore';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

// Mock dependencies
jest.mock('../../services/firestore');
jest.mock('jsonwebtoken');
jest.mock('bcryptjs');
jest.mock('google-auth-library');

const mockFirestoreService = {
  createUser: jest.fn(),
  getUser: jest.fn(),
  getUserByEmail: jest.fn(),
  updateUser: jest.fn(),
} as jest.Mocked<FirestoreService>;

const mockAuthConfig: AuthConfig = {
  jwtSecret: 'test-secret-key-that-is-at-least-32-characters-long',
  jwtExpiresIn: '24h',
  bcryptRounds: 12,
  googleClientId: 'test-google-client-id',
  googleClientSecret: 'test-google-client-secret',
};

describe('AuthService', () => {
  let authService: AuthService;
  
  beforeEach(() => {
    jest.clearAllMocks();
    authService = new AuthService(mockAuthConfig, mockFirestoreService);
  });

  describe('Password Management', () => {
    it('should hash password correctly', async () => {
      const password = 'testpassword123';
      const hashedPassword = 'hashed-password';
      
      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);
      
      const result = await authService.hashPassword(password);
      
      expect(bcrypt.hash).toHaveBeenCalledWith(password, mockAuthConfig.bcryptRounds);
      expect(result).toBe(hashedPassword);
    });

    it('should verify password correctly', async () => {
      const password = 'testpassword123';
      const hash = 'hashed-password';
      
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      
      const result = await authService.verifyPassword(password, hash);
      
      expect(bcrypt.compare).toHaveBeenCalledWith(password, hash);
      expect(result).toBe(true);
    });
  });

  describe('JWT Token Management', () => {
    it('should generate JWT token correctly', () => {
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        userType: 'individual' as const,
      };
      
      const mockToken = 'jwt-token';
      (jwt.sign as jest.Mock).mockReturnValue(mockToken);
      
      const result = authService.generateToken(user);
      
      expect(jwt.sign).toHaveBeenCalledWith(
        {
          userId: user.id,
          email: user.email,
          userType: user.userType,
        },
        mockAuthConfig.jwtSecret,
        { expiresIn: mockAuthConfig.jwtExpiresIn }
      );
      expect(result).toBe(mockToken);
    });

    it('should verify JWT token correctly', () => {
      const token = 'valid-jwt-token';
      const decoded = {
        userId: 'user-123',
        email: 'test@example.com',
        userType: 'individual',
        iat: 1234567890,
        exp: 1234567890,
      };
      
      (jwt.verify as jest.Mock).mockReturnValue(decoded);
      
      const result = authService.verifyToken(token);
      
      expect(jwt.verify).toHaveBeenCalledWith(token, mockAuthConfig.jwtSecret);
      expect(result).toEqual(decoded);
    });

    it('should throw error for invalid JWT token', () => {
      const token = 'invalid-jwt-token';
      
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });
      
      expect(() => authService.verifyToken(token)).toThrow('Invalid or expired token');
    });
  });

  describe('User Registration', () => {
    it('should register new user successfully', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
        userType: 'individual' as const,
        jurisdiction: 'US',
      };
      
      const userId = 'user-123';
      const hashedPassword = 'hashed-password';
      const mockToken = 'jwt-token';
      
      const mockUser: UserDocument = {
        id: userId,
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
          documentsRemaining: 5,
          renewsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      mockFirestoreService.getUserByEmail.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);
      mockFirestoreService.createUser.mockResolvedValue(userId);
      mockFirestoreService.getUser.mockResolvedValue(mockUser);
      (jwt.sign as jest.Mock).mockReturnValue(mockToken);
      
      const result = await authService.registerUser(userData);
      
      expect(mockFirestoreService.getUserByEmail).toHaveBeenCalledWith(userData.email);
      expect(bcrypt.hash).toHaveBeenCalledWith(userData.password, mockAuthConfig.bcryptRounds);
      expect(mockFirestoreService.createUser).toHaveBeenCalled();
      expect(result.user).toEqual(mockUser);
      expect(result.token).toBe(mockToken);
    });

    it('should throw error if user already exists', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
        userType: 'individual' as const,
        jurisdiction: 'US',
      };
      
      const existingUser: UserDocument = {
        id: 'existing-user',
        email: userData.email,
        profile: {
          name: 'Existing User',
          userType: 'individual',
          jurisdiction: 'US',
          preferences: {},
        },
        subscription: {
          plan: 'free',
          documentsRemaining: 5,
          renewsAt: new Date(),
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      mockFirestoreService.getUserByEmail.mockResolvedValue(existingUser);
      
      await expect(authService.registerUser(userData)).rejects.toThrow('User already exists with this email');
    });
  });

  describe('User Login', () => {
    it('should login user successfully', async () => {
      const email = 'test@example.com';
      const password = 'password123';
      const mockToken = 'jwt-token';
      
      const mockUser: UserDocument = {
        id: 'user-123',
        email,
        profile: {
          name: 'Test User',
          userType: 'individual',
          jurisdiction: 'US',
          preferences: {},
        },
        subscription: {
          plan: 'free',
          documentsRemaining: 5,
          renewsAt: new Date(),
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      mockFirestoreService.getUserByEmail.mockResolvedValue(mockUser);
      (jwt.sign as jest.Mock).mockReturnValue(mockToken);
      
      const result = await authService.loginUser(email, password);
      
      expect(mockFirestoreService.getUserByEmail).toHaveBeenCalledWith(email);
      expect(result.user).toEqual(mockUser);
      expect(result.token).toBe(mockToken);
    });

    it('should throw error for non-existent user', async () => {
      const email = 'nonexistent@example.com';
      const password = 'password123';
      
      mockFirestoreService.getUserByEmail.mockResolvedValue(null);
      
      await expect(authService.loginUser(email, password)).rejects.toThrow('Invalid email or password');
    });
  });

  describe('Subscription Management', () => {
    it('should update user subscription', async () => {
      const userId = 'user-123';
      const subscription = {
        plan: 'premium' as const,
        documentsRemaining: 100,
        renewsAt: new Date(),
      };
      
      await authService.updateSubscription(userId, subscription);
      
      expect(mockFirestoreService.updateUser).toHaveBeenCalledWith(userId, {
        'subscription.plan': subscription.plan,
        'subscription.documentsRemaining': subscription.documentsRemaining,
        'subscription.renewsAt': subscription.renewsAt,
      });
    });

    it('should decrement document quota', async () => {
      const userId = 'user-123';
      const mockUser: UserDocument = {
        id: userId,
        email: 'test@example.com',
        profile: {
          name: 'Test User',
          userType: 'individual',
          jurisdiction: 'US',
          preferences: {},
        },
        subscription: {
          plan: 'free',
          documentsRemaining: 3,
          renewsAt: new Date(),
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      mockFirestoreService.getUser.mockResolvedValue(mockUser);
      
      await authService.decrementDocumentQuota(userId);
      
      expect(mockFirestoreService.updateUser).toHaveBeenCalledWith(userId, {
        'subscription.documentsRemaining': 2,
      });
    });

    it('should throw error when quota is exceeded', async () => {
      const userId = 'user-123';
      const mockUser: UserDocument = {
        id: userId,
        email: 'test@example.com',
        profile: {
          name: 'Test User',
          userType: 'individual',
          jurisdiction: 'US',
          preferences: {},
        },
        subscription: {
          plan: 'free',
          documentsRemaining: 0,
          renewsAt: new Date(),
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      mockFirestoreService.getUser.mockResolvedValue(mockUser);
      
      await expect(authService.decrementDocumentQuota(userId)).rejects.toThrow('Document quota exceeded');
    });

    it('should check document quota correctly', async () => {
      const userId = 'user-123';
      const mockUser: UserDocument = {
        id: userId,
        email: 'test@example.com',
        profile: {
          name: 'Test User',
          userType: 'individual',
          jurisdiction: 'US',
          preferences: {},
        },
        subscription: {
          plan: 'free',
          documentsRemaining: 3,
          renewsAt: new Date(),
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      mockFirestoreService.getUser.mockResolvedValue(mockUser);
      
      const hasQuota = await authService.hasDocumentQuota(userId);
      
      expect(hasQuota).toBe(true);
    });

    it('should get user usage statistics', async () => {
      const userId = 'user-123';
      const renewsAt = new Date();
      const mockUser: UserDocument = {
        id: userId,
        email: 'test@example.com',
        profile: {
          name: 'Test User',
          userType: 'individual',
          jurisdiction: 'US',
          preferences: {},
        },
        subscription: {
          plan: 'free',
          documentsRemaining: 2,
          renewsAt,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      mockFirestoreService.getUser.mockResolvedValue(mockUser);
      
      const usage = await authService.getUserUsage(userId);
      
      expect(usage).toEqual({
        documentsProcessed: 3, // 5 (free limit) - 2 (remaining) = 3
        documentsRemaining: 2,
        plan: 'free',
        renewsAt,
      });
    });
  });

  describe('Token Refresh', () => {
    it('should refresh token successfully', async () => {
      const oldToken = 'old-jwt-token';
      const newToken = 'new-jwt-token';
      const decoded = {
        userId: 'user-123',
        email: 'test@example.com',
        userType: 'individual',
      };
      
      const mockUser: UserDocument = {
        id: 'user-123',
        email: 'test@example.com',
        profile: {
          name: 'Test User',
          userType: 'individual',
          jurisdiction: 'US',
          preferences: {},
        },
        subscription: {
          plan: 'free',
          documentsRemaining: 5,
          renewsAt: new Date(),
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      (jwt.verify as jest.Mock).mockReturnValue(decoded);
      mockFirestoreService.getUser.mockResolvedValue(mockUser);
      (jwt.sign as jest.Mock).mockReturnValue(newToken);
      
      const result = await authService.refreshToken(oldToken);
      
      expect(jwt.verify).toHaveBeenCalledWith(oldToken, mockAuthConfig.jwtSecret);
      expect(mockFirestoreService.getUser).toHaveBeenCalledWith(decoded.userId);
      expect(result).toBe(newToken);
    });

    it('should throw error for invalid token during refresh', async () => {
      const invalidToken = 'invalid-token';
      
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });
      
      await expect(authService.refreshToken(invalidToken)).rejects.toThrow('Token refresh failed');
    });
  });
});