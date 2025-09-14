import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { authConfig } from '../../config/environment';
import documentVersionRoutes from '../../routes/documentVersions';

// Mock services and database
jest.mock('../../services/documentVersioning');
jest.mock('../../services/documentComparison');
jest.mock('../../database/repositories/documentVersionRepository');
jest.mock('../../database/connection');

const app = express();
app.use(express.json());
app.use('/api/document-versions', documentVersionRoutes);

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

describe('Document Versions API', () => {
  let authToken: string;
  const documentId = '123e4567-e89b-12d3-a456-426614174001';
  const versionId = '123e4567-e89b-12d3-a456-426614174002';
  const comparisonId = '123e4567-e89b-12d3-a456-426614174003';

  beforeEach(() => {
    authToken = generateTestToken();
    jest.clearAllMocks();
  });

  describe('GET /api/document-versions/:documentId/history', () => {
    it('should retrieve version history with pagination', async () => {
      const { DocumentVersioningService } = require('../../services/documentVersioning');
      const mockService = {
        getVersionHistory: jest.fn().mockResolvedValue({
          versions: [
            {
              id: versionId,
              documentId,
              versionNumber: 2,
              filename: 'contract-v2.pdf',
              uploadedAt: new Date(),
              metadata: { pageCount: 5, wordCount: 1200 },
            },
            {
              id: '123e4567-e89b-12d3-a456-426614174004',
              documentId,
              versionNumber: 1,
              filename: 'contract-v1.pdf',
              uploadedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
              metadata: { pageCount: 4, wordCount: 1000 },
            },
          ],
          total: 2,
          latestVersion: 2,
          firstVersion: 1,
          totalComparisons: 1,
        }),
      };
      DocumentVersioningService.mockImplementation(() => mockService);

      const response = await request(app)
        .get(`/api/document-versions/${documentId}/history`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          documentId,
          versions: expect.any(Array),
          pagination: {
            limit: 10,
            offset: 0,
            total: 2,
            hasMore: false,
          },
          summary: {
            totalVersions: 2,
            latestVersion: 2,
            firstVersion: 1,
            totalComparisons: 1,
          },
        },
      });
    });

    it('should handle pagination parameters', async () => {
      const { DocumentVersioningService } = require('../../services/documentVersioning');
      const mockService = {
        getVersionHistory: jest.fn().mockResolvedValue({
          versions: [],
          total: 0,
          latestVersion: null,
          firstVersion: null,
          totalComparisons: 0,
        }),
      };
      DocumentVersioningService.mockImplementation(() => mockService);

      await request(app)
        .get(`/api/document-versions/${documentId}/history?limit=5&offset=10&includeAnalysis=true`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(mockService.getVersionHistory).toHaveBeenCalledWith(
        documentId,
        expect.objectContaining({
          limit: 5,
          offset: 10,
          includeAnalysis: true,
          userId: testUser.id,
        })
      );
    });

    it('should require authentication', async () => {
      await request(app)
        .get(`/api/document-versions/${documentId}/history`)
        .expect(401);
    });
  });

  describe('GET /api/document-versions/version/:versionId', () => {
    it('should retrieve a specific version', async () => {
      const { DocumentVersioningService } = require('../../services/documentVersioning');
      const mockService = {
        getVersion: jest.fn().mockResolvedValue({
          id: versionId,
          documentId,
          versionNumber: 2,
          filename: 'contract-v2.pdf',
          uploadedAt: new Date(),
          metadata: {
            pageCount: 5,
            wordCount: 1200,
            language: 'en',
            extractedText: 'Contract content...',
          },
          analysis: {
            summary: 'Contract analysis summary',
            riskScore: 'medium',
            keyTerms: [],
            risks: [],
            recommendations: [],
            clauses: [],
            generatedAt: new Date(),
          },
        }),
      };
      DocumentVersioningService.mockImplementation(() => mockService);

      const response = await request(app)
        .get(`/api/document-versions/version/${versionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: versionId,
          documentId,
          versionNumber: 2,
          filename: expect.any(String),
          metadata: expect.any(Object),
          analysis: expect.any(Object),
        },
      });
    });

    it('should return 404 for non-existent version', async () => {
      const { DocumentVersioningService } = require('../../services/documentVersioning');
      const mockService = {
        getVersion: jest.fn().mockResolvedValue(null),
      };
      DocumentVersioningService.mockImplementation(() => mockService);

      await request(app)
        .get(`/api/document-versions/version/${versionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should require authentication', async () => {
      await request(app)
        .get(`/api/document-versions/version/${versionId}`)
        .expect(401);
    });
  });

  describe('POST /api/document-versions/compare', () => {
    const validComparisonRequest = {
      originalVersionId: versionId,
      comparedVersionId: '123e4567-e89b-12d3-a456-426614174004',
    };

    it('should compare two document versions', async () => {
      const { DocumentVersioningService } = require('../../services/documentVersioning');
      const mockService = {
        compareVersions: jest.fn().mockResolvedValue({
          id: comparisonId,
          originalVersionId: validComparisonRequest.originalVersionId,
          comparedVersionId: validComparisonRequest.comparedVersionId,
          comparedAt: new Date(),
          changes: [
            {
              id: 'change1',
              type: 'modification',
              originalText: 'Payment due in 30 days',
              newText: 'Payment due in 45 days',
              location: { startIndex: 100, endIndex: 120 },
              severity: 'medium',
              description: 'Payment terms changed from 30 to 45 days',
            },
          ],
          impactAnalysis: {
            overallImpact: 'unfavorable',
            riskScoreChange: 1.5,
            significantChanges: [
              {
                changeId: 'change1',
                category: 'financial',
                impact: 'unfavorable',
                description: 'Extended payment terms may impact cash flow',
              },
            ],
            summary: 'Payment terms have been extended, which may be unfavorable',
          },
        }),
      };
      DocumentVersioningService.mockImplementation(() => mockService);

      const response = await request(app)
        .post('/api/document-versions/compare')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validComparisonRequest)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Document comparison completed successfully',
        data: {
          comparisonId: expect.any(String),
          originalVersionId: validComparisonRequest.originalVersionId,
          comparedVersionId: validComparisonRequest.comparedVersionId,
          comparison: expect.any(Object),
          comparedAt: expect.any(String),
          metadata: {
            totalChanges: expect.any(Number),
            significantChanges: expect.any(Number),
            overallImpact: expect.any(String),
            riskScoreChange: expect.any(Number),
          },
        },
      });
    });

    it('should validate version IDs', async () => {
      await request(app)
        .post('/api/document-versions/compare')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          originalVersionId: 'invalid-uuid',
          comparedVersionId: validComparisonRequest.comparedVersionId,
        })
        .expect(400);
    });

    it('should require authentication', async () => {
      await request(app)
        .post('/api/document-versions/compare')
        .send(validComparisonRequest)
        .expect(401);
    });
  });

  describe('GET /api/document-versions/:documentId/latest', () => {
    it('should retrieve the latest version', async () => {
      const { DocumentVersioningService } = require('../../services/documentVersioning');
      const mockService = {
        getLatestVersion: jest.fn().mockResolvedValue({
          id: versionId,
          documentId,
          versionNumber: 3,
          filename: 'contract-latest.pdf',
          uploadedAt: new Date(),
          metadata: { pageCount: 6, wordCount: 1350 },
        }),
      };
      DocumentVersioningService.mockImplementation(() => mockService);

      const response = await request(app)
        .get(`/api/document-versions/${documentId}/latest`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: versionId,
          documentId,
          versionNumber: 3,
          filename: expect.any(String),
        },
      });
    });

    it('should return 404 when no versions exist', async () => {
      const { DocumentVersioningService } = require('../../services/documentVersioning');
      const mockService = {
        getLatestVersion: jest.fn().mockResolvedValue(null),
      };
      DocumentVersioningService.mockImplementation(() => mockService);

      await request(app)
        .get(`/api/document-versions/${documentId}/latest`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should require authentication', async () => {
      await request(app)
        .get(`/api/document-versions/${documentId}/latest`)
        .expect(401);
    });
  });

  describe('POST /api/document-versions/:documentId/versions', () => {
    const validVersionRequest = {
      filename: 'contract-v3.pdf',
      metadata: {
        pageCount: 6,
        wordCount: 1350,
        language: 'en',
        extractedText: 'Updated contract content...',
      },
      analysis: {
        summary: 'Updated contract analysis',
        riskScore: 'low',
        keyTerms: [],
        risks: [],
        recommendations: [],
        clauses: [],
        generatedAt: new Date(),
      },
    };

    it('should create a new version', async () => {
      const { DocumentVersioningService } = require('../../services/documentVersioning');
      const mockService = {
        createVersion: jest.fn().mockResolvedValue({
          id: 'new-version-id',
          documentId,
          versionNumber: 3,
          filename: validVersionRequest.filename,
          uploadedAt: new Date(),
          metadata: validVersionRequest.metadata,
          analysis: validVersionRequest.analysis,
        }),
      };
      DocumentVersioningService.mockImplementation(() => mockService);

      const response = await request(app)
        .post(`/api/document-versions/${documentId}/versions`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(validVersionRequest)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: expect.any(String),
          documentId,
          versionNumber: 3,
          filename: validVersionRequest.filename,
        },
        message: 'Version created successfully',
      });
    });

    it('should require filename and metadata', async () => {
      await request(app)
        .post(`/api/document-versions/${documentId}/versions`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          filename: 'test.pdf',
          // Missing metadata
        })
        .expect(400);
    });

    it('should require authentication', async () => {
      await request(app)
        .post(`/api/document-versions/${documentId}/versions`)
        .send(validVersionRequest)
        .expect(401);
    });
  });

  describe('POST /api/document-versions/:documentId/rollback/:versionId', () => {
    const validRollbackRequest = {
      filename: 'contract-rollback.pdf',
      reason: 'Reverting to previous terms due to negotiation',
    };

    it('should rollback to a previous version', async () => {
      const { DocumentVersioningService } = require('../../services/documentVersioning');
      const mockService = {
        rollbackToVersion: jest.fn().mockResolvedValue({
          id: 'rollback-version-id',
          documentId,
          versionNumber: 4,
          filename: validRollbackRequest.filename,
          uploadedAt: new Date(),
          parentVersionId: versionId,
          metadata: { pageCount: 5, wordCount: 1200 },
        }),
      };
      DocumentVersioningService.mockImplementation(() => mockService);

      const response = await request(app)
        .post(`/api/document-versions/${documentId}/rollback/${versionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(validRollbackRequest)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: expect.any(String),
          documentId,
          versionNumber: 4,
          parentVersionId: versionId,
        },
        message: `Successfully rolled back to version ${versionId}`,
      });
    });

    it('should require filename', async () => {
      await request(app)
        .post(`/api/document-versions/${documentId}/rollback/${versionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          reason: 'Test rollback',
          // Missing filename
        })
        .expect(400);
    });

    it('should require authentication', async () => {
      await request(app)
        .post(`/api/document-versions/${documentId}/rollback/${versionId}`)
        .send(validRollbackRequest)
        .expect(401);
    });
  });

  describe('GET /api/document-versions/:documentId/differences', () => {
    it('should retrieve version differences', async () => {
      const { DocumentVersioningService } = require('../../services/documentVersioning');
      const mockService = {
        getVersionDifferences: jest.fn().mockResolvedValue({
          documentId,
          differences: [
            {
              fromVersion: 1,
              toVersion: 2,
              changes: [
                {
                  type: 'modification',
                  description: 'Payment terms changed',
                  severity: 'medium',
                },
              ],
              impactScore: 2.5,
            },
          ],
          summary: {
            totalVersions: 3,
            totalChanges: 5,
            averageImpactScore: 2.1,
          },
        }),
      };
      DocumentVersioningService.mockImplementation(() => mockService);

      const response = await request(app)
        .get(`/api/document-versions/${documentId}/differences`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          documentId,
          differences: expect.any(Array),
          summary: expect.any(Object),
        },
      });
    });

    it('should require authentication', async () => {
      await request(app)
        .get(`/api/document-versions/${documentId}/differences`)
        .expect(401);
    });
  });

  describe('GET /api/document-versions/:documentId/statistics', () => {
    it('should retrieve version statistics', async () => {
      const { DocumentVersioningService } = require('../../services/documentVersioning');
      const mockService = {
        getVersionStatistics: jest.fn().mockResolvedValue({
          documentId,
          totalVersions: 3,
          totalComparisons: 2,
          averageVersionSize: 1200,
          versionFrequency: {
            daily: 0,
            weekly: 1,
            monthly: 2,
          },
          changePatterns: {
            mostChangedSections: ['Payment Terms', 'Termination'],
            averageChangesPerVersion: 2.5,
          },
          riskTrends: {
            currentRisk: 'medium',
            riskHistory: ['high', 'medium', 'medium'],
            improvementTrend: 'stable',
          },
        }),
      };
      DocumentVersioningService.mockImplementation(() => mockService);

      const response = await request(app)
        .get(`/api/document-versions/${documentId}/statistics`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          documentId,
          totalVersions: expect.any(Number),
          totalComparisons: expect.any(Number),
          averageVersionSize: expect.any(Number),
          versionFrequency: expect.any(Object),
          changePatterns: expect.any(Object),
          riskTrends: expect.any(Object),
        },
      });
    });

    it('should require authentication', async () => {
      await request(app)
        .get(`/api/document-versions/${documentId}/statistics`)
        .expect(401);
    });
  });

  describe('DELETE /api/document-versions/cleanup', () => {
    it('should cleanup old versions', async () => {
      const { DocumentVersioningService } = require('../../services/documentVersioning');
      const mockService = {
        cleanupOldVersions: jest.fn().mockResolvedValue({
          deletedVersions: 5,
          deletedComparisons: 3,
          freedSpace: '15MB',
          retentionDays: 30,
        }),
      };
      DocumentVersioningService.mockImplementation(() => mockService);

      const response = await request(app)
        .delete('/api/document-versions/cleanup?retentionDays=30')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          deletedVersions: 5,
          deletedComparisons: 3,
        },
        message: 'Cleanup completed. Deleted 5 versions and 3 comparisons',
      });
    });

    it('should use default retention period', async () => {
      const { DocumentVersioningService } = require('../../services/documentVersioning');
      const mockService = {
        cleanupOldVersions: jest.fn().mockResolvedValue({
          deletedVersions: 0,
          deletedComparisons: 0,
        }),
      };
      DocumentVersioningService.mockImplementation(() => mockService);

      await request(app)
        .delete('/api/document-versions/cleanup')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(mockService.cleanupOldVersions).toHaveBeenCalledWith(30);
    });

    it('should require authentication', async () => {
      await request(app)
        .delete('/api/document-versions/cleanup')
        .expect(401);
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      const { DocumentVersioningService } = require('../../services/documentVersioning');
      const mockService = {
        getVersionHistory: jest.fn().mockRejectedValue(new Error('Database connection failed')),
      };
      DocumentVersioningService.mockImplementation(() => mockService);

      await request(app)
        .get(`/api/document-versions/${documentId}/history`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(500);
    });

    it('should validate UUID formats', async () => {
      await request(app)
        .get('/api/document-versions/invalid-uuid/history')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting to version endpoints', async () => {
      const { DocumentVersioningService } = require('../../services/documentVersioning');
      const mockService = {
        getVersionHistory: jest.fn().mockResolvedValue({
          versions: [],
          total: 0,
          latestVersion: null,
          firstVersion: null,
          totalComparisons: 0,
        }),
      };
      DocumentVersioningService.mockImplementation(() => mockService);

      const response = await request(app)
        .get(`/api/document-versions/${documentId}/history`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Check that rate limit headers are present
      expect(response.headers).toHaveProperty('x-ratelimit-limit');
      expect(response.headers).toHaveProperty('x-ratelimit-remaining');
    });
  });
});