import { Router, Request, Response } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import { validateRequest, validateParams, validateQuery } from '../middleware/validation';
import { 
  DocumentAnalysisRequestSchema,
  DocumentSchema 
} from '@legal-ai/shared';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { aiAnalysisService } from '../services/aiAnalysis';
import { riskAssessmentService } from '../services/riskAssessment';

const router = Router();

// Apply authentication and rate limiting
router.use(authMiddleware);
router.use(rateLimitMiddleware);

// Validation schemas
const DocumentIdParamsSchema = z.object({
  documentId: z.string().uuid('Invalid document ID format'),
});

const AnalysisRequestSchema = z.object({
  analysisType: z.enum(['full', 'summary', 'risk_only', 'key_terms']).default('full'),
  includeRecommendations: z.boolean().default(true),
  riskThreshold: z.enum(['low', 'medium', 'high']).optional(),
  focusAreas: z.array(z.enum(['financial', 'legal', 'privacy', 'operational'])).optional(),
});

const RiskAssessmentRequestSchema = z.object({
  assessmentType: z.enum(['comprehensive', 'quick', 'targeted']).default('comprehensive'),
  riskCategories: z.array(z.enum(['financial', 'legal', 'privacy', 'operational'])).optional(),
  includeRecommendations: z.boolean().default(true),
  severity: z.enum(['all', 'high', 'medium', 'low']).default('all'),
});

const BatchAnalysisRequestSchema = z.object({
  documentIds: z.array(z.string().uuid()).min(1).max(10),
  analysisType: z.enum(['full', 'summary', 'risk_only']).default('summary'),
  compareDocuments: z.boolean().default(false),
});

/**
 * POST /api/analysis/:documentId/analyze
 * Perform comprehensive AI analysis on a document
 */
router.post('/:documentId/analyze', 
  validateParams(DocumentIdParamsSchema),
  validateRequest(AnalysisRequestSchema),
  async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;
    const { analysisType, includeRecommendations, riskThreshold, focusAreas } = req.body;
    const userId = (req as AuthenticatedRequest).user.id;

    // TODO: Verify user owns the document
    // const document = await documentService.getDocument(documentId, userId);

    // Perform AI analysis
    const analysisResult = await aiAnalysisService.analyzeDocument(documentId, {
      type: analysisType,
      includeRecommendations,
      riskThreshold,
      focusAreas,
      userId,
    });

    // Generate analysis ID for tracking
    const analysisId = uuidv4();

    res.status(201).json({
      success: true,
      message: 'Document analysis completed successfully',
      data: {
        analysisId,
        documentId,
        analysisType,
        completedAt: new Date(),
        results: analysisResult,
        metadata: {
          processingTime: analysisResult.processingTime,
          confidence: analysisResult.confidence,
          modelVersion: analysisResult.modelVersion,
        },
      },
    });
  } catch (error) {
    console.error('Document analysis error:', error);
    res.status(500).json({
      error: 'Analysis failed',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
});

/**
 * POST /api/analysis/:documentId/risk-assessment
 * Perform detailed risk assessment on a document
 */
router.post('/:documentId/risk-assessment',
  validateParams(DocumentIdParamsSchema),
  validateRequest(RiskAssessmentRequestSchema),
  async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;
    const { assessmentType, riskCategories, includeRecommendations, severity } = req.body;
    const userId = (req as AuthenticatedRequest).user.id;

    // Perform risk assessment
    const riskAssessment = await riskAssessmentService.assessDocumentRisk(documentId, {
      type: assessmentType,
      categories: riskCategories,
      includeRecommendations,
      severityFilter: severity,
      userId,
    });

    const assessmentId = uuidv4();

    res.status(201).json({
      success: true,
      message: 'Risk assessment completed successfully',
      data: {
        assessmentId,
        documentId,
        assessmentType,
        completedAt: new Date(),
        overallRiskScore: riskAssessment.overallRiskScore,
        riskLevel: riskAssessment.riskLevel,
        risks: riskAssessment.risks,
        recommendations: riskAssessment.recommendations,
        summary: riskAssessment.summary,
        categoryBreakdown: riskAssessment.categoryBreakdown,
        metadata: {
          assessmentTime: riskAssessment.processingTime,
          confidence: riskAssessment.confidence,
          rulesApplied: riskAssessment.rulesApplied,
        },
      },
    });
  } catch (error) {
    console.error('Risk assessment error:', error);
    res.status(500).json({
      error: 'Risk assessment failed',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
});

/**
 * GET /api/analysis/:documentId/summary
 * Get a plain-language summary of the document
 */
router.get('/:documentId/summary', 
  validateParams(DocumentIdParamsSchema),
  async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;
    const userId = (req as AuthenticatedRequest).user.id;
    const includeKeyTerms = req.query.includeKeyTerms === 'true';
    const readingLevel = req.query.readingLevel as string || '8th-grade';

    // Generate document summary
    const summary = await aiAnalysisService.generateDocumentSummary(documentId, {
      readingLevel,
      includeKeyTerms,
      userId,
    });

    res.json({
      success: true,
      data: {
        documentId,
        summary: summary.text,
        keyPoints: summary.keyPoints,
        keyTerms: includeKeyTerms ? summary.keyTerms : undefined,
        readingLevel,
        wordCount: summary.wordCount,
        estimatedReadingTime: summary.estimatedReadingTime,
        generatedAt: new Date(),
        confidence: summary.confidence,
      },
    });
  } catch (error) {
    console.error('Summary generation error:', error);
    res.status(500).json({
      error: 'Summary generation failed',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
});

/**
 * GET /api/analysis/:documentId/key-terms
 * Extract and explain key legal terms from the document
 */
router.get('/:documentId/key-terms',
  validateParams(DocumentIdParamsSchema),
  async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;
    const userId = (req as AuthenticatedRequest).user.id;
    const includeDefinitions = req.query.includeDefinitions !== 'false';
    const importance = req.query.importance as string;

    const keyTerms = await aiAnalysisService.extractKeyTerms(documentId, {
      includeDefinitions,
      importanceFilter: importance as 'high' | 'medium' | 'low' | undefined,
      userId,
    });

    res.json({
      success: true,
      data: {
        documentId,
        keyTerms: keyTerms.terms,
        totalTerms: keyTerms.totalCount,
        categories: keyTerms.categories,
        importanceBreakdown: keyTerms.importanceBreakdown,
        extractedAt: new Date(),
        confidence: keyTerms.confidence,
      },
    });
  } catch (error) {
    console.error('Key terms extraction error:', error);
    res.status(500).json({
      error: 'Key terms extraction failed',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
});

/**
 * POST /api/analysis/batch
 * Perform batch analysis on multiple documents
 */
router.post('/batch',
  validateRequest(BatchAnalysisRequestSchema),
  async (req: Request, res: Response) => {
  try {
    const { documentIds, analysisType, compareDocuments } = req.body;
    const userId = (req as AuthenticatedRequest).user.id;

    // TODO: Verify user owns all documents
    
    const batchResults = await aiAnalysisService.batchAnalyzeDocuments(documentIds, {
      analysisType,
      compareDocuments,
      userId,
    });

    const batchId = uuidv4();

    res.status(201).json({
      success: true,
      message: 'Batch analysis completed successfully',
      data: {
        batchId,
        documentIds,
        analysisType,
        completedAt: new Date(),
        results: batchResults.results,
        comparison: compareDocuments ? batchResults.comparison : undefined,
        summary: batchResults.summary,
        metadata: {
          totalDocuments: documentIds.length,
          successfulAnalyses: batchResults.successCount,
          failedAnalyses: batchResults.failureCount,
          totalProcessingTime: batchResults.totalProcessingTime,
        },
      },
    });
  } catch (error) {
    console.error('Batch analysis error:', error);
    res.status(500).json({
      error: 'Batch analysis failed',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
});

/**
 * GET /api/analysis/:documentId/recommendations
 * Get actionable recommendations based on document analysis
 */
router.get('/:documentId/recommendations',
  validateParams(DocumentIdParamsSchema),
  async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;
    const userId = (req as AuthenticatedRequest).user.id;
    const category = req.query.category as string;
    const priority = req.query.priority as string;

    const recommendations = await aiAnalysisService.generateRecommendations(documentId, {
      categoryFilter: category as 'negotiation' | 'legal' | 'financial' | 'operational' | undefined,
      priorityFilter: priority as 'high' | 'medium' | 'low' | undefined,
      userId,
    });

    res.json({
      success: true,
      data: {
        documentId,
        recommendations: recommendations.items,
        totalRecommendations: recommendations.totalCount,
        categories: recommendations.categories,
        priorityBreakdown: recommendations.priorityBreakdown,
        actionableItems: recommendations.actionableItems,
        generatedAt: new Date(),
        confidence: recommendations.confidence,
      },
    });
  } catch (error) {
    console.error('Recommendations generation error:', error);
    res.status(500).json({
      error: 'Recommendations generation failed',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
});

/**
 * GET /api/analysis/:documentId/compliance
 * Check document compliance with regulations and standards
 */
router.get('/:documentId/compliance',
  validateParams(DocumentIdParamsSchema),
  async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;
    const userId = (req as AuthenticatedRequest).user.id;
    const jurisdiction = req.query.jurisdiction as string;
    const regulations = req.query.regulations as string;

    const complianceCheck = await aiAnalysisService.checkCompliance(documentId, {
      jurisdiction: jurisdiction || 'US',
      regulations: regulations ? regulations.split(',') : undefined,
      userId,
    });

    res.json({
      success: true,
      data: {
        documentId,
        jurisdiction: complianceCheck.jurisdiction,
        overallCompliance: complianceCheck.overallCompliance,
        complianceScore: complianceCheck.complianceScore,
        regulations: complianceCheck.regulations,
        violations: complianceCheck.violations,
        warnings: complianceCheck.warnings,
        recommendations: complianceCheck.recommendations,
        checkedAt: new Date(),
        confidence: complianceCheck.confidence,
      },
    });
  } catch (error) {
    console.error('Compliance check error:', error);
    res.status(500).json({
      error: 'Compliance check failed',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
});

/**
 * GET /api/analysis/:documentId/history
 * Get analysis history for a document
 */
router.get('/:documentId/history',
  validateParams(DocumentIdParamsSchema),
  async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;
    const userId = (req as AuthenticatedRequest).user.id;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = parseInt(req.query.offset as string) || 0;

    // TODO: Implement analysis history retrieval from database
    const mockHistory = [
      {
        id: uuidv4(),
        documentId,
        analysisType: 'full',
        completedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        riskScore: 'medium',
        confidence: 0.92,
      },
      {
        id: uuidv4(),
        documentId,
        analysisType: 'risk_only',
        completedAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
        riskScore: 'high',
        confidence: 0.88,
      },
    ];

    res.json({
      success: true,
      data: {
        documentId,
        history: mockHistory.slice(offset, offset + limit),
        pagination: {
          limit,
          offset,
          total: mockHistory.length,
          hasMore: offset + limit < mockHistory.length,
        },
      },
    });
  } catch (error) {
    console.error('Analysis history error:', error);
    res.status(500).json({
      error: 'Failed to retrieve analysis history',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
});

export default router;