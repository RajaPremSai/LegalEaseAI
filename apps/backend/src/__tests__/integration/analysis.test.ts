import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { authConfig } from '../../config/environment';
import analysisRoutes from '../../routes/analysis';

// Mock services
jest.mock('../../services/aiAnalysis');
jest.mock('../../services/riskAssessment');

const app = express();
app.use(express.json());
app.use('/api/analysis', analysisRoutes);

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

describe('Analysis API', () => {
  let authToken: string;
  const documentId = '123e4567-e89b-12d3-a456-426614174001';

  beforeEach(() => {
    authToken = generateTestToken();
    jest.clearAllMocks();
  });

  describe('POST /api/analysis/:documentId/analyze', () => {
    const validAnalysisRequest = {
      analysisType: 'full',
      includeRecommendations: true,
      focusAreas: ['financial', 'legal'],
    };

    it('should perform comprehensive document analysis', async () => {
      const { aiAnalysisService } = require('../../services/aiAnalysis');
      aiAnalysisService.analyzeDocument = jest.fn().mockResolvedValue({
        summary: 'Document analysis summary',
        riskScore: 'medium',
        keyTerms: [],
        risks: [],
        recommendations: [],
        clauses: [],
        processingTime: 2500,
        confidence: 0.92,
        modelVersion: 'v1.0',
      });

      const response = await request(app)
        .post(`/api/analysis/${documentId}/analyze`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(validAnalysisRequest)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Document analysis completed successfully',
        data: {
          analysisId: expect.any(String),
          documentId,
          analysisType: 'full',
          completedAt: expect.any(String),
          results: expect.any(Object),
          metadata: {
            processingTime: expect.any(Number),
            confidence: expect.any(Number),
            modelVersion: expect.any(String),
          },
        },
      });
    });

    it('should handle different analysis types', async () => {
      const { aiAnalysisService } = require('../../services/aiAnalysis');
      aiAnalysisService.analyzeDocument = jest.fn().mockResolvedValue({
        summary: 'Risk-only analysis',
        processingTime: 1200,
        confidence: 0.88,
        modelVersion: 'v1.0',
      });

      await request(app)
        .post(`/api/analysis/${documentId}/analyze`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ analysisType: 'risk_only' })
        .expect(201);

      expect(aiAnalysisService.analyzeDocument).toHaveBeenCalledWith(
        documentId,
        expect.objectContaining({ type: 'risk_only' })
      );
    });

    it('should reject invalid analysis type', async () => {
      await request(app)
        .post(`/api/analysis/${documentId}/analyze`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ analysisType: 'invalid' })
        .expect(400);
    });

    it('should require authentication', async () => {
      await request(app)
        .post(`/api/analysis/${documentId}/analyze`)
        .send(validAnalysisRequest)
        .expect(401);
    });
  });

  describe('POST /api/analysis/:documentId/risk-assessment', () => {
    const validRiskRequest = {
      assessmentType: 'comprehensive',
      riskCategories: ['financial', 'legal'],
      includeRecommendations: true,
    };

    it('should perform risk assessment', async () => {
      const { riskAssessmentService } = require('../../services/riskAssessment');
      riskAssessmentService.assessDocumentRisk = jest.fn().mockResolvedValue({
        overallRiskScore: 7.5,
        riskLevel: 'medium',
        risks: [],
        recommendations: [],
        summary: 'Risk assessment summary',
        categoryBreakdown: {},
        processingTime: 1800,
        confidence: 0.90,
        rulesApplied: 15,
      });

      const response = await request(app)
        .post(`/api/analysis/${documentId}/risk-assessment`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(validRiskRequest)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Risk assessment completed successfully',
        data: {
          assessmentId: expect.any(String),
          documentId,
          overallRiskScore: expect.any(Number),
          riskLevel: expect.any(String),
          risks: expect.any(Array),
          recommendations: expect.any(Array),
        },
      });
    });

    it('should handle different assessment types', async () => {
      const { riskAssessmentService } = require('../../services/riskAssessment');
      riskAssessmentService.assessDocumentRisk = jest.fn().mockResolvedValue({
        overallRiskScore: 5.0,
        riskLevel: 'low',
        processingTime: 800,
        confidence: 0.85,
        rulesApplied: 8,
      });

      await request(app)
        .post(`/api/analysis/${documentId}/risk-assessment`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ assessmentType: 'quick' })
        .expect(201);
    });

    it('should require authentication', async () => {
      await request(app)
        .post(`/api/analysis/${documentId}/risk-assessment`)
        .send(validRiskRequest)
        .expect(401);
    });
  });

  describe('GET /api/analysis/:documentId/summary', () => {
    it('should generate document summary', async () => {
      const { aiAnalysisService } = require('../../services/aiAnalysis');
      aiAnalysisService.generateDocumentSummary = jest.fn().mockResolvedValue({
        text: 'This is a comprehensive document summary...',
        keyPoints: ['Point 1', 'Point 2'],
        keyTerms: [],
        wordCount: 150,
        estimatedReadingTime: 2,
        confidence: 0.94,
      });

      const response = await request(app)
        .get(`/api/analysis/${documentId}/summary`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          documentId,
          summary: expect.any(String),
          keyPoints: expect.any(Array),
          wordCount: expect.any(Number),
          estimatedReadingTime: expect.any(Number),
          confidence: expect.any(Number),
        },
      });
    });

    it('should handle query parameters', async () => {
      const { aiAnalysisService } = require('../../services/aiAnalysis');
      aiAnalysisService.generateDocumentSummary = jest.fn().mockResolvedValue({
        text: 'Summary with key terms',
        keyPoints: [],
        keyTerms: [{ term: 'contract', definition: 'Legal agreement' }],
        wordCount: 100,
        estimatedReadingTime: 1,
        confidence: 0.91,
      });

      await request(app)
        .get(`/api/analysis/${documentId}/summary?includeKeyTerms=true&readingLevel=college`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(aiAnalysisService.generateDocumentSummary).toHaveBeenCalledWith(
        documentId,
        expect.objectContaining({
          readingLevel: 'college',
          includeKeyTerms: true,
        })
      );
    });

    it('should require authentication', async () => {
      await request(app)
        .get(`/api/analysis/${documentId}/summary`)
        .expect(401);
    });
  });

  describe('GET /api/analysis/:documentId/key-terms', () => {
    it('should extract key terms', async () => {
      const { aiAnalysisService } = require('../../services/aiAnalysis');
      aiAnalysisService.extractKeyTerms = jest.fn().mockResolvedValue({
        terms: [
          { term: 'liability', definition: 'Legal responsibility', importance: 'high' },
          { term: 'indemnification', definition: 'Protection from loss', importance: 'medium' },
        ],
        totalCount: 2,
        categories: ['legal', 'financial'],
        importanceBreakdown: { high: 1, medium: 1, low: 0 },
        confidence: 0.89,
      });

      const response = await request(app)
        .get(`/api/analysis/${documentId}/key-terms`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          documentId,
          keyTerms: expect.any(Array),
          totalTerms: expect.any(Number),
          categories: expect.any(Array),
          importanceBreakdown: expect.any(Object),
        },
      });
    });

    it('should filter by importance', async () => {
      const { aiAnalysisService } = require('../../services/aiAnalysis');
      aiAnalysisService.extractKeyTerms = jest.fn().mockResolvedValue({
        terms: [{ term: 'liability', definition: 'Legal responsibility', importance: 'high' }],
        totalCount: 1,
        categories: ['legal'],
        importanceBreakdown: { high: 1, medium: 0, low: 0 },
        confidence: 0.92,
      });

      await request(app)
        .get(`/api/analysis/${documentId}/key-terms?importance=high`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
    });

    it('should require authentication', async () => {
      await request(app)
        .get(`/api/analysis/${documentId}/key-terms`)
        .expect(401);
    });
  });

  describe('POST /api/analysis/batch', () => {
    const validBatchRequest = {
      documentIds: [documentId, '123e4567-e89b-12d3-a456-426614174002'],
      analysisType: 'summary',
      compareDocuments: true,
    };

    it('should perform batch analysis', async () => {
      const { aiAnalysisService } = require('../../services/aiAnalysis');
      aiAnalysisService.batchAnalyzeDocuments = jest.fn().mockResolvedValue({
        results: [
          { documentId, summary: 'Summary 1' },
          { documentId: '123e4567-e89b-12d3-a456-426614174002', summary: 'Summary 2' },
        ],
        comparison: { similarity: 0.75, differences: [] },
        summary: 'Batch analysis complete',
        successCount: 2,
        failureCount: 0,
        totalProcessingTime: 5000,
      });

      const response = await request(app)
        .post('/api/analysis/batch')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validBatchRequest)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Batch analysis completed successfully',
        data: {
          batchId: expect.any(String),
          documentIds: validBatchRequest.documentIds,
          results: expect.any(Array),
          comparison: expect.any(Object),
          metadata: {
            totalDocuments: 2,
            successfulAnalyses: 2,
            failedAnalyses: 0,
          },
        },
      });
    });

    it('should reject too many documents', async () => {
      const tooManyDocs = Array(15).fill(0).map(() => uuidv4());
      
      await request(app)
        .post('/api/analysis/batch')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ documentIds: tooManyDocs })
        .expect(400);
    });

    it('should require authentication', async () => {
      await request(app)
        .post('/api/analysis/batch')
        .send(validBatchRequest)
        .expect(401);
    });
  });

  describe('GET /api/analysis/:documentId/recommendations', () => {
    it('should generate recommendations', async () => {
      const { aiAnalysisService } = require('../../services/aiAnalysis');
      aiAnalysisService.generateRecommendations = jest.fn().mockResolvedValue({
        items: [
          { category: 'negotiation', priority: 'high', recommendation: 'Negotiate better terms' },
          { category: 'legal', priority: 'medium', recommendation: 'Review liability clause' },
        ],
        totalCount: 2,
        categories: ['negotiation', 'legal'],
        priorityBreakdown: { high: 1, medium: 1, low: 0 },
        actionableItems: 2,
        confidence: 0.87,
      });

      const response = await request(app)
        .get(`/api/analysis/${documentId}/recommendations`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          documentId,
          recommendations: expect.any(Array),
          totalRecommendations: expect.any(Number),
          categories: expect.any(Array),
          priorityBreakdown: expect.any(Object),
        },
      });
    });

    it('should require authentication', async () => {
      await request(app)
        .get(`/api/analysis/${documentId}/recommendations`)
        .expect(401);
    });
  });

  describe('GET /api/analysis/:documentId/compliance', () => {
    it('should check compliance', async () => {
      const { aiAnalysisService } = require('../../services/aiAnalysis');
      aiAnalysisService.checkCompliance = jest.fn().mockResolvedValue({
        jurisdiction: 'US',
        overallCompliance: 'compliant',
        complianceScore: 8.5,
        regulations: ['GDPR', 'CCPA'],
        violations: [],
        warnings: [],
        recommendations: [],
        confidence: 0.93,
      });

      const response = await request(app)
        .get(`/api/analysis/${documentId}/compliance?jurisdiction=US`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          documentId,
          jurisdiction: 'US',
          overallCompliance: expect.any(String),
          complianceScore: expect.any(Number),
          regulations: expect.any(Array),
        },
      });
    });

    it('should require authentication', async () => {
      await request(app)
        .get(`/api/analysis/${documentId}/compliance`)
        .expect(401);
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      const { aiAnalysisService } = require('../../services/aiAnalysis');
      aiAnalysisService.analyzeDocument = jest.fn().mockRejectedValue(new Error('AI service unavailable'));

      await request(app)
        .post(`/api/analysis/${documentId}/analyze`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ analysisType: 'full' })
        .expect(500);
    });

    it('should validate document ID format', async () => {
      await request(app)
        .post('/api/analysis/invalid-id/analyze')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ analysisType: 'full' })
        .expect(400);
    });
  });
});