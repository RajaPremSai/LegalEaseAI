import { Router } from 'express';
import multer from 'multer';
import { CreateBulkJobSchema } from '@legal-ai/shared';
import { BulkProcessingService } from '../services/bulkProcessingService';
import { BulkProcessingRepository } from '../database/repositories/bulkProcessingRepository';
import { WorkspaceRepository } from '../database/repositories/workspaceRepository';
import { DocumentRepository } from '../database/repositories/document.repository';
import { AIAnalysisService } from '../services/aiAnalysis';
import { TemplateService } from '../services/templateService';
import { TemplateRepository } from '../database/repositories/templateRepository';
import { UploadService } from '../services/upload';
import { authenticateToken } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { pool } from '../database/connection';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB per file
    files: 100 // Maximum 100 files per request
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOC, DOCX, and TXT files are allowed.'));
    }
  }
});

// Initialize services
const bulkProcessingRepository = new BulkProcessingRepository(pool);
const workspaceRepository = new WorkspaceRepository(pool);
const documentRepository = new DocumentRepository(pool);
const templateRepository = new TemplateRepository(pool);
const aiAnalysisService = new AIAnalysisService();
const templateService = new TemplateService(templateRepository, documentRepository, aiAnalysisService);
const uploadService = new UploadService();
const bulkProcessingService = new BulkProcessingService(
  bulkProcessingRepository,
  workspaceRepository,
  documentRepository,
  aiAnalysisService,
  templateService,
  uploadService
);

/**
 * POST /api/bulk-processing/jobs
 * Create a new bulk processing job
 */
router.post('/jobs',
  authenticateToken,
  validateRequest(CreateBulkJobSchema),
  async (req, res) => {
    try {
      const userId = req.user?.id;
      const { workspaceId } = req.body;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User authentication required'
        });
      }

      if (!workspaceId) {
        return res.status(400).json({
          success: false,
          error: 'Workspace ID is required'
        });
      }

      const job = await bulkProcessingService.createBulkJob(workspaceId, userId, req.body);
      
      res.status(201).json({
        success: true,
        data: job
      });
    } catch (error) {
      console.error('Create bulk job error:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create bulk job'
      });
    }
  }
);

/**
 * POST /api/bulk-processing/jobs/:id/documents
 * Add documents to a bulk processing job
 */
router.post('/jobs/:id/documents',
  authenticateToken,
  upload.array('documents', 100),
  async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const files = req.files as Express.Multer.File[];
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User authentication required'
        });
      }

      if (!files || files.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No documents provided'
        });
      }

      const documents = await bulkProcessingService.addDocumentsToJob(id, files);
      
      res.json({
        success: true,
        data: documents
      });
    } catch (error) {
      console.error('Add documents to job error:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add documents to job'
      });
    }
  }
);

/**
 * POST /api/bulk-processing/jobs/:id/start
 * Start processing a bulk job
 */
router.post('/jobs/:id/start',
  authenticateToken,
  async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User authentication required'
        });
      }

      await bulkProcessingService.startBulkJob(id);
      
      res.json({
        success: true,
        message: 'Bulk job started successfully'
      });
    } catch (error) {
      console.error('Start bulk job error:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start bulk job'
      });
    }
  }
);

/**
 * GET /api/bulk-processing/jobs/:id
 * Get bulk job details
 */
router.get('/jobs/:id',
  authenticateToken,
  async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User authentication required'
        });
      }

      const job = await bulkProcessingService.getBulkJob(id, userId);
      
      if (!job) {
        return res.status(404).json({
          success: false,
          error: 'Bulk job not found or access denied'
        });
      }

      res.json({
        success: true,
        data: job
      });
    } catch (error) {
      console.error('Get bulk job error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch bulk job'
      });
    }
  }
);

/**
 * GET /api/bulk-processing/jobs
 * Get user's bulk jobs
 */
router.get('/jobs',
  authenticateToken,
  async (req, res) => {
    try {
      const userId = req.user?.id;
      const workspaceId = req.query.workspaceId as string;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User authentication required'
        });
      }

      let jobs;
      if (workspaceId) {
        jobs = await bulkProcessingService.getWorkspaceBulkJobs(workspaceId, userId, limit, offset);
      } else {
        jobs = await bulkProcessingService.getUserBulkJobs(userId, limit, offset);
      }
      
      res.json({
        success: true,
        data: jobs,
        pagination: {
          limit,
          offset,
          total: jobs.length
        }
      });
    } catch (error) {
      console.error('Get bulk jobs error:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch bulk jobs'
      });
    }
  }
);

/**
 * POST /api/bulk-processing/jobs/:id/cancel
 * Cancel a bulk processing job
 */
router.post('/jobs/:id/cancel',
  authenticateToken,
  async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User authentication required'
        });
      }

      const success = await bulkProcessingService.cancelBulkJob(id, userId);
      
      if (!success) {
        return res.status(400).json({
          success: false,
          error: 'Failed to cancel job or job not found'
        });
      }

      res.json({
        success: true,
        message: 'Bulk job cancelled successfully'
      });
    } catch (error) {
      console.error('Cancel bulk job error:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cancel bulk job'
      });
    }
  }
);

/**
 * DELETE /api/bulk-processing/jobs/:id
 * Delete a bulk processing job
 */
router.delete('/jobs/:id',
  authenticateToken,
  async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User authentication required'
        });
      }

      const success = await bulkProcessingService.deleteBulkJob(id, userId);
      
      if (!success) {
        return res.status(404).json({
          success: false,
          error: 'Bulk job not found'
        });
      }

      res.json({
        success: true,
        message: 'Bulk job deleted successfully'
      });
    } catch (error) {
      console.error('Delete bulk job error:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete bulk job'
      });
    }
  }
);

/**
 * GET /api/bulk-processing/workspaces/:id/statistics
 * Get bulk processing statistics for a workspace
 */
router.get('/workspaces/:id/statistics',
  authenticateToken,
  async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const days = parseInt(req.query.days as string) || 30;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User authentication required'
        });
      }

      const statistics = await bulkProcessingService.getJobStatistics(id, userId, days);
      
      res.json({
        success: true,
        data: statistics
      });
    } catch (error) {
      console.error('Get bulk processing statistics error:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch statistics'
      });
    }
  }
);

/**
 * GET /api/bulk-processing/jobs/:id/results/download
 * Download bulk job results
 */
router.get('/jobs/:id/results/download',
  authenticateToken,
  async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const format = req.query.format as string || 'json';
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User authentication required'
        });
      }

      const job = await bulkProcessingService.getBulkJob(id, userId);
      
      if (!job) {
        return res.status(404).json({
          success: false,
          error: 'Bulk job not found or access denied'
        });
      }

      if (!job.results) {
        return res.status(400).json({
          success: false,
          error: 'Job results not available'
        });
      }

      let content: string;
      let contentType: string;
      let filename: string;

      if (format === 'csv') {
        // Generate CSV format
        const csvHeader = 'Filename,Status,Risk Score,Processing Time,Error\n';
        const csvRows = job.results.documents.map(doc => 
          `"${doc.filename}","${doc.status}","${doc.analysis?.riskScore || 'N/A'}","${doc.processingTime}ms","${doc.error || ''}"`
        ).join('\n');
        
        content = csvHeader + csvRows;
        contentType = 'text/csv';
        filename = `bulk-job-${id}-results.csv`;
      } else if (format === 'txt' && job.results.consolidatedReport) {
        content = job.results.consolidatedReport;
        contentType = 'text/plain';
        filename = `bulk-job-${id}-report.txt`;
      } else {
        // Default JSON format
        content = JSON.stringify(job.results, null, 2);
        contentType = 'application/json';
        filename = `bulk-job-${id}-results.json`;
      }

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(content);
    } catch (error) {
      console.error('Download bulk job results error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to download results'
      });
    }
  }
);

export default router;