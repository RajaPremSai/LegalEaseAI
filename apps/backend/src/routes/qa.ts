import express from 'express';
import { QuestionSchema } from '@legal-ai/shared';
import { questionAnsweringService } from '../services/questionAnswering';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import { validateRequest, validateParams, validateQuery } from '../middleware/validation';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Apply authentication and rate limiting
router.use(authMiddleware);
router.use(rateLimitMiddleware);

// Validation schemas
const DocumentIdParamsSchema = z.object({
  documentId: z.string().uuid('Invalid document ID format'),
});

const ConversationIdParamsSchema = z.object({
  conversationId: z.string().uuid('Invalid conversation ID format'),
});

const EnhancedQuestionSchema = z.object({
  documentId: z.string().uuid('Invalid document ID format'),
  question: z.string().min(1, 'Question cannot be empty').max(1000, 'Question too long'),
  conversationId: z.string().uuid().optional(),
  context: z.object({
    previousQuestions: z.array(z.string()).optional(),
    focusArea: z.enum(['general', 'risks', 'terms', 'obligations', 'rights']).optional(),
    responseStyle: z.enum(['detailed', 'concise', 'simple']).default('detailed'),
  }).optional(),
});

const ConversationQuerySchema = z.object({
  limit: z.string().transform(val => parseInt(val)).pipe(z.number().min(1).max(50)).optional().default('20'),
  offset: z.string().transform(val => parseInt(val)).pipe(z.number().min(0)).optional().default('0'),
  includeContext: z.string().transform(val => val === 'true').optional().default('true'),
});

const BulkQuestionSchema = z.object({
  documentId: z.string().uuid('Invalid document ID format'),
  questions: z.array(z.string().min(1).max(1000)).min(1).max(10),
  conversationId: z.string().uuid().optional(),
});

/**
 * POST /api/qa/ask
 * Ask a question about a document with enhanced context and validation
 */
router.post('/ask', validateRequest(EnhancedQuestionSchema), async (req, res) => {
  try {
    const { documentId, question, conversationId, context } = req.body;
    const userId = (req as AuthenticatedRequest).user.id;

    // TODO: Verify user owns the document
    // const document = await documentService.getDocument(documentId, userId);

    const response = await questionAnsweringService.askQuestion(
      documentId,
      userId,
      question,
      conversationId,
      context
    );

    res.json({
      success: true,
      message: 'Question processed successfully',
      data: {
        questionId: response.questionId,
        conversationId: response.conversationId,
        question,
        answer: response.answer,
        confidence: response.confidence,
        sources: response.sources,
        relatedClauses: response.relatedClauses,
        suggestedFollowUps: response.suggestedFollowUps,
        responseTime: response.responseTime,
        timestamp: new Date(),
        context: {
          focusArea: context?.focusArea,
          responseStyle: context?.responseStyle,
        },
      },
    });

  } catch (error) {
    console.error('Error in Q&A endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process question',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
});

/**
 * GET /api/qa/conversations/:documentId
 * Get conversation history for a document with pagination and filtering
 */
router.get('/conversations/:documentId', 
  validateParams(DocumentIdParamsSchema),
  validateQuery(ConversationQuerySchema),
  async (req, res) => {
  try {
    const { documentId } = req.params;
    const { limit, offset, includeContext } = req.query as any;
    const userId = (req as AuthenticatedRequest).user.id;

    const conversations = await questionAnsweringService.getConversationHistory(
      documentId,
      userId,
      { limit, offset, includeContext }
    );

    res.json({
      success: true,
      data: {
        documentId,
        conversations: conversations.items,
        pagination: {
          limit,
          offset,
          total: conversations.total,
          hasMore: offset + limit < conversations.total,
        },
        summary: {
          totalConversations: conversations.total,
          totalQuestions: conversations.totalQuestions,
          averageResponseTime: conversations.averageResponseTime,
          mostCommonTopics: conversations.mostCommonTopics,
        },
      },
    });

  } catch (error) {
    console.error('Error getting conversation history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get conversation history',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
});

/**
 * GET /api/qa/conversation/:conversationId
 * Get a specific conversation by ID
 */
router.get('/conversation/:conversationId',
  validateParams(ConversationIdParamsSchema),
  async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = (req as AuthenticatedRequest).user.id;

    const conversation = await questionAnsweringService.getConversation(
      conversationId,
      userId
    );

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found',
        message: 'The specified conversation does not exist or you do not have access to it',
      });
    }

    res.json({
      success: true,
      data: conversation,
    });

  } catch (error) {
    console.error('Error getting conversation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get conversation',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
});

/**
 * POST /api/qa/bulk-ask
 * Ask multiple questions about a document at once
 */
router.post('/bulk-ask', validateRequest(BulkQuestionSchema), async (req, res) => {
  try {
    const { documentId, questions, conversationId } = req.body;
    const userId = (req as AuthenticatedRequest).user.id;

    const responses = await questionAnsweringService.askMultipleQuestions(
      documentId,
      userId,
      questions,
      conversationId
    );

    res.json({
      success: true,
      message: 'Bulk questions processed successfully',
      data: {
        documentId,
        conversationId: responses.conversationId,
        questions: questions.length,
        responses: responses.answers,
        summary: {
          totalQuestions: questions.length,
          successfulAnswers: responses.successCount,
          failedAnswers: responses.failureCount,
          averageConfidence: responses.averageConfidence,
          totalProcessingTime: responses.totalProcessingTime,
        },
      },
    });

  } catch (error) {
    console.error('Error in bulk Q&A:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process bulk questions',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
});

/**
 * GET /api/qa/:documentId/suggested-questions
 * Get AI-generated suggested questions for a document
 */
router.get('/:documentId/suggested-questions',
  validateParams(DocumentIdParamsSchema),
  async (req, res) => {
  try {
    const { documentId } = req.params;
    const userId = (req as AuthenticatedRequest).user.id;
    const category = req.query.category as string;
    const limit = parseInt(req.query.limit as string) || 10;

    const suggestedQuestions = await questionAnsweringService.generateSuggestedQuestions(
      documentId,
      userId,
      { category, limit }
    );

    res.json({
      success: true,
      data: {
        documentId,
        questions: suggestedQuestions.questions,
        categories: suggestedQuestions.categories,
        totalSuggestions: suggestedQuestions.questions.length,
        generatedAt: new Date(),
      },
    });

  } catch (error) {
    console.error('Error generating suggested questions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate suggested questions',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
});

/**
 * POST /api/qa/conversation/:conversationId/feedback
 * Provide feedback on a Q&A response
 */
router.post('/conversation/:conversationId/feedback',
  validateParams(ConversationIdParamsSchema),
  validateRequest(z.object({
    questionId: z.string().uuid(),
    rating: z.number().min(1).max(5),
    feedback: z.string().max(500).optional(),
    helpful: z.boolean(),
  })),
  async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { questionId, rating, feedback, helpful } = req.body;
    const userId = (req as AuthenticatedRequest).user.id;

    await questionAnsweringService.submitFeedback(
      conversationId,
      questionId,
      userId,
      { rating, feedback, helpful }
    );

    res.json({
      success: true,
      message: 'Feedback submitted successfully',
      data: {
        conversationId,
        questionId,
        submittedAt: new Date(),
      },
    });

  } catch (error) {
    console.error('Error submitting feedback:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit feedback',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
});

/**
 * DELETE /api/qa/conversation/:conversationId
 * Delete a conversation and all its messages
 */
router.delete('/conversation/:conversationId',
  validateParams(ConversationIdParamsSchema),
  async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = (req as AuthenticatedRequest).user.id;

    await questionAnsweringService.deleteConversation(conversationId, userId);

    res.json({
      success: true,
      message: 'Conversation deleted successfully',
      data: {
        conversationId,
        deletedAt: new Date(),
      },
    });

  } catch (error) {
    console.error('Error deleting conversation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete conversation',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
});

/**
 * POST /api/qa/embeddings/:documentId
 * Generate embeddings for a document (admin/internal use)
 */
router.post('/embeddings/:documentId', 
  validateParams(DocumentIdParamsSchema),
  async (req, res) => {
  try {
    const { documentId } = req.params;
    const userId = (req as AuthenticatedRequest).user.id;

    // Get document from Firestore
    const firestoreService = require('../services/firestore').firestoreService;
    const document = await firestoreService.getDocument(documentId);

    if (!document) {
      return res.status(404).json({ 
        success: false,
        error: 'Document not found',
        message: 'The specified document does not exist',
      });
    }

    // Verify user owns the document
    if (document.userId !== userId) {
      return res.status(403).json({ 
        success: false,
        error: 'Access denied',
        message: 'You do not have permission to access this document',
      });
    }

    const embeddingResult = await questionAnsweringService.generateDocumentEmbeddings(document);

    res.json({
      success: true,
      message: 'Embeddings generated successfully',
      data: {
        documentId,
        embeddingCount: embeddingResult.embeddingCount,
        chunkCount: embeddingResult.chunkCount,
        processingTime: embeddingResult.processingTime,
        generatedAt: new Date(),
      },
    });

  } catch (error) {
    console.error('Error generating embeddings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate embeddings',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
});

export default router;