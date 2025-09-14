import { Router, Request, Response } from 'express';
import { documentAIService } from '../services/documentAI';
import { metadataExtractorService } from '../services/metadataExtractor';
import { uploadService } from '../services/upload';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import { validateRequest, validateParams, validateQuery } from '../middleware/validation';
import { 
  DocumentAnalysisRequestSchema, 
  DocumentUploadSchema,
  DocumentSchema 
} from '@legal-ai/shared';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Apply authentication and rate limiting
router.use(authMiddleware);
router.use(rateLimitMiddleware);

// Validation schemas for API endpoints
const DocumentIdParamsSchema = z.object({
  documentId: z.string().uuid('Invalid document ID format'),
});

const DocumentListQuerySchema = z.object({
  page: z.string().transform(val => parseInt(val)).pipe(z.number().min(1)).optional().default('1'),
  limit: z.string().transform(val => parseInt(val)).pipe(z.number().min(1).max(100)).optional().default('10'),
  status: z.enum(['processing', 'analyzed', 'error']).optional(),
  documentType: z.enum(['contract', 'lease', 'terms_of_service', 'privacy_policy', 'loan_agreement', 'other']).optional(),
  sortBy: z.enum(['uploadedAt', 'filename', 'status']).optional().default('uploadedAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

const DocumentProcessRequestSchema = z.object({
  fileId: z.string().min(1, 'File ID is required'),
  filePath: z.string().min(1, 'File path is required'),
  mimeType: z.enum(['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']),
  jurisdiction: z.string().min(2).max(10).optional(),
});

const DocumentReprocessRequestSchema = z.object({
  forceOCR: z.boolean().optional().default(false),
  analysisType: z.enum(['full', 'summary', 'risk_only']).optional().default('full'),
});

const PageQuerySchema = z.object({
  page: z.string().transform(val => parseInt(val)).pipe(z.number().min(1)).optional(),
  mimeType: z.enum(['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']).optional(),
});

const EntityQuerySchema = z.object({
  type: z.string().optional(),
  mimeType: z.enum(['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']).optional(),
});

const ClauseQuerySchema = z.object({
  risk: z.enum(['low', 'medium', 'high']).optional(),
  type: z.string().optional(),
  mimeType: z.enum(['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']).optional(),
});

/**
 * GET /api/documents
 * List user's documents with pagination and filtering
 */
router.get('/', validateQuery(DocumentListQuerySchema), async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).user.id;
    const { page, limit, status, documentType, sortBy, sortOrder } = req.query as any;

    // Calculate pagination
    const offset = (page - 1) * limit;

    // Build filter conditions
    const filters: any = { userId };
    if (status) filters.status = status;
    if (documentType) filters.documentType = documentType;

    // TODO: Replace with actual database query
    // For now, return mock data structure
    const mockDocuments = [
      {
        id: uuidv4(),
        userId,
        filename: 'sample-contract.pdf',
        documentType: 'contract',
        jurisdiction: 'US',
        uploadedAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        status: 'analyzed',
        metadata: {
          pageCount: 5,
          wordCount: 1250,
          language: 'en',
          extractedText: 'Sample contract text...'
        }
      }
    ];

    const totalCount = mockDocuments.length;
    const totalPages = Math.ceil(totalCount / limit);

    res.json({
      success: true,
      data: {
        documents: mockDocuments.slice(offset, offset + limit),
        pagination: {
          currentPage: page,
          totalPages,
          totalCount,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
        filters: {
          status,
          documentType,
          sortBy,
          sortOrder,
        },
      },
    });
  } catch (error) {
    console.error('Document listing error:', error);
    res.status(500).json({
      error: 'Failed to retrieve documents',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
});

/**
 * GET /api/documents/:documentId
 * Get a specific document by ID
 */
router.get('/:documentId', validateParams(DocumentIdParamsSchema), async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;
    const userId = (req as AuthenticatedRequest).user.id;

    // TODO: Replace with actual database query
    // Verify user owns the document and retrieve it
    const mockDocument = {
      id: documentId,
      userId,
      filename: 'sample-contract.pdf',
      documentType: 'contract',
      jurisdiction: 'US',
      uploadedAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      status: 'analyzed',
      metadata: {
        pageCount: 5,
        wordCount: 1250,
        language: 'en',
        extractedText: 'Sample contract text...'
      },
      analysis: {
        summary: 'This is a standard employment contract...',
        riskScore: 'medium',
        keyTerms: [],
        risks: [],
        recommendations: [],
        clauses: [],
        generatedAt: new Date(),
      }
    };

    res.json({
      success: true,
      data: mockDocument,
    });
  } catch (error) {
    console.error('Document retrieval error:', error);
    res.status(500).json({
      error: 'Failed to retrieve document',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
});

/**
 * DELETE /api/documents/:documentId
 * Delete a document and its associated files
 */
router.delete('/:documentId', validateParams(DocumentIdParamsSchema), async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;
    const userId = (req as AuthenticatedRequest).user.id;

    // TODO: Replace with actual database operations
    // 1. Verify user owns the document
    // 2. Delete from database
    // 3. Delete associated files from storage
    
    // For now, simulate the deletion
    const filePath = `uploads/${userId}/${documentId}`;
    
    try {
      await uploadService.deleteFile(filePath);
    } catch (storageError) {
      console.warn('File deletion warning:', storageError);
      // Continue with database deletion even if file deletion fails
    }

    res.json({
      success: true,
      message: 'Document deleted successfully',
      data: {
        documentId,
        deletedAt: new Date(),
      },
    });
  } catch (error) {
    console.error('Document deletion error:', error);
    res.status(500).json({
      error: 'Failed to delete document',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
});

/**
 * POST /api/documents/process
 * Process an uploaded document for text extraction
 */
router.post('/process', validateRequest(DocumentProcessRequestSchema), async (req: Request, res: Response) => {
  try {
    const { fileId, filePath, mimeType, jurisdiction } = req.body;
    const userId = (req as AuthenticatedRequest).user.id;

    // Verify user owns the file
    if (!filePath.includes(`uploads/${userId}/`)) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only process your own files',
      });
    }

    // Check if file exists
    try {
      await uploadService.verifyFileExists(filePath);
    } catch (fileError) {
      return res.status(404).json({
        error: 'File not found',
        message: 'The specified file does not exist or has been deleted',
      });
    }

    // Process document with Document AI
    const extractedText = await documentAIService.processDocument(filePath, mimeType);

    // Preprocess the extracted text
    const processedText = documentAIService.preprocessText(extractedText);

    // Extract legal metadata
    const legalMetadata = documentAIService.extractLegalMetadata(processedText);

    // Extract document structure and advanced metadata
    const documentStructure = metadataExtractorService.extractDocumentStructure(processedText);
    const documentClassification = metadataExtractorService.classifyDocument(processedText);
    const jurisdictionInfo = metadataExtractorService.detectJurisdiction(processedText);

    // Create document record
    const documentRecord = {
      id: uuidv4(),
      userId,
      filename: fileId, // This should be the original filename
      documentType: documentClassification.type || 'other',
      jurisdiction: jurisdiction || jurisdictionInfo.jurisdiction || 'US',
      uploadedAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
      status: 'analyzed' as const,
      metadata: {
        pageCount: processedText.pages.length,
        wordCount: processedText.text.split(/\s+/).length,
        language: processedText.language || 'en',
        extractedText: processedText.text,
      },
    };

    // TODO: Save document record to database

    res.status(201).json({
      success: true,
      message: 'Document processed successfully',
      data: {
        document: documentRecord,
        processing: {
          extractedText: processedText,
          metadata: legalMetadata,
          structure: documentStructure,
          classification: documentClassification,
          jurisdiction: jurisdictionInfo,
          confidence: processedText.confidence,
          entityCount: processedText.entities.length,
          clauseCount: documentStructure.clauses.length,
          sectionCount: documentStructure.sections.length,
        },
      },
    });
  } catch (error) {
    console.error('Document processing error:', error);
    res.status(500).json({
      error: 'Processing failed',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
});

/**
 * GET /api/documents/:documentId/text
 * Get extracted text for a processed document
 */
router.get('/:documentId/text', validateParams(DocumentIdParamsSchema), async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;
    const userId = (req as AuthenticatedRequest).user.id;

    // TODO: Replace with actual database query to get document
    // Verify user owns the document and get stored text
    const mockDocument = {
      id: documentId,
      userId,
      metadata: {
        extractedText: 'Sample extracted text from the document...',
        pageCount: 5,
        wordCount: 1250,
        language: 'en',
      }
    };

    if (mockDocument.userId !== userId) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only access your own documents',
      });
    }

    res.json({
      success: true,
      data: {
        documentId,
        text: mockDocument.metadata.extractedText,
        pageCount: mockDocument.metadata.pageCount,
        wordCount: mockDocument.metadata.wordCount,
        language: mockDocument.metadata.language,
      },
    });
  } catch (error) {
    console.error('Text extraction error:', error);
    res.status(500).json({
      error: 'Text extraction failed',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
});

/**
 * GET /api/documents/:documentId/pages
 * Get page-by-page breakdown of a document
 */
router.get('/:documentId/pages', 
  validateParams(DocumentIdParamsSchema), 
  validateQuery(PageQuerySchema), 
  async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;
    const { page: pageNumber } = req.query as any;
    const userId = (req as AuthenticatedRequest).user.id;

    // TODO: Replace with actual database query to get document pages
    // Mock pages data
    const mockPages = [
      { pageNumber: 1, text: 'Page 1 content...', confidence: 0.95 },
      { pageNumber: 2, text: 'Page 2 content...', confidence: 0.92 },
      { pageNumber: 3, text: 'Page 3 content...', confidence: 0.98 },
    ];

    // Return specific page or all pages
    if (pageNumber) {
      const page = mockPages.find(p => p.pageNumber === pageNumber);
      if (!page) {
        return res.status(404).json({
          error: 'Page not found',
          message: `Page ${pageNumber} does not exist in this document`,
        });
      }

      res.json({
        success: true,
        data: {
          documentId,
          page,
          totalPages: mockPages.length,
        },
      });
    } else {
      res.json({
        success: true,
        data: {
          documentId,
          pages: mockPages,
          totalPages: mockPages.length,
        },
      });
    }
  } catch (error) {
    console.error('Page extraction error:', error);
    res.status(500).json({
      error: 'Page extraction failed',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
});

/**
 * GET /api/documents/:documentId/entities
 * Get extracted entities from a document
 */
router.get('/:documentId/entities', 
  validateParams(DocumentIdParamsSchema),
  validateQuery(EntityQuerySchema),
  async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;
    const { type: entityType } = req.query as any;
    const userId = (req as AuthenticatedRequest).user.id;

    // TODO: Replace with actual database query to get document entities
    // Mock entities data
    const mockEntities = [
      { type: 'PERSON', text: 'John Doe', confidence: 0.95, location: { startIndex: 10, endIndex: 18 } },
      { type: 'DATE', text: '2024-01-15', confidence: 0.98, location: { startIndex: 50, endIndex: 60 } },
      { type: 'MONEY', text: '$50,000', confidence: 0.92, location: { startIndex: 100, endIndex: 107 } },
    ];

    // Filter entities by type if specified
    let entities = mockEntities;
    if (entityType) {
      entities = entities.filter(entity => 
        entity.type.toLowerCase() === entityType.toLowerCase()
      );
    }

    res.json({
      success: true,
      data: {
        documentId,
        entities,
        totalEntities: mockEntities.length,
        filteredCount: entities.length,
        availableTypes: [...new Set(mockEntities.map(e => e.type))],
      },
    });
  } catch (error) {
    console.error('Entity extraction error:', error);
    res.status(500).json({
      error: 'Entity extraction failed',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
});

/**
 * GET /api/documents/:documentId/metadata
 * Get legal metadata from a document
 */
router.get('/:documentId/metadata', validateParams(DocumentIdParamsSchema), async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;
    const userId = (req as AuthenticatedRequest).user.id;

    // TODO: Replace with actual database query to get document metadata
    // Mock metadata
    const mockMetadata = {
      documentType: 'contract',
      jurisdiction: 'US',
      language: 'en',
      parties: ['Company ABC', 'John Doe'],
      effectiveDate: '2024-01-15',
      expirationDate: '2025-01-15',
      keyTerms: ['employment', 'salary', 'benefits'],
      legalConcepts: ['at-will employment', 'confidentiality', 'non-compete'],
    };

    const extractionInfo = {
      confidence: 0.95,
      pageCount: 5,
      wordCount: 1250,
      entityCount: 15,
      extractedAt: new Date(),
    };

    res.json({
      success: true,
      data: {
        documentId,
        metadata: mockMetadata,
        extractionInfo,
      },
    });
  } catch (error) {
    console.error('Metadata extraction error:', error);
    res.status(500).json({
      error: 'Metadata extraction failed',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
});

/**
 * GET /api/documents/:documentId/structure
 * Get document structure analysis
 */
router.get('/:documentId/structure', validateParams(DocumentIdParamsSchema), async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;
    const userId = (req as AuthenticatedRequest).user.id;

    // TODO: Replace with actual database query to get document structure
    // Mock structure data
    const mockStructure = {
      sections: [
        { id: '1', title: 'Introduction', startIndex: 0, endIndex: 200, level: 1 },
        { id: '2', title: 'Terms and Conditions', startIndex: 201, endIndex: 800, level: 1 },
        { id: '2.1', title: 'Payment Terms', startIndex: 201, endIndex: 400, level: 2 },
        { id: '2.2', title: 'Termination', startIndex: 401, endIndex: 800, level: 2 },
      ],
      clauses: [
        {
          id: uuidv4(),
          title: 'Payment Terms',
          content: 'Payment shall be made within 30 days...',
          location: { startIndex: 201, endIndex: 400 },
          riskLevel: 'low',
          explanation: 'Standard payment terms with reasonable timeframe.',
        },
      ],
      headers: ['Introduction', 'Terms and Conditions', 'Payment Terms', 'Termination'],
      footers: ['Page 1 of 5', 'Confidential'],
    };

    res.json({
      success: true,
      data: {
        documentId,
        structure: mockStructure,
      },
    });
  } catch (error) {
    console.error('Structure extraction error:', error);
    res.status(500).json({
      error: 'Structure extraction failed',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
});

/**
 * GET /api/documents/:documentId/classification
 * Get document classification
 */
router.get('/:documentId/classification', validateParams(DocumentIdParamsSchema), async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;
    const userId = (req as AuthenticatedRequest).user.id;

    // TODO: Replace with actual database query to get document classification
    // Mock classification data
    const mockClassification = {
      type: 'contract',
      subtype: 'employment_contract',
      confidence: 0.92,
      categories: ['legal', 'employment', 'business'],
      complexity: 'medium',
      standardness: 'high', // How standard/common this type of document is
    };

    const mockJurisdiction = {
      jurisdiction: 'US',
      state: 'CA',
      confidence: 0.88,
      indicators: ['California Civil Code', 'at-will employment'],
      applicableLaws: ['California Labor Code', 'Federal Employment Law'],
    };

    res.json({
      success: true,
      data: {
        documentId,
        classification: mockClassification,
        jurisdiction: mockJurisdiction,
      },
    });
  } catch (error) {
    console.error('Classification error:', error);
    res.status(500).json({
      error: 'Classification failed',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
});

/**
 * GET /api/documents/:documentId/clauses
 * Get extracted clauses with risk assessment
 */
router.get('/:documentId/clauses', 
  validateParams(DocumentIdParamsSchema),
  validateQuery(ClauseQuerySchema),
  async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;
    const { risk: riskLevel, type: clauseType } = req.query as any;
    const userId = (req as AuthenticatedRequest).user.id;

    // TODO: Replace with actual database query to get document clauses
    // Mock clauses data
    const mockClauses = [
      {
        id: uuidv4(),
        title: 'Payment Terms',
        content: 'Payment shall be made within 30 days of invoice date...',
        location: { startIndex: 201, endIndex: 400 },
        riskLevel: 'low',
        explanation: 'Standard payment terms with reasonable timeframe.',
        type: 'payment',
      },
      {
        id: uuidv4(),
        title: 'Termination Clause',
        content: 'Either party may terminate this agreement with 30 days notice...',
        location: { startIndex: 401, endIndex: 600 },
        riskLevel: 'medium',
        explanation: 'Mutual termination clause provides flexibility but may lack protection.',
        type: 'termination',
      },
      {
        id: uuidv4(),
        title: 'Liability Limitation',
        content: 'Company liability shall not exceed the total amount paid...',
        location: { startIndex: 601, endIndex: 800 },
        riskLevel: 'high',
        explanation: 'Liability cap may limit your ability to recover damages.',
        type: 'liability',
      },
    ];

    // Filter clauses based on query parameters
    let clauses = mockClauses;
    
    if (riskLevel) {
      clauses = clauses.filter(clause => clause.riskLevel === riskLevel);
    }
    
    if (clauseType) {
      clauses = clauses.filter(clause => clause.type === clauseType);
    }

    const riskSummary = {
      high: mockClauses.filter(c => c.riskLevel === 'high').length,
      medium: mockClauses.filter(c => c.riskLevel === 'medium').length,
      low: mockClauses.filter(c => c.riskLevel === 'low').length,
    };

    res.json({
      success: true,
      data: {
        documentId,
        clauses,
        totalClauses: mockClauses.length,
        filteredCount: clauses.length,
        riskSummary,
        availableTypes: [...new Set(mockClauses.map(c => c.type))],
      },
    });
  } catch (error) {
    console.error('Clause extraction error:', error);
    res.status(500).json({
      error: 'Clause extraction failed',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
});

/**
 * POST /api/documents/:documentId/reprocess
 * Reprocess a document with different settings
 */
router.post('/:documentId/reprocess', 
  validateParams(DocumentIdParamsSchema),
  validateRequest(DocumentReprocessRequestSchema),
  async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;
    const { forceOCR, analysisType } = req.body;
    const userId = (req as AuthenticatedRequest).user.id;

    // TODO: Replace with actual document reprocessing logic
    // 1. Verify user owns the document
    // 2. Get original file path from database
    // 3. Reprocess with new settings
    // 4. Update database with new results

    // Mock reprocessing result
    const reprocessedResult = {
      documentId,
      reprocessedAt: new Date(),
      settings: {
        forceOCR,
        analysisType,
      },
      results: {
        extractedText: 'Reprocessed text content...',
        confidence: forceOCR ? 0.85 : 0.95, // OCR typically has lower confidence
        metadata: {
          pageCount: 5,
          wordCount: 1300, // Might be different after reprocessing
          language: 'en',
        },
        analysis: analysisType === 'full' ? {
          summary: 'Updated document summary...',
          riskScore: 'medium',
          keyTerms: [],
          risks: [],
          recommendations: [],
          clauses: [],
          generatedAt: new Date(),
        } : null,
      },
    };

    res.json({
      success: true,
      message: 'Document reprocessed successfully',
      data: reprocessedResult,
    });
  } catch (error) {
    console.error('Document reprocessing error:', error);
    res.status(500).json({
      error: 'Reprocessing failed',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
});

export default router;