import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { authConfig } from '../../config/environment';
import documentRoutes from '../../routes/documents';
import { authMiddleware } from '../../middleware/auth';
import { rateLimitMiddleware } from '../../middleware/rateLimit';

// Mock services
jest.mock('../../services/documentAI');
jest.mock('../../services/metadataExtractor');
jest.mock('../../services/upload');

const app = express();
app.use(express.json());
app.use('/api/documents', documentRoutes);

// Test user data
const testUser = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  email: 'test@example.com',
  userType: 'individual' as const,
};

// Generate test JWT token
const generateTestToken = (user = testUser) => {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      userType: user.userType,
    },
    authConfig.jwtSecret,
    { expiresIn: '1h' }
  );
};

describe('Document Management API', () => {
  let authToken: string;

  beforeEach(() => {
    authToken = generateTestToken();
    jest.clearAllMocks();
  });

  describe('GET /api/documents', () => {
    it('should list user documents with default pagination', async () => {
      const response = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          documents: expect.any(Array),
          pagination: {
            currentPage: 1,
            totalPages: expect.any(Number),
            totalCount: expect.any(Number),
            hasNextPage: expect.any(Boolean),
            hasPreviousPage: false,
          },
        },
      });
    });

    it('should filter documents by status', async () => {
      const response = await request(app)
        .get('/api/documents?status=analyzed')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.filters.status).toBe('analyzed');
    });

    it('should filter documents by document type', async () => {
      const response = await request(app)
        .get('/api/documents?documentType=contract')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.filters.documentType).toBe('contract');
    });

    it('should handle pagination parameters', async () => {
      const response = await request(app)
        .get('/api/documents?page=2&limit=5')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.pagination.currentPage).toBe(2);
    });

    it('should reject invalid pagination parameters', async () => {
      await request(app)
        .get('/api/documents?page=0')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/documents')
        .expect(401);
    });
  });

  describe('GET /api/documents/:documentId', () => {
    const documentId = '123e4567-e89b-12d3-a456-426614174001';

    it('should retrieve a specific document', async () => {
      const response = await request(app)
        .get(`/api/documents/${documentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: documentId,
          userId: testUser.id,
          filename: expect.any(String),
          documentType: expect.any(String),
          status: expect.any(String),
          metadata: expect.any(Object),
        },
      });
    });

    it('should reject invalid document ID format', async () => {
      await request(app)
        .get('/api/documents/invalid-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('should require authentication', async () => {
      await request(app)
        .get(`/api/documents/${documentId}`)
        .expect(401);
    });
  });

  describe('DELETE /api/documents/:documentId', () => {
    const documentId = '123e4567-e89b-12d3-a456-426614174001';

    it('should delete a document successfully', async () => {
      const response = await request(app)
        .delete(`/api/documents/${documentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Document deleted successfully',
        data: {
          documentId,
          deletedAt: expect.any(String),
        },
      });
    });

    it('should reject invalid document ID format', async () => {
      await request(app)
        .delete('/api/documents/invalid-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('should require authentication', async () => {
      await request(app)
        .delete(`/api/documents/${documentId}`)
        .expect(401);
    });
  });

  describe('POST /api/documents/process', () => {
    const validProcessRequest = {
      fileId: 'test-file-id',
      filePath: `uploads/${testUser.id}/test-file.pdf`,
      mimeType: 'application/pdf',
      jurisdiction: 'US',
    };

    it('should process a document successfully', async () => {
      // Mock upload service to return file exists
      const { uploadService } = require('../../services/upload');
      uploadService.verifyFileExists = jest.fn().mockResolvedValue(true);

      const response = await request(app)
        .post('/api/documents/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validProcessRequest)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Document processed successfully',
        data: {
          document: expect.any(Object),
          processing: expect.any(Object),
        },
      });
    });

    it('should reject processing files not owned by user', async () => {
      const invalidRequest = {
        ...validProcessRequest,
        filePath: 'uploads/other-user/test-file.pdf',
      };

      await request(app)
        .post('/api/documents/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidRequest)
        .expect(403);
    });

    it('should reject invalid mime types', async () => {
      const invalidRequest = {
        ...validProcessRequest,
        mimeType: 'image/jpeg',
      };

      await request(app)
        .post('/api/documents/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidRequest)
        .expect(400);
    });

    it('should handle missing file', async () => {
      // Mock upload service to return file doesn't exist
      const { uploadService } = require('../../services/upload');
      uploadService.verifyFileExists = jest.fn().mockResolvedValue(false);

      await request(app)
        .post('/api/documents/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validProcessRequest)
        .expect(404);
    });

    it('should require authentication', async () => {
      await request(app)
        .post('/api/documents/process')
        .send(validProcessRequest)
        .expect(401);
    });
  });

  describe('GET /api/documents/:documentId/text', () => {
    const documentId = '123e4567-e89b-12d3-a456-426614174001';

    it('should retrieve document text', async () => {
      const response = await request(app)
        .get(`/api/documents/${documentId}/text`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          documentId,
          text: expect.any(String),
          pageCount: expect.any(Number),
          wordCount: expect.any(Number),
          language: expect.any(String),
        },
      });
    });

    it('should require authentication', async () => {
      await request(app)
        .get(`/api/documents/${documentId}/text`)
        .expect(401);
    });
  });

  describe('GET /api/documents/:documentId/pages', () => {
    const documentId = '123e4567-e89b-12d3-a456-426614174001';

    it('should retrieve all pages', async () => {
      const response = await request(app)
        .get(`/api/documents/${documentId}/pages`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          documentId,
          pages: expect.any(Array),
          totalPages: expect.any(Number),
        },
      });
    });

    it('should retrieve specific page', async () => {
      const response = await request(app)
        .get(`/api/documents/${documentId}/pages?page=1`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          documentId,
          page: expect.any(Object),
          totalPages: expect.any(Number),
        },
      });
    });

    it('should handle non-existent page', async () => {
      await request(app)
        .get(`/api/documents/${documentId}/pages?page=999`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should require authentication', async () => {
      await request(app)
        .get(`/api/documents/${documentId}/pages`)
        .expect(401);
    });
  });

  describe('GET /api/documents/:documentId/entities', () => {
    const documentId = '123e4567-e89b-12d3-a456-426614174001';

    it('should retrieve all entities', async () => {
      const response = await request(app)
        .get(`/api/documents/${documentId}/entities`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          documentId,
          entities: expect.any(Array),
          totalEntities: expect.any(Number),
          filteredCount: expect.any(Number),
          availableTypes: expect.any(Array),
        },
      });
    });

    it('should filter entities by type', async () => {
      const response = await request(app)
        .get(`/api/documents/${documentId}/entities?type=PERSON`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.entities).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'PERSON' })
        ])
      );
    });

    it('should require authentication', async () => {
      await request(app)
        .get(`/api/documents/${documentId}/entities`)
        .expect(401);
    });
  });

  describe('GET /api/documents/:documentId/clauses', () => {
    const documentId = '123e4567-e89b-12d3-a456-426614174001';

    it('should retrieve all clauses', async () => {
      const response = await request(app)
        .get(`/api/documents/${documentId}/clauses`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          documentId,
          clauses: expect.any(Array),
          totalClauses: expect.any(Number),
          filteredCount: expect.any(Number),
          riskSummary: {
            high: expect.any(Number),
            medium: expect.any(Number),
            low: expect.any(Number),
          },
          availableTypes: expect.any(Array),
        },
      });
    });

    it('should filter clauses by risk level', async () => {
      const response = await request(app)
        .get(`/api/documents/${documentId}/clauses?risk=high`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.clauses).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ riskLevel: 'high' })
        ])
      );
    });

    it('should filter clauses by type', async () => {
      const response = await request(app)
        .get(`/api/documents/${documentId}/clauses?type=payment`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.clauses).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'payment' })
        ])
      );
    });

    it('should require authentication', async () => {
      await request(app)
        .get(`/api/documents/${documentId}/clauses`)
        .expect(401);
    });
  });

  describe('POST /api/documents/:documentId/reprocess', () => {
    const documentId = '123e4567-e89b-12d3-a456-426614174001';

    it('should reprocess document with default settings', async () => {
      const response = await request(app)
        .post(`/api/documents/${documentId}/reprocess`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Document reprocessed successfully',
        data: {
          documentId,
          reprocessedAt: expect.any(String),
          settings: {
            forceOCR: false,
            analysisType: 'full',
          },
          results: expect.any(Object),
        },
      });
    });

    it('should reprocess with OCR forced', async () => {
      const response = await request(app)
        .post(`/api/documents/${documentId}/reprocess`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ forceOCR: true, analysisType: 'summary' })
        .expect(200);

      expect(response.body.data.settings).toMatchObject({
        forceOCR: true,
        analysisType: 'summary',
      });
    });

    it('should reject invalid analysis type', async () => {
      await request(app)
        .post(`/api/documents/${documentId}/reprocess`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ analysisType: 'invalid' })
        .expect(400);
    });

    it('should require authentication', async () => {
      await request(app)
        .post(`/api/documents/${documentId}/reprocess`)
        .send({})
        .expect(401);
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      // Mock service to throw error
      const { documentAIService } = require('../../services/documentAI');
      documentAIService.processDocument = jest.fn().mockRejectedValue(new Error('Service unavailable'));

      const { uploadService } = require('../../services/upload');
      uploadService.verifyFileExists = jest.fn().mockResolvedValue(true);

      await request(app)
        .post('/api/documents/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          fileId: 'test-file-id',
          filePath: `uploads/${testUser.id}/test-file.pdf`,
          mimeType: 'application/pdf',
        })
        .expect(500);
    });

    it('should handle invalid JSON in request body', async () => {
      await request(app)
        .post('/api/documents/process')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting to document endpoints', async () => {
      // This test would need to be implemented based on your rate limiting configuration
      // For now, we'll just verify the middleware is applied
      const documentId = '123e4567-e89b-12d3-a456-426614174001';
      
      const response = await request(app)
        .get(`/api/documents/${documentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Check that rate limit headers are present
      expect(response.headers).toHaveProperty('x-ratelimit-limit');
      expect(response.headers).toHaveProperty('x-ratelimit-remaining');
    });
  });
});