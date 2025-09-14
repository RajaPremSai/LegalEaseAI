import request from 'supertest';
import express from 'express';
import templateRoutes from '../../routes/templates';
import { pool } from '../../database/connection';

// Mock the database connection and services
jest.mock('../../database/connection');
jest.mock('../../services/templateService');
jest.mock('../../services/aiAnalysis');
jest.mock('../../middleware/auth');

// Mock authentication middleware to always pass
jest.mock('../../middleware/auth', () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    req.user = { id: 'test-user-id', email: 'test@example.com' };
    next();
  }
}));

const app = express();
app.use(express.json());
app.use('/api/templates', templateRoutes);

describe('Template API Integration Tests', () => {
  afterAll(async () => {
    // Clean up any test data
    if (pool && pool.end) {
      await pool.end();
    }
  });

  describe('GET /api/templates/search', () => {
    it('should return templates matching search criteria', async () => {
      const response = await request(app)
        .get('/api/templates/search')
        .query({
          category: 'contract',
          industry: 'Technology',
          limit: 10
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.pagination).toBeDefined();
    });

    it('should handle invalid search parameters', async () => {
      const response = await request(app)
        .get('/api/templates/search')
        .query({
          limit: 'invalid'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/templates/popular', () => {
    it('should return popular templates', async () => {
      const response = await request(app)
        .get('/api/templates/popular')
        .query({ limit: 5 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });
  });

  describe('GET /api/templates/:id', () => {
    it('should return template by ID', async () => {
      const templateId = 'test-template-id';
      
      const response = await request(app)
        .get(`/api/templates/${templateId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('should return 404 for non-existent template', async () => {
      const response = await request(app)
        .get('/api/templates/nonexistent-id');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/templates/:id/customize', () => {
    it('should customize template with valid data', async () => {
      const templateId = 'test-template-id';
      const customizationData = {
        customizations: {
          client_name: 'Test Client',
          service_description: 'Test Service'
        }
      };

      const response = await request(app)
        .post(`/api/templates/${templateId}/customize`)
        .send(customizationData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.customizedContent).toBeDefined();
    });

    it('should return 400 for invalid customization data', async () => {
      const templateId = 'test-template-id';
      const invalidData = {
        customizations: 'invalid'
      };

      const response = await request(app)
        .post(`/api/templates/${templateId}/customize`)
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/templates/:id/compare', () => {
    it('should compare document with template', async () => {
      const templateId = 'test-template-id';
      const comparisonData = {
        documentId: 'test-document-id'
      };

      const response = await request(app)
        .post(`/api/templates/${templateId}/compare`)
        .send(comparisonData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.comparisonResult).toBeDefined();
    });

    it('should require authentication', async () => {
      // Mock auth middleware to fail
      const originalAuth = require('../../middleware/auth').authenticateToken;
      require('../../middleware/auth').authenticateToken = (req: any, res: any, next: any) => {
        res.status(401).json({ success: false, error: 'Unauthorized' });
      };

      const templateId = 'test-template-id';
      const comparisonData = {
        documentId: 'test-document-id'
      };

      const response = await request(app)
        .post(`/api/templates/${templateId}/compare`)
        .send(comparisonData);

      expect(response.status).toBe(401);

      // Restore original auth
      require('../../middleware/auth').authenticateToken = originalAuth;
    });
  });

  describe('POST /api/templates/:id/download', () => {
    it('should track download and return template', async () => {
      const templateId = 'test-template-id';

      const response = await request(app)
        .post(`/api/templates/${templateId}/download`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });
  });

  describe('GET /api/templates/categories', () => {
    it('should return available categories', async () => {
      const response = await request(app)
        .get('/api/templates/categories');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThan(0);
      
      // Check that each category has required fields
      response.body.data.forEach((category: any) => {
        expect(category.value).toBeDefined();
        expect(category.label).toBeDefined();
        expect(category.description).toBeDefined();
      });
    });
  });

  describe('GET /api/templates/industries', () => {
    it('should return available industries', async () => {
      const response = await request(app)
        .get('/api/templates/industries');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      // Mock a database error
      const originalQuery = pool.query;
      pool.query = jest.fn().mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/templates/popular');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);

      // Restore original query method
      pool.query = originalQuery;
    });

    it('should validate request parameters', async () => {
      const response = await request(app)
        .get('/api/templates/search')
        .query({
          limit: -1, // Invalid limit
          offset: 'invalid'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });
});