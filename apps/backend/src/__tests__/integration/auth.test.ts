import request from 'supertest';
import express from 'express';
import authRouter from '../../routes/auth';
import { AuthService } from '../../services/auth';
import { firestoreService } from '../../services/firestore';
import { authConfig } from '../../config/environment';

// Mock services
jest.mock('../../services/firestore');
jest.mock('../../services/auth');

const app = express();
app.use(express.json());
app.use('/auth', authRouter);

// Mock auth service
const mockAuthService = {
  registerUser: jest.fn(),
  loginUser: jest.fn(),
  refreshToken: jest.fn(),
  revokeToken: jest.fn(),
  verifyToken: jest.fn(),
  authenticateWithGoogle: jest.fn(),
} as jest.Mocked<Partial<AuthService>>;

// Mock firestore service
const mockFirestoreService = {
  getUser: jest.fn(),
  updateUser: jest.fn(),
} as jest.Mocked<Partial<typeof firestoreService>>;

describe('Auth Routes Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
        userType: 'individual',
        jurisdiction: 'US',
      };

      const mockResult = {
        user: {
          id: 'user-123',
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
            renewsAt: new Date(),
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        token: 'jwt-token',
      };

      (mockAuthService.registerUser as jest.Mock).mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(userData.email);
      expect(response.body.data.token).toBe(mockResult.token);
    });

    it('should return 409 for existing user', async () => {
      const userData = {
        email: 'existing@example.com',
        password: 'password123',
        name: 'Test User',
        userType: 'individual',
        jurisdiction: 'US',
      };

      (mockAuthService.registerUser as jest.Mock).mockRejectedValue(
        new Error('User already exists with this email')
      );

      const response = await request(app)
        .post('/auth/register')
        .send(userData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('User already exists');
    });

    it('should return 400 for invalid input', async () => {
      const invalidData = {
        email: 'invalid-email',
        password: '123', // Too short
        name: '',
        userType: 'invalid',
        jurisdiction: '',
      };

      const response = await request(app)
        .post('/auth/register')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /auth/login', () => {
    it('should login user successfully', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'password123',
      };

      const mockResult = {
        user: {
          id: 'user-123',
          email: loginData.email,
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
        },
        token: 'jwt-token',
      };

      (mockAuthService.loginUser as jest.Mock).mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(loginData.email);
      expect(response.body.data.token).toBe(mockResult.token);
    });

    it('should return 401 for invalid credentials', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'wrongpassword',
      };

      (mockAuthService.loginUser as jest.Mock).mockRejectedValue(
        new Error('Invalid email or password')
      );

      const response = await request(app)
        .post('/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Authentication failed');
    });

    it('should return 400 for invalid input format', async () => {
      const invalidData = {
        email: 'invalid-email',
        password: '',
      };

      const response = await request(app)
        .post('/auth/login')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /auth/google', () => {
    it('should authenticate with Google successfully for new user', async () => {
      const googleData = {
        idToken: 'valid-google-id-token',
      };

      const mockResult = {
        user: {
          id: 'user-123',
          email: 'test@gmail.com',
          profile: {
            name: 'Test User',
            userType: 'individual',
            jurisdiction: 'US',
            preferences: {
              googleId: 'google-user-id',
            },
          },
          subscription: {
            plan: 'free',
            documentsRemaining: 5,
            renewsAt: new Date(),
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        token: 'jwt-token',
        isNewUser: true,
      };

      (mockAuthService.authenticateWithGoogle as jest.Mock).mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/auth/google')
        .send(googleData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Account created successfully');
      expect(response.body.data.isNewUser).toBe(true);
      expect(response.body.data.token).toBe(mockResult.token);
    });

    it('should authenticate with Google successfully for existing user', async () => {
      const googleData = {
        idToken: 'valid-google-id-token',
      };

      const mockResult = {
        user: {
          id: 'user-123',
          email: 'test@gmail.com',
          profile: {
            name: 'Test User',
            userType: 'individual',
            jurisdiction: 'US',
            preferences: {
              googleId: 'google-user-id',
            },
          },
          subscription: {
            plan: 'premium',
            documentsRemaining: 50,
            renewsAt: new Date(),
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        token: 'jwt-token',
        isNewUser: false,
      };

      (mockAuthService.authenticateWithGoogle as jest.Mock).mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/auth/google')
        .send(googleData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Login successful');
      expect(response.body.data.isNewUser).toBe(false);
    });

    it('should return 501 when Google OAuth is not configured', async () => {
      const googleData = {
        idToken: 'valid-google-id-token',
      };

      (mockAuthService.authenticateWithGoogle as jest.Mock).mockRejectedValue(
        new Error('Google OAuth not configured')
      );

      const response = await request(app)
        .post('/auth/google')
        .send(googleData)
        .expect(501);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Service unavailable');
    });

    it('should return 401 for invalid Google token', async () => {
      const googleData = {
        idToken: 'invalid-google-id-token',
      };

      (mockAuthService.authenticateWithGoogle as jest.Mock).mockRejectedValue(
        new Error('Google authentication failed')
      );

      const response = await request(app)
        .post('/auth/google')
        .send(googleData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Authentication failed');
    });
  });

  describe('POST /auth/verify-token', () => {
    it('should verify valid token successfully', async () => {
      const tokenData = {
        token: 'valid-jwt-token',
      };

      const mockDecoded = {
        userId: 'user-123',
        email: 'test@example.com',
        userType: 'individual',
        exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
      };

      const mockUser = {
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

      (mockAuthService.verifyToken as jest.Mock).mockReturnValue(mockDecoded);
      (mockFirestoreService.getUser as jest.Mock).mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/auth/verify-token')
        .send(tokenData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.id).toBe(mockUser.id);
      expect(response.body.data.expiresAt).toBeDefined();
    });

    it('should return 401 for invalid token', async () => {
      const tokenData = {
        token: 'invalid-jwt-token',
      };

      (mockAuthService.verifyToken as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const response = await request(app)
        .post('/auth/verify-token')
        .send(tokenData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid token');
    });

    it('should return 401 when user not found', async () => {
      const tokenData = {
        token: 'valid-jwt-token',
      };

      const mockDecoded = {
        userId: 'user-123',
        email: 'test@example.com',
        userType: 'individual',
      };

      (mockAuthService.verifyToken as jest.Mock).mockReturnValue(mockDecoded);
      (mockFirestoreService.getUser as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post('/auth/verify-token')
        .send(tokenData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid token');
      expect(response.body.message).toBe('User associated with token not found');
    });
  });

  describe('Authentication Required Routes', () => {
    const validToken = 'Bearer valid-jwt-token';
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      userType: 'individual',
    };

    beforeEach(() => {
      // Mock the auth middleware to add user to request
      jest.doMock('../../middleware/auth', () => ({
        authMiddleware: (req: any, res: any, next: any) => {
          req.user = mockUser;
          next();
        },
      }));
    });

    it('should return 401 without authentication token', async () => {
      const response = await request(app)
        .get('/auth/profile')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Authentication required');
    });
  });
});