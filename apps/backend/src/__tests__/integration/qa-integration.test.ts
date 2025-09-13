import request from 'supertest';
import express from 'express';
import qaRoutes from '../../routes/qa';

// Mock the shared package
jest.mock('@legal-ai/shared', () => ({
  QuestionSchema: {
    parse: jest.fn((data) => data)
  }
}));

// Mock the services
jest.mock('../../services/questionAnswering', () => ({
  questionAnsweringService: {
    askQuestion: jest.fn(),
    getConversationHistory: jest.fn(),
    generateDocumentEmbeddings: jest.fn()
  }
}));

jest.mock('../../services/firestore', () => ({
  firestoreService: {
    getDocument: jest.fn(),
    getAnalysisByDocumentId: jest.fn()
  }
}));

jest.mock('../../middleware/auth', () => ({
  authMiddleware: (req: any, res: any, next: any) => {
    req.user = { id: 'test-user-1' };
    next();
  }
}));

describe('Q&A API Integration Tests', () => {
  let app: express.Application;
  let mockQAService: any;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/qa', qaRoutes);

    // Get the mocked service
    mockQAService = require('../../services/questionAnswering').questionAnsweringService;
    jest.clearAllMocks();
  });

  describe('POST /api/qa/ask', () => {
    it('should process a question and return an answer', async () => {
      const mockResponse = {
        answer: 'The security deposit is $2,000 as specified in clause 3.',
        sources: [
          {
            clauseId: 'clause-3',
            clauseTitle: 'Security Deposit',
            relevantText: 'Tenant shall pay a security deposit of $2,000...',
            location: { startIndex: 100, endIndex: 200 },
            confidence: 0.95
          }
        ],
        conversationId: 'conv-123',
        confidence: 0.92
      };

      mockQAService.askQuestion.mockResolvedValue(mockResponse);

      const response = await request(app)
        .post('/api/qa/ask')
        .send({
          documentId: 'doc-123',
          question: 'How much is the security deposit?'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.answer).toContain('$2,000');
      expect(response.body.data.sources).toHaveLength(1);
      expect(response.body.data.conversationId).toBe('conv-123');

      expect(mockQAService.askQuestion).toHaveBeenCalledWith(
        'doc-123',
        'test-user-1',
        'How much is the security deposit?',
        undefined
      );
    });

    it('should handle questions with conversation context', async () => {
      const mockResponse = {
        answer: 'Based on our previous discussion about the lease terms, the rent is due monthly.',
        sources: [],
        conversationId: 'conv-123',
        confidence: 0.85
      };

      mockQAService.askQuestion.mockResolvedValue(mockResponse);

      const response = await request(app)
        .post('/api/qa/ask')
        .send({
          documentId: 'doc-123',
          question: 'When is rent due?',
          conversationId: 'conv-123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockQAService.askQuestion).toHaveBeenCalledWith(
        'doc-123',
        'test-user-1',
        'When is rent due?',
        'conv-123'
      );
    });

    it('should return error for invalid request data', async () => {
      const response = await request(app)
        .post('/api/qa/ask')
        .send({
          documentId: 'doc-123'
          // Missing required 'question' field
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should handle service errors gracefully', async () => {
      mockQAService.askQuestion.mockRejectedValue(new Error('Document not found'));

      const response = await request(app)
        .post('/api/qa/ask')
        .send({
          documentId: 'non-existent-doc',
          question: 'What is this about?'
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Document not found');
    });
  });

  describe('GET /api/qa/conversations/:documentId', () => {
    it('should return conversation history for a document', async () => {
      const mockConversations = [
        {
          id: 'conv-1',
          documentId: 'doc-123',
          userId: 'test-user-1',
          messages: [
            {
              id: 'msg-1',
              role: 'user',
              content: 'What is the rent amount?',
              timestamp: new Date()
            },
            {
              id: 'msg-2',
              role: 'assistant',
              content: 'The monthly rent is $1,500.',
              timestamp: new Date(),
              sources: []
            }
          ],
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      mockQAService.getConversationHistory.mockResolvedValue(mockConversations);

      const response = await request(app)
        .get('/api/qa/conversations/doc-123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].messages).toHaveLength(2);

      expect(mockQAService.getConversationHistory).toHaveBeenCalledWith(
        'doc-123',
        'test-user-1'
      );
    });

    it('should handle empty conversation history', async () => {
      mockQAService.getConversationHistory.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/qa/conversations/doc-123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(0);
    });
  });

  describe('POST /api/qa/embeddings/:documentId', () => {
    it('should generate embeddings for a document', async () => {
      const mockFirestoreService = require('../../services/firestore').firestoreService;
      
      mockFirestoreService.getDocument.mockResolvedValue({
        id: 'doc-123',
        userId: 'test-user-1',
        filename: 'test.pdf',
        documentType: 'lease',
        jurisdiction: 'US-CA',
        uploadedAt: new Date(),
        expiresAt: new Date(),
        status: 'analyzed',
        metadata: {
          pageCount: 1,
          wordCount: 100,
          language: 'en',
          fileSize: 1024,
          mimeType: 'application/pdf'
        },
        storageInfo: {
          bucketName: 'test',
          fileName: 'test.pdf'
        }
      });

      mockQAService.generateDocumentEmbeddings.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/qa/embeddings/doc-123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Embeddings generated successfully');
    });

    it('should return 404 for non-existent document', async () => {
      const mockFirestoreService = require('../../services/firestore').firestoreService;
      mockFirestoreService.getDocument.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/qa/embeddings/non-existent-doc');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Document not found');
    });

    it('should return 403 for unauthorized access', async () => {
      const mockFirestoreService = require('../../services/firestore').firestoreService;
      
      mockFirestoreService.getDocument.mockResolvedValue({
        id: 'doc-123',
        userId: 'different-user', // Different user
        filename: 'test.pdf',
        documentType: 'lease',
        jurisdiction: 'US-CA',
        uploadedAt: new Date(),
        expiresAt: new Date(),
        status: 'analyzed',
        metadata: {
          pageCount: 1,
          wordCount: 100,
          language: 'en',
          fileSize: 1024,
          mimeType: 'application/pdf'
        },
        storageInfo: {
          bucketName: 'test',
          fileName: 'test.pdf'
        }
      });

      const response = await request(app)
        .post('/api/qa/embeddings/doc-123');

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Access denied');
    });
  });

  describe('Question Processing Accuracy', () => {
    it('should handle legal terminology questions', async () => {
      const mockResponse = {
        answer: 'A security deposit is money held by the landlord as protection against potential damages to the property.',
        sources: [
          {
            clauseId: 'clause-definitions',
            clauseTitle: 'Definitions',
            relevantText: 'Security deposit means any payment...',
            location: { startIndex: 50, endIndex: 150 },
            confidence: 0.88
          }
        ],
        conversationId: 'conv-456',
        confidence: 0.88
      };

      mockQAService.askQuestion.mockResolvedValue(mockResponse);

      const response = await request(app)
        .post('/api/qa/ask')
        .send({
          documentId: 'doc-123',
          question: 'What is a security deposit?'
        });

      expect(response.status).toBe(200);
      expect(response.body.data.answer).toContain('protection against');
      expect(response.body.data.confidence).toBeGreaterThan(0.8);
    });

    it('should handle complex multi-part questions', async () => {
      const mockResponse = {
        answer: 'The lease term is 12 months starting January 1st, and early termination requires 60 days notice plus a penalty fee.',
        sources: [
          {
            clauseId: 'clause-term',
            clauseTitle: 'Lease Term',
            relevantText: 'This lease shall commence on January 1st...',
            location: { startIndex: 200, endIndex: 300 },
            confidence: 0.92
          },
          {
            clauseId: 'clause-termination',
            clauseTitle: 'Early Termination',
            relevantText: 'Tenant may terminate early with 60 days notice...',
            location: { startIndex: 800, endIndex: 900 },
            confidence: 0.85
          }
        ],
        conversationId: 'conv-789',
        confidence: 0.89
      };

      mockQAService.askQuestion.mockResolvedValue(mockResponse);

      const response = await request(app)
        .post('/api/qa/ask')
        .send({
          documentId: 'doc-123',
          question: 'How long is the lease and what happens if I need to move out early?'
        });

      expect(response.status).toBe(200);
      expect(response.body.data.sources).toHaveLength(2);
      expect(response.body.data.answer).toContain('12 months');
      expect(response.body.data.answer).toContain('60 days notice');
    });

    it('should handle questions about document risks', async () => {
      const mockResponse = {
        answer: 'The main risks in this document include: high security deposit ($2,000), automatic rent increases, and limited tenant rights for repairs.',
        sources: [
          {
            clauseId: 'clause-deposit',
            clauseTitle: 'Security Deposit',
            relevantText: 'Security deposit of $2,000...',
            location: { startIndex: 100, endIndex: 200 },
            confidence: 0.95
          }
        ],
        conversationId: 'conv-risk',
        confidence: 0.91
      };

      mockQAService.askQuestion.mockResolvedValue(mockResponse);

      const response = await request(app)
        .post('/api/qa/ask')
        .send({
          documentId: 'doc-123',
          question: 'What are the main risks I should be aware of in this lease?'
        });

      expect(response.status).toBe(200);
      expect(response.body.data.answer).toContain('risks');
      expect(response.body.data.confidence).toBeGreaterThan(0.9);
    });
  });
});