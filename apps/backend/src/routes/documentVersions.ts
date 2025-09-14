import { Router, Request, Response } from 'express';
import { DocumentVersioningService } from '../services/documentVersioning';
import { DocumentComparisonService } from '../services/documentComparison';
import { DocumentVersionRepository } from '../database/repositories/documentVersionRepository';
import { getDatabase } from '../database/connection';
import { DocumentComparisonRequestSchema } from '@legal-ai/shared';
import { authMiddleware } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';

const router = Router();

// Initialize services
const db = getDatabase();
const versionRepository = new DocumentVersionRepository(db);
const comparisonService = new DocumentComparisonService();
const versioningService = new DocumentVersioningService(versionRepository, comparisonService);

/**
 * Get version history for a document
 */
router.get('/:documentId/history', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;
    
    const history = await versioningService.getVersionHistory(documentId);
    
    res.json({
      success: true,
      data: history,
    });
  } catch (error) {
    console.error('Error getting version history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve version history',
    });
  }
});

/**
 * Get a specific version
 */
router.get('/version/:versionId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { versionId } = req.params;
    
    const version = await versioningService.getVersion(versionId);
    
    if (!version) {
      return res.status(404).json({
        success: false,
        error: 'Version not found',
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
  authMiddleware, 
  validateRequest(DocumentComparisonRequestSchema),
  async (req: Request, res: Response) => {
    try {
      const { originalVersionId, comparedVersionId } = req.body;
      
      const comparison = await versioningService.compareVersions(
        originalVersionId,
        comparedVersionId
      );
      
      res.json({
        success: true,
        data: comparison,
      });
    } catch (error) {
      console.error('Error comparing versions:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to compare versions',
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