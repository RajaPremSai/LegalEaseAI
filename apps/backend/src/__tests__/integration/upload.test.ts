import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import uploadRoutes from '../../routes/upload';
import { authConfig } from '../../config/environment';

// Mock the upload service
jest.mock('../../services/upload', () => ({
  uploadService: {
    uploadFile: jest.fn(),
    deleteFile: jest.fn(),
    getFileUrl: jest.fn(),
    verifyFileIntegrity: jest.fn(),
  },
  multerConfig: {
    single: () => (req: any, res: any, next: any) => {
      // Mock multer middleware
      if (req.headers['content-type']?.includes('multipart/form-data')) {
        req.file = {
          fieldname: 'document',
          originalname: 'test.pdf',
          encoding: '7bit',
          mimetype: 'application/pdf',
          size: 1024,
          buffer: Buffer.from('test content'),
        };
      }
      next();
    },
  },
  uploadProgressMiddleware: (req: any, res: any, next: any) => next(),
  uploadErrorHandler: (error: any, req: any, res: any, next: any) => {
    if (error) {
      return res.status(400).json({ error: error.message });
    }
    next();
  },
}));

// Mock environment config
jest.mock('../../config/environment', () => ({
  authConfig: {
    jwtSecret: 'test-secret-key-for-testing-purposes-only',
  },
  rateLimitConfig: {
    windowMs: 900000,
    maxRequests: 100,
  },
}));

describe('Upload Routes Integration Tests', () => {
  let app: express.Application;
  let validToken: string;
  let mockUploadService: any;

  beforeAll(() => {
    // Create test app
    app = express();
    app.use(express.json());
    app.use('/api/upload', uploadRoutes);

    // Generate valid JWT token for testing
    validToken = jwt.sign(
      {
        userId: 'test-user-123',
        email: 'test@example.com',
        userType: 'individual',
      },
      authConfig.jwtSecret,
      { expiresIn: '1h' }
    );

    // Get mock upload service
    mockUploadService = require('../../services/upload').uploadService;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/upload/document', () => {
    it('should upload file successfully with valid token', async () => {
      const mockUploadResult = {
        id: 'file-123',
        filename: 'test-file.pdf',
        originalName: 'test.pdf',
        size: 1024,
        mimeType: 'application/pdf',
        uploadedAt: new Date(),
        checksum: 'abc123',
      };

      mockUploadService.uploadFile.mockResolvedValue(mockUploadResult);

      const response = await request(app)
        .post('/api/upload/document')
        .set('Authorization', `Bearer ${validToken}`)
        .set('Content-Type', 'multipart/form-data')
        .field('jurisdiction', 'US')
        .attach('document', Buffer.from('test content'), 'test.pdf');

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.fileId).toBe('file-123');
      expect(response.body.data.originalName).toBe('test.pdf');
      expect(mockUploadService.uploadFile).toHaveBeenCalledWith(
        expect.objectContaining({
          originalname: 'test.pdf',
          mimetype: 'application/pdf',
        }),
        'test-user-123'
      );
    });

    it('should reject request without authentication token', async () => {
      const response = await request(app)
        .post('/api/upload/document')
        .set('Content-Type', 'multipart/form-data')
        .attach('document', Buffer.from('test content'), 'test.pdf');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authentication required');
    });

    it('should reject request with invalid token', async () => {
      const response = await request(app)
        .post('/api/upload/document')
        .set('Authorization', 'Bearer invalid-token')
        .set('Content-Type', 'multipart/form-data')
        .attach('document', Buffer.from('test content'), 'test.pdf');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid token');
    });

    it('should reject request without file', async () => {
      const response = await request(app)
        .post('/api/upload/document')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ jurisdiction: 'US' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('No file provided');
    });

    it('should handle upload service errors', async () => {
      mockUploadService.uploadFile.mockRejectedValue(new Error('Storage error'));

      const response = await request(app)
        .post('/api/upload/document')
        .set('Authorization', `Bearer ${validToken}`)
        .set('Content-Type', 'multipart/form-data')
        .field('jurisdiction', 'US')
        .attach('document', Buffer.from('test content'), 'test.pdf');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Upload failed');
      expect(response.body.message).toBe('Storage error');
    });

    it('should validate file parameters', async () => {
      // Mock a file that would fail validation
      const response = await request(app)
        .post('/api/upload/document')
        .set('Authorization', `Bearer ${validToken}`)
        .set('Content-Type', 'multipart/form-data')
        .field('jurisdiction', 'INVALID') // Invalid jurisdiction format
        .attach('document', Buffer.from('test content'), 'test.pdf');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('DELETE /api/upload/:fileId', () => {
    it('should delete file successfully', async () => {
      mockUploadService.deleteFile.mockResolvedValue(undefined);

      const response = await request(app)
        .delete('/api/upload/test-file-123')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockUploadService.deleteFile).toHaveBeenCalledWith(
        'uploads/test-user-123/test-file-123'
      );
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .delete('/api/upload/test-file-123');

      expect(response.status).toBe(401);
    });

    it('should handle delete errors', async () => {
      mockUploadService.deleteFile.mockRejectedValue(new Error('Delete failed'));

      const response = await request(app)
        .delete('/api/upload/test-file-123')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Delete failed');
    });
  });

  describe('GET /api/upload/:fileId/url', () => {
    it('should generate signed URL successfully', async () => {
      const mockUrl = 'https://storage.googleapis.com/signed-url';
      mockUploadService.getFileUrl.mockResolvedValue(mockUrl);

      const response = await request(app)
        .get('/api/upload/test-file-123/url')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.url).toBe(mockUrl);
      expect(response.body.data.expiresIn).toBe(3600); // Default 1 hour
      expect(mockUploadService.getFileUrl).toHaveBeenCalledWith(
        'uploads/test-user-123/test-file-123',
        3600
      );
    });

    it('should accept custom expiration time', async () => {
      const mockUrl = 'https://storage.googleapis.com/signed-url';
      mockUploadService.getFileUrl.mockResolvedValue(mockUrl);

      const response = await request(app)
        .get('/api/upload/test-file-123/url?expires=7200')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.expiresIn).toBe(7200);
      expect(mockUploadService.getFileUrl).toHaveBeenCalledWith(
        'uploads/test-user-123/test-file-123',
        7200
      );
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/upload/test-file-123/url');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/upload/:fileId/verify', () => {
    it('should verify file integrity successfully', async () => {
      mockUploadService.verifyFileIntegrity.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/upload/test-file-123/verify')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ checksum: 'abc123def456' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.isValid).toBe(true);
      expect(mockUploadService.verifyFileIntegrity).toHaveBeenCalledWith(
        'uploads/test-user-123/test-file-123',
        'abc123def456'
      );
    });

    it('should return false for invalid checksum', async () => {
      mockUploadService.verifyFileIntegrity.mockResolvedValue(false);

      const response = await request(app)
        .post('/api/upload/test-file-123/verify')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ checksum: 'invalid-checksum' });

      expect(response.status).toBe(200);
      expect(response.body.data.isValid).toBe(false);
    });

    it('should require checksum parameter', async () => {
      const response = await request(app)
        .post('/api/upload/test-file-123/verify')
        .set('Authorization', `Bearer ${validToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Missing checksum');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/upload/test-file-123/verify')
        .send({ checksum: 'abc123' });

      expect(response.status).toBe(401);
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting headers', async () => {
      mockUploadService.uploadFile.mockResolvedValue({
        id: 'file-123',
        filename: 'test.pdf',
        originalName: 'test.pdf',
        size: 1024,
        mimeType: 'application/pdf',
        uploadedAt: new Date(),
        checksum: 'abc123',
      });

      const response = await request(app)
        .post('/api/upload/document')
        .set('Authorization', `Bearer ${validToken}`)
        .set('Content-Type', 'multipart/form-data')
        .field('jurisdiction', 'US')
        .attach('document', Buffer.from('test content'), 'test.pdf');

      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
    });
  });
});