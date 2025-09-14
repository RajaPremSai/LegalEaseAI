import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { PrivacyService } from '../services/privacy';
import { firestoreService } from '../services/firestore';
import { storageService } from '../services/storage';
import { authMiddleware } from '../middleware/auth';
import { validationMiddleware } from '../middleware/validation';

const router = Router();

// Initialize privacy service
const privacyService = new PrivacyService(firestoreService, storageService);

// Validation schemas
const consentSchema = z.object({
  consentType: z.enum(['data_processing', 'analytics', 'marketing', 'cookies']),
  granted: z.boolean(),
  policyVersion: z.string().min(1, 'Policy version is required'),
});

const dataDeletionSchema = z.object({
  deletionType: z.enum(['partial', 'complete']).default('complete'),
});

/**
 * POST /privacy/consent
 * Record user consent for data processing
 */
router.post('/consent', authMiddleware, validationMiddleware(consentSchema), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'User not authenticated',
      });
    }

    const { consentType, granted, policyVersion } = req.body;
    
    // Extract client metadata
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';

    const consentId = await privacyService.recordConsent(
      req.user.id,
      consentType,
      granted,
      {
        ipAddress,
        userAgent,
        policyVersion,
      }
    );

    res.json({
      success: true,
      message: 'Consent recorded successfully',
      data: {
        consentId,
        consentType,
        granted,
        recordedAt: new Date(),
      },
    });
  } catch (error) {
    console.error('Consent recording error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Consent recording failed',
      message: 'Failed to record consent',
    });
  }
});

/**
 * GET /privacy/consent
 * Get user consent history
 */
router.get('/consent', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'User not authenticated',
      });
    }

    const consents = await privacyService.getUserConsent(req.user.id);

    res.json({
      success: true,
      data: {
        consents,
      },
    });
  } catch (error) {
    console.error('Consent retrieval error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Consent retrieval failed',
      message: 'Failed to retrieve consent history',
    });
  }
});

/**
 * GET /privacy/consent/:consentType
 * Check if user has granted specific consent
 */
router.get('/consent/:consentType', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'User not authenticated',
      });
    }

    const { consentType } = req.params;
    
    // Validate consent type
    const validConsentTypes = ['data_processing', 'analytics', 'marketing', 'cookies'];
    if (!validConsentTypes.includes(consentType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid consent type',
        message: 'Consent type must be one of: ' + validConsentTypes.join(', '),
      });
    }

    const hasConsent = await privacyService.hasConsent(
      req.user.id,
      consentType as 'data_processing' | 'analytics' | 'marketing' | 'cookies'
    );

    res.json({
      success: true,
      data: {
        consentType,
        granted: hasConsent,
      },
    });
  } catch (error) {
    console.error('Consent check error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Consent check failed',
      message: 'Failed to check consent status',
    });
  }
});

/**
 * POST /privacy/data-export
 * Request data export (GDPR Article 20 - Right to Data Portability)
 */
router.post('/data-export', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'User not authenticated',
      });
    }

    const requestId = await privacyService.requestDataExport(req.user.id);

    res.json({
      success: true,
      message: 'Data export request submitted successfully',
      data: {
        requestId,
        status: 'pending',
        estimatedCompletionTime: '24 hours',
        note: 'You will receive an email when your data export is ready for download',
      },
    });
  } catch (error) {
    console.error('Data export request error:', error);
    
    if (error instanceof Error && error.message === 'Data export request already in progress') {
      return res.status(409).json({
        success: false,
        error: 'Request already in progress',
        message: 'You already have a pending data export request',
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Data export request failed',
      message: 'Failed to submit data export request',
    });
  }
});

/**
 * GET /privacy/data-export/:requestId
 * Get data export request status
 */
router.get('/data-export/:requestId', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'User not authenticated',
      });
    }

    const { requestId } = req.params;
    const exportRequest = await privacyService.getDataExportStatus(requestId);

    if (!exportRequest) {
      return res.status(404).json({
        success: false,
        error: 'Request not found',
        message: 'Data export request not found',
      });
    }

    // Verify the request belongs to the authenticated user
    if (exportRequest.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'You can only access your own data export requests',
      });
    }

    res.json({
      success: true,
      data: {
        requestId: exportRequest.id,
        status: exportRequest.status,
        requestedAt: exportRequest.requestedAt,
        completedAt: exportRequest.completedAt,
        downloadUrl: exportRequest.downloadUrl,
        expiresAt: exportRequest.expiresAt,
      },
    });
  } catch (error) {
    console.error('Data export status error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Status check failed',
      message: 'Failed to check data export status',
    });
  }
});

/**
 * POST /privacy/data-deletion
 * Request data deletion (GDPR Article 17 - Right to Erasure)
 */
router.post('/data-deletion', authMiddleware, validationMiddleware(dataDeletionSchema), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'User not authenticated',
      });
    }

    const { deletionType } = req.body;
    const requestId = await privacyService.requestDataDeletion(req.user.id, deletionType);

    res.json({
      success: true,
      message: 'Data deletion request submitted successfully',
      data: {
        requestId,
        deletionType,
        status: 'pending',
        estimatedCompletionTime: '30 days',
        warning: deletionType === 'complete' 
          ? 'Complete deletion will permanently remove all your data and cannot be undone'
          : 'Partial deletion will remove personal data while retaining some records for legal compliance',
      },
    });
  } catch (error) {
    console.error('Data deletion request error:', error);
    
    if (error instanceof Error && error.message === 'Data deletion request already in progress') {
      return res.status(409).json({
        success: false,
        error: 'Request already in progress',
        message: 'You already have a pending data deletion request',
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Data deletion request failed',
      message: 'Failed to submit data deletion request',
    });
  }
});

/**
 * GET /privacy/data-deletion/:requestId
 * Get data deletion request status
 */
router.get('/data-deletion/:requestId', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'User not authenticated',
      });
    }

    const { requestId } = req.params;
    const deletionRequest = await privacyService.getDataDeletionStatus(requestId);

    if (!deletionRequest) {
      return res.status(404).json({
        success: false,
        error: 'Request not found',
        message: 'Data deletion request not found',
      });
    }

    // Verify the request belongs to the authenticated user
    if (deletionRequest.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'You can only access your own data deletion requests',
      });
    }

    res.json({
      success: true,
      data: {
        requestId: deletionRequest.id,
        status: deletionRequest.status,
        deletionType: deletionRequest.deletionType,
        requestedAt: deletionRequest.requestedAt,
        completedAt: deletionRequest.completedAt,
        retainedData: deletionRequest.retainedData,
      },
    });
  } catch (error) {
    console.error('Data deletion status error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Status check failed',
      message: 'Failed to check data deletion status',
    });
  }
});

/**
 * GET /privacy/policy
 * Get current privacy policy information
 */
router.get('/policy', async (req: Request, res: Response) => {
  try {
    // In a real application, this would fetch from a database or CMS
    const privacyPolicy = {
      version: '1.0.0',
      effectiveDate: '2024-01-01',
      lastUpdated: '2024-01-01',
      dataRetentionPeriod: '24 hours for documents, indefinite for user profiles',
      dataProcessingPurposes: [
        'Document analysis and AI processing',
        'User account management',
        'Service improvement and analytics',
        'Legal compliance and security',
      ],
      userRights: [
        'Right to access your data',
        'Right to rectification of inaccurate data',
        'Right to erasure (right to be forgotten)',
        'Right to data portability',
        'Right to object to processing',
        'Right to restrict processing',
      ],
      contactInformation: {
        email: 'privacy@legalai.com',
        address: '123 Legal Street, Privacy City, PC 12345',
      },
    };

    res.json({
      success: true,
      data: privacyPolicy,
    });
  } catch (error) {
    console.error('Privacy policy retrieval error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Policy retrieval failed',
      message: 'Failed to retrieve privacy policy',
    });
  }
});

/**
 * POST /privacy/schedule-cleanup
 * Schedule document cleanup (admin endpoint)
 */
router.post('/schedule-cleanup', async (req: Request, res: Response) => {
  try {
    // In production, this would be protected by admin authentication
    // For now, we'll allow it for testing purposes
    
    const cleanupResults = await privacyService.cleanupExpiredDocuments();
    
    res.json({
      success: true,
      message: 'Cleanup completed successfully',
      data: cleanupResults,
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Cleanup failed',
      message: 'Failed to perform cleanup',
    });
  }
});

export default router;