import { Router, Request, Response } from 'express';
import { DocumentVersioningService } from '../services/documentVersioning';
import { DocumentComparisonService } from '../services/documentComparison';
import { DocumentVersionRepository } from '../database/repositories/documentVersionRepository';
import { getDatabase } from '../database/connection';
import { DocumentComparisonRequestSchema } from '@legal-ai/shared';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import { validateRequest, validateParams, validateQuery } from '../middleware/validation';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Apply authentication and rate limiting
router.use(authMiddleware);
router.use(rateLimitMiddleware);

// Initialize services
const db = getDatabase();
const versionRepository = new DocumentVersionRepository(db);
const comparisonService = new DocumentComparisonService();
const versioningService = new DocumentVersioningService(versionRepository, comparisonService);

// Validation schemas
const DocumentIdParamsSchema = z.object({
  documentId: z.string().uuid('Invalid document ID format'),
});

const VersionIdParamsSchema = z.object({
  versionId: z.string().uuid('Invalid version ID format'),
});

const ComparisonIdParamsSchema = z.object({
  comparisonId: z.string().uuid('Invalid comparison ID format'),
});

const VersionHistoryQuerySchema = z.object({
  limit: z.string().transform(val => parseInt(val)).pipe(z.number().min(1).max(50)).optional().default('10'),
  offset: z.string().transform(val => parseInt(val)).pipe(z.number().min(0)).optional().default('0'),
  includeAnalysis: z.string().transform(val => val === 'true').optional().default('false'),
});

const CreateVersionSchema = z.object({
  filename: z.string().min(1).max(255),
  metadata: z.object({
    pageCount: z.number().min(1),
    wordCount: z.number().min(0),
    language: z.string().min(2).max(10),
    extractedText: z.string(),
  }),
  analysis: z.any().optional(),
  parentVersionId: z.string().uuid().optional(),
});

const RollbackSchema = z.object({
  filename: z.string().min(1).max(255),
  reason: z.string().max(500).optional(),
});

const CleanupQuerySchema = z.object({
  retentionDays: z.string().transform(val => parseInt(val)).pipe(z.number().min(1).max(365)).optional().default('30'),
});

/**
 * Get version history for a document
 */
router.get('/:documentId/history', 
  validateParams(DocumentIdParamsSchema),
  validateQuery(VersionHistoryQuerySchema),
  async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;
    const { limit, offset, includeAnalysis } = req.query as any;
    const userId = (req as AuthenticatedRequest).user.id;
    
    const history = await versioningService.getVersionHistory(documentId, {
      limit,
      offset,
      includeAnalysis,
      userId,
    });
    
    res.json({
      success: true,
      data: {
        documentId,
        versions: history.versions,
        pagination: {
          limit,
          offset,
          total: history.total,
          hasMore: offset + limit < history.total,
        },
        summary: {
          totalVersions: history.total,
          latestVersion: history.latestVersion,
          firstVersion: history.firstVersion,
          totalComparisons: history.totalComparisons,
        },
      },
    });
  } catch (error) {
    console.error('Error getting version history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve version history',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
});

/**
 * Get a specific version
 */
router.get('/version/:versionId', 
  validateParams(VersionIdParamsSchema),
  async (req: Request, res: Response) => {
  try {
    const { versionId } = req.params;
    const userId = (req as AuthenticatedRequest).user.id;
    
    const version = await versioningService.getVersion(versionId, userId);
    
    if (!version) {
      return res.status(404).json({
        success: false,
        error: 'Version not found',
        message: 'The specified version does not exist or you do not have access to it',
      });
    }
    
    res.json({
      success: true,
      data: version,
    });
  } catch (error) {
    console.error('Error getting version:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve version',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
});

/**
 * Get the latest version of a document
 */
router.get('/:documentId/latest', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;
    
    const version = await versioningService.getLatestVersion(documentId);
    
    if (!version) {
      return res.status(404).json({
        success: false,
        error: 'No versions found for this document',
      });
    }
    
    res.json({
      success: true,
      data: version,
    });
  } catch (error) {
    console.error('Error getting latest version:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve latest version',
    });
  }
});

/**
 * Compare two document versions
 */
router.post('/compare', 
  validateRequest(DocumentComparisonRequestSchema),
  async (req: Request, res: Response) => {
    try {
      const { originalVersionId, comparedVersionId } = req.body;
      const userId = (req as AuthenticatedRequest).user.id;
      
      const comparison = await versioningService.compareVersions(
        originalVersionId,
        comparedVersionId,
        userId
      );
      
      const comparisonId = uuidv4();
      
      res.status(201).json({
        success: true,
        message: 'Document comparison completed successfully',
        data: {
          comparisonId,
          originalVersionId,
          comparedVersionId,
          comparison,
          comparedAt: new Date(),
          metadata: {
            totalChanges: comparison.changes.length,
            significantChanges: comparison.impactAnalysis.significantChanges.length,
            overallImpact: comparison.impactAnalysis.overallImpact,
            riskScoreChange: comparison.impactAnalysis.riskScoreChange,
          },
        },
      });
    } catch (error) {
      console.error('Error comparing versions:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to compare versions',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    }
  }
);

/**
 * Get version differences for a document
 */
router.get('/:documentId/differences', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;
    
    const differences = await versioningService.getVersionDifferences(documentId);
    
    res.json({
      success: true,
      data: differences,
    });
  } catch (error) {
    console.error('Error getting version differences:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve version differences',
    });
  }
});

/**
 * Get version statistics for a document
 */
router.get('/:documentId/statistics', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;
    
    const statistics = await versioningService.getVersionStatistics(documentId);
    
    res.json({
      success: true,
      data: statistics,
    });
  } catch (error) {
    console.error('Error getting version statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve version statistics',
    });
  }
});

/**
 * Rollback to a previous version
 */
router.post('/:documentId/rollback/:versionId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { documentId, versionId } = req.params;
    const { filename } = req.body;
    
    if (!filename) {
      return res.status(400).json({
        success: false,
        error: 'Filename is required for rollback',
      });
    }
    
    const newVersion = await versioningService.rollbackToVersion(
      documentId,
      versionId,
      filename
    );
    
    res.json({
      success: true,
      data: newVersion,
      message: `Successfully rolled back to version ${versionId}`,
    });
  } catch (error) {
    console.error('Error rolling back version:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to rollback version',
    });
  }
});

/**
 * Get a specific comparison by ID
 */
router.get('/comparison/:comparisonId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { comparisonId } = req.params;
    
    const comparison = await versionRepository.getComparisonById(comparisonId);
    
    if (!comparison) {
      return res.status(404).json({
        success: false,
        error: 'Comparison not found',
      });
    }
    
    res.json({
      success: true,
      data: comparison,
    });
  } catch (error) {
    console.error('Error getting comparison:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve comparison',
    });
  }
});

/**
 * Create a new version (typically called when uploading a new document version)
 */
router.post('/:documentId/versions', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;
    const { filename, metadata, analysis, parentVersionId } = req.body;
    
    if (!filename || !metadata) {
      return res.status(400).json({
        success: false,
        error: 'Filename and metadata are required',
      });
    }
    
    const version = await versioningService.createVersion(
      documentId,
      filename,
      metadata,
      analysis,
      parentVersionId
    );
    
    res.status(201).json({
      success: true,
      data: version,
      message: 'Version created successfully',
    });
  } catch (error) {
    console.error('Error creating version:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create version',
    });
  }
});

/**
 * Admin endpoint to cleanup old versions
 */
router.delete('/cleanup', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { retentionDays = 30 } = req.query;
    
    const result = await versioningService.cleanupOldVersions(Number(retentionDays));
    
    res.json({
      success: true,
      data: result,
      message: `Cleanup completed. Deleted ${result.deletedVersions} versions and ${result.deletedComparisons} comparisons`,
    });
  } catch (error) {
    console.error('Error during cleanup:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cleanup old versions',
    });
  }
});

export default router;