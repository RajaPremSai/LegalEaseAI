import { Router, Request, Response } from 'express';
import { 
  uploadService, 
  multerConfig, 
  uploadProgressMiddleware, 
  uploadErrorHandler 
} from '../services/upload';
import { z } from 'zod';

// Local schema definition to avoid import issues
const DocumentUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  fileSize: z.number().max(50 * 1024 * 1024), // 50MB max
  mimeType: z.enum(['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']),
  jurisdiction: z.string().min(2).max(10).optional(),
});
import { authMiddleware } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/rateLimit';

const router = Router();

// Apply authentication and rate limiting to all upload routes
router.use(authMiddleware);
router.use(rateLimitMiddleware);

/**
 * POST /api/upload/document
 * Upload a legal document for processing
 */
router.post(
  '/document',
  uploadProgressMiddleware,
  multerConfig.single('document'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: 'No file provided',
          message: 'Please select a document to upload',
        });
      }

      // Validate request body
      const validationResult = DocumentUploadSchema.safeParse({
        filename: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        jurisdiction: req.body.jurisdiction,
      });

      if (!validationResult.success) {
        return res.status(400).json({
          error: 'Validation failed',
          message: 'Invalid file or request parameters',
          details: validationResult.error.errors,
        });
      }

      // Get user ID from auth middleware
      const userId = (req as any).user.id;

      // Upload file
      const uploadedFile = await uploadService.uploadFile(req.file, userId);

      res.status(201).json({
        success: true,
        message: 'File uploaded successfully',
        data: {
          fileId: uploadedFile.id,
          filename: uploadedFile.filename,
          originalName: uploadedFile.originalName,
          size: uploadedFile.size,
          mimeType: uploadedFile.mimeType,
          uploadedAt: uploadedFile.uploadedAt,
          checksum: uploadedFile.checksum,
        },
      });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({
        error: 'Upload failed',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    }
  }
);

/**
 * GET /api/upload/progress/:sessionId
 * Get upload progress for a session
 */
router.get('/progress/:sessionId', (req: Request, res: Response) => {
  const { sessionId } = req.params;
  
  // Set up Server-Sent Events for real-time progress updates
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  // Listen for progress events
  const progressHandler = (data: any) => {
    if (data.sessionId === sessionId) {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  };

  req.app.on('upload-progress', progressHandler);

  // Clean up on client disconnect
  req.on('close', () => {
    req.app.removeListener('upload-progress', progressHandler);
  });
});

/**
 * DELETE /api/upload/:fileId
 * Delete an uploaded file
 */
router.delete('/:fileId', async (req: Request, res: Response) => {
  try {
    const { fileId } = req.params;
    const userId = (req as any).user.id;

    // Construct file path (assuming standard naming convention)
    const filePath = `uploads/${userId}/${fileId}`;

    await uploadService.deleteFile(filePath);

    res.json({
      success: true,
      message: 'File deleted successfully',
    });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({
      error: 'Delete failed',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
});

/**
 * GET /api/upload/:fileId/url
 * Get a signed URL for file download
 */
router.get('/:fileId/url', async (req: Request, res: Response) => {
  try {
    const { fileId } = req.params;
    const userId = (req as any).user.id;
    const expiresIn = parseInt(req.query.expires as string) || 3600; // Default 1 hour

    // Construct file path
    const filePath = `uploads/${userId}/${fileId}`;

    const url = await uploadService.getFileUrl(filePath, expiresIn);

    res.json({
      success: true,
      data: {
        url,
        expiresIn,
        expiresAt: new Date(Date.now() + expiresIn * 1000),
      },
    });
  } catch (error) {
    console.error('URL generation error:', error);
    res.status(500).json({
      error: 'URL generation failed',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
});

/**
 * POST /api/upload/:fileId/verify
 * Verify file integrity
 */
router.post('/:fileId/verify', async (req: Request, res: Response) => {
  try {
    const { fileId } = req.params;
    const { checksum } = req.body;
    const userId = (req as any).user.id;

    if (!checksum) {
      return res.status(400).json({
        error: 'Missing checksum',
        message: 'Checksum is required for verification',
      });
    }

    // Construct file path
    const filePath = `uploads/${userId}/${fileId}`;

    const isValid = await uploadService.verifyFileIntegrity(filePath, checksum);

    res.json({
      success: true,
      data: {
        fileId,
        isValid,
        verified: isValid,
      },
    });
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({
      error: 'Verification failed',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
});

// Apply upload error handler
router.use(uploadErrorHandler);

export default router;