import express from 'express';
import { QuestionSchema } from '@legal-ai/shared';
import { questionAnsweringService } from '../services/questionAnswering';
import { authMiddleware } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';

const router = express.Router();

/**
 * POST /api/qa/ask
 * Ask a question about a document
 */
router.post('/ask', authMiddleware, validateRequest(QuestionSchema), async (req, res) => {
  try {
    const { documentId, question, conversationId } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const response = await questionAnsweringService.askQuestion(
      documentId,
      userId,
      question,
      conversationId
    );

    res.json({
      success: true,
      data: response
    });

  } catch (error) {
    console.error('Error in Q&A endpoint:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process question'
    });
  }
});

/**
 * GET /api/qa/conversations/:documentId
 * Get conversation history for a document
 */
router.get('/conversations/:documentId', authMiddleware, async (req, res) => {
  try {
    const { documentId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const conversations = await questionAnsweringService.getConversationHistory(
      documentId,
      userId
    );

    res.json({
      success: true,
      data: conversations
    });

  } catch (error) {
    console.error('Error getting conversation history:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get conversation history'
    });
  }
});

/**
 * POST /api/qa/embeddings/:documentId
 * Generate embeddings for a document (admin/internal use)
 */
router.post('/embeddings/:documentId', authMiddleware, async (req, res) => {
  try {
    const { documentId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Get document from Firestore
    const firestoreService = require('../services/firestore').firestoreService;
    const document = await firestoreService.getDocument(documentId);

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Verify user owns the document
    if (document.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await questionAnsweringService.generateDocumentEmbeddings(document);

    res.json({
      success: true,
      message: 'Embeddings generated successfully'
    });

  } catch (error) {
    console.error('Error generating embeddings:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate embeddings'
    });
  }
});

export default router;