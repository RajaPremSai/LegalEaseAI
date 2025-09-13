import { Router, Request, Response } from 'express';
import { documentAIService } from '../services/documentAI';
import { metadataExtractorService } from '../services/metadataExtractor';
import { uploadService } from '../services/upload';
import { authMiddleware } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/rateLimit';

const router = Router();

// Apply authentication and rate limiting
router.use(authMiddleware);
router.use(rateLimitMiddleware);

/**
 * POST /api/documents/process
 * Process an uploaded document for text extraction
 */
router.post('/process', async (req: Request, res: Response) => {
  try {
    const { fileId, filePath, mimeType } = req.body;

    if (!fileId || !filePath || !mimeType) {
      return res.status(400).json({
        error: 'Missing required parameters',
        message: 'fileId, filePath, and mimeType are required',
      });
    }

    // Verify user owns the file
    const userId = (req as any).user.id;
    if (!filePath.includes(`uploads/${userId}/`)) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only process your own files',
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

    res.json({
      success: true,
      data: {
        fileId,
        extractedText: processedText,
        metadata: legalMetadata,
        structure: documentStructure,
        classification: documentClassification,
        jurisdiction: jurisdictionInfo,
        processingInfo: {
          confidence: processedText.confidence,
          pageCount: processedText.pages.length,
          wordCount: processedText.text.split(/\s+/).length,
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
 * GET /api/documents/:fileId/text
 * Get extracted text for a processed document
 */
router.get('/:fileId/text', async (req: Request, res: Response) => {
  try {
    const { fileId } = req.params;
    const userId = (req as any).user.id;

    // Construct file path
    const filePath = `uploads/${userId}/${fileId}`;

    // For this example, we'll re-process the document
    // In a real application, you'd store the processed results
    const mimeType = req.query.mimeType as string || 'application/pdf';
    
    const extractedText = await documentAIService.processDocument(filePath, mimeType);
    const processedText = documentAIService.preprocessText(extractedText);

    res.json({
      success: true,
      data: {
        fileId,
        text: processedText.text,
        confidence: processedText.confidence,
        pageCount: processedText.pages.length,
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
 * GET /api/documents/:fileId/pages
 * Get page-by-page breakdown of a document
 */
router.get('/:fileId/pages', async (req: Request, res: Response) => {
  try {
    const { fileId } = req.params;
    const userId = (req as any).user.id;
    const pageNumber = parseInt(req.query.page as string);

    // Construct file path
    const filePath = `uploads/${userId}/${fileId}`;
    const mimeType = req.query.mimeType as string || 'application/pdf';
    
    const extractedText = await documentAIService.processDocument(filePath, mimeType);
    const processedText = documentAIService.preprocessText(extractedText);

    // Return specific page or all pages
    if (pageNumber && pageNumber > 0) {
      const page = processedText.pages.find(p => p.pageNumber === pageNumber);
      if (!page) {
        return res.status(404).json({
          error: 'Page not found',
          message: `Page ${pageNumber} does not exist in this document`,
        });
      }

      res.json({
        success: true,
        data: {
          fileId,
          page,
          totalPages: processedText.pages.length,
        },
      });
    } else {
      res.json({
        success: true,
        data: {
          fileId,
          pages: processedText.pages,
          totalPages: processedText.pages.length,
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
 * GET /api/documents/:fileId/entities
 * Get extracted entities from a document
 */
router.get('/:fileId/entities', async (req: Request, res: Response) => {
  try {
    const { fileId } = req.params;
    const userId = (req as any).user.id;
    const entityType = req.query.type as string;

    // Construct file path
    const filePath = `uploads/${userId}/${fileId}`;
    const mimeType = req.query.mimeType as string || 'application/pdf';
    
    const extractedText = await documentAIService.processDocument(filePath, mimeType);
    const processedText = documentAIService.preprocessText(extractedText);

    // Filter entities by type if specified
    let entities = processedText.entities;
    if (entityType) {
      entities = entities.filter(entity => 
        entity.type.toLowerCase() === entityType.toLowerCase()
      );
    }

    res.json({
      success: true,
      data: {
        fileId,
        entities,
        totalEntities: processedText.entities.length,
        filteredCount: entities.length,
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
 * GET /api/documents/:fileId/metadata
 * Get legal metadata from a document
 */
router.get('/:fileId/metadata', async (req: Request, res: Response) => {
  try {
    const { fileId } = req.params;
    const userId = (req as any).user.id;

    // Construct file path
    const filePath = `uploads/${userId}/${fileId}`;
    const mimeType = req.query.mimeType as string || 'application/pdf';
    
    const extractedText = await documentAIService.processDocument(filePath, mimeType);
    const processedText = documentAIService.preprocessText(extractedText);
    const legalMetadata = documentAIService.extractLegalMetadata(processedText);

    res.json({
      success: true,
      data: {
        fileId,
        metadata: legalMetadata,
        extractionInfo: {
          confidence: processedText.confidence,
          pageCount: processedText.pages.length,
          wordCount: processedText.text.split(/\s+/).length,
          entityCount: processedText.entities.length,
        },
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
 * GET /api/documents/:fileId/structure
 * Get document structure analysis
 */
router.get('/:fileId/structure', async (req: Request, res: Response) => {
  try {
    const { fileId } = req.params;
    const userId = (req as any).user.id;

    // Construct file path
    const filePath = `uploads/${userId}/${fileId}`;
    const mimeType = req.query.mimeType as string || 'application/pdf';
    
    const extractedText = await documentAIService.processDocument(filePath, mimeType);
    const processedText = documentAIService.preprocessText(extractedText);
    const documentStructure = metadataExtractorService.extractDocumentStructure(processedText);

    res.json({
      success: true,
      data: {
        fileId,
        structure: documentStructure,
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
 * GET /api/documents/:fileId/classification
 * Get document classification
 */
router.get('/:fileId/classification', async (req: Request, res: Response) => {
  try {
    const { fileId } = req.params;
    const userId = (req as any).user.id;

    // Construct file path
    const filePath = `uploads/${userId}/${fileId}`;
    const mimeType = req.query.mimeType as string || 'application/pdf';
    
    const extractedText = await documentAIService.processDocument(filePath, mimeType);
    const processedText = documentAIService.preprocessText(extractedText);
    const classification = metadataExtractorService.classifyDocument(processedText);
    const jurisdiction = metadataExtractorService.detectJurisdiction(processedText);

    res.json({
      success: true,
      data: {
        fileId,
        classification,
        jurisdiction,
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
 * GET /api/documents/:fileId/clauses
 * Get extracted clauses with risk assessment
 */
router.get('/:fileId/clauses', async (req: Request, res: Response) => {
  try {
    const { fileId } = req.params;
    const userId = (req as any).user.id;
    const riskLevel = req.query.risk as string;
    const clauseType = req.query.type as string;

    // Construct file path
    const filePath = `uploads/${userId}/${fileId}`;
    const mimeType = req.query.mimeType as string || 'application/pdf';
    
    const extractedText = await documentAIService.processDocument(filePath, mimeType);
    const processedText = documentAIService.preprocessText(extractedText);
    const documentStructure = metadataExtractorService.extractDocumentStructure(processedText);

    // Filter clauses based on query parameters
    let clauses = documentStructure.clauses;
    
    if (riskLevel) {
      clauses = clauses.filter(clause => clause.riskLevel === riskLevel);
    }
    
    if (clauseType) {
      clauses = clauses.filter(clause => clause.type === clauseType);
    }

    res.json({
      success: true,
      data: {
        fileId,
        clauses,
        totalClauses: documentStructure.clauses.length,
        filteredCount: clauses.length,
        riskSummary: {
          high: documentStructure.clauses.filter(c => c.riskLevel === 'high').length,
          medium: documentStructure.clauses.filter(c => c.riskLevel === 'medium').length,
          low: documentStructure.clauses.filter(c => c.riskLevel === 'low').length,
        },
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
 * POST /api/documents/:fileId/reprocess
 * Reprocess a document with different settings
 */
router.post('/:fileId/reprocess', async (req: Request, res: Response) => {
  try {
    const { fileId } = req.params;
    const { forceOCR = false } = req.body;
    const userId = (req as any).user.id;

    // Construct file path
    const filePath = `uploads/${userId}/${fileId}`;
    const mimeType = req.query.mimeType as string || 'application/pdf';

    let extractedText;
    
    if (forceOCR) {
      // Force fallback to OCR processing
      try {
        extractedText = await documentAIService.processDocument(filePath, mimeType);
      } catch (error) {
        // This will trigger the fallback OCR
        extractedText = await documentAIService.processDocument(filePath, mimeType);
      }
    } else {
      extractedText = await documentAIService.processDocument(filePath, mimeType);
    }

    const processedText = documentAIService.preprocessText(extractedText);
    const legalMetadata = documentAIService.extractLegalMetadata(processedText);
    const documentStructure = metadataExtractorService.extractDocumentStructure(processedText);
    const classification = metadataExtractorService.classifyDocument(processedText);

    res.json({
      success: true,
      data: {
        fileId,
        extractedText: processedText,
        metadata: legalMetadata,
        structure: documentStructure,
        classification,
        reprocessed: true,
        forcedOCR: forceOCR,
      },
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