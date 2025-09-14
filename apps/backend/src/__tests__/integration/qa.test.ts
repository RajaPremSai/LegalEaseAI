import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { authConfig } from '../../config/environment';
import qaRoutes from '../../routes/qa';

// Mock services
jest.mock('../../services/questionAnswering');
jest.mock('../../services/firestore');

const app = express();
app.use(express.json());
app.use('/api/qa', qaRoutes);

// Test user data
const testUser = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  email: 'test@example.com',
  userType: 'individual' as const,
};

// Generate test JWT token
const generateTestToken = (user = testUser) => {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      userType: user.userType,
    },
    authConfig.jwtSecret,
    { expiresIn: '1h' }
  );
};

describe('Q&A API', () => {
  let authToken: string;
  const documentId = '123e4567-e89b-12d3-a456-426614174001';
  const conversationId = '123e4567-e89b-12d3-a456-426614174002';

  beforeEach(() => {
    authToken = generateTestToken();
    jest.clearAllMocks();
  });

  describe('POST /api/qa/ask', () => {
    const validQuestionRequest = {
      documentId,
      question: 'What are the payment terms in this contract?',
      context: {
        focusArea: 'terms',
        responseStyle: 'detailed',
      },
    };

    it('should process a question successfully', async () => {
      const { questionAnsweringService } = require('../../services/questionAnswering');
      questionAnsweringService.askQuestion = jest.fn().mockResolvedValue({
        questionId: 'q123',
        conversationId: 'c123',
        answer: 'Payment is due within 30 days of invoice date.',
        confidence: 0.92,
        sources: [{ clause: 'Payment Terms', location: { startIndex: 100, endIndex: 200 } }],
        relatedClauses: [],
        suggestedFollowUps: ['What happens if payment is late?'],
        responseTime: 1500,
      });

      const response = await request(app)
        .post('/api/qa/ask')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validQuestionRequest)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Question processed successfully',
        data: {
          questionId: expect.any(String),
          conversationId: expect.any(String),
          question: validQuestionRequest.question,
          answer: expect.any(String),
          confidence: expect.any(Number),
          sources: expect.any(Array),
          suggestedFollowUps: expect.any(Array),
          responseTime: expect.any(Number),
          timestamp: expect.any(String),
        },
      });
    });

    it('should handle questions with conversation context', async () => {
      const { questionAnsweringService } = require('../../services/questionAnswering');
      questionAnsweringService.askQuestion = jest.fn().mockResolvedValue({
        questionId: 'q124',
        conversationId,
        answer: 'Based on our previous discussion about payment terms...',
        confidence: 0.88,
        sources: [],
        relatedClauses: [],
        suggestedFollowUps: [],
        responseTime: 1200,
      });

      await request(app)
        .post('/api/qa/ask')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          ...validQuestionRequest,
          conversationId,
          question: 'What about late fees?',
        })
        .expect(200);

      expect(questionAnsweringService.askQuestion).toHaveBeenCalledWith(
        documentId,
        testUser.id,
        'What about late fees?',
        conversationId,
        expect.any(Object)
      );
    });

    it('should reject empty questions', async () => {
      await request(app)
        .post('/api/qa/ask')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          documentId,
          question: '',
        })
        .expect(400);
    });

    it('should reject questions that are too long', async () => {
      const longQuestion = 'a'.repeat(1001);
      
      await request(app)
        .post('/api/qa/ask')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          documentId,
          question: longQuestion,
        })
        .expect(400);
    });

    it('should require authentication', async () => {
      await request(app)
        .post('/api/qa/ask')
        .send(validQuestionRequest)
        .expect(401);
    });
  });

  describe('GET /api/qa/conversations/:documentId', () => {
    it('should retrieve conversation history', async () => {
      const { questionAnsweringService } = require('../../services/questionAnswering');
      questionAnsweringService.getConversationHistory = jest.fn().mockResolvedValue({
        items: [
          {
            id: conversationId,
            documentId,
            questions: [
              { question: 'What are the terms?', answer: 'The terms are...', timestamp: new Date() },
            ],
            createdAt: new Date(),
          },
        ],
        total: 1,
        totalQuestions: 1,
        averageResponseTime: 1500,
        mostCommonTopics: ['payment', 'terms'],
      });

      const response = await request(app)
        .get(`/api/qa/conversations/${documentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          documentId,
          conversations: expect.any(Array),
          pagination: {
            limit: 20,
            offset: 0,
            total: expect.any(Number),
            hasMore: expect.any(Boolean),
          },
          summary: {
            totalConversations: expect.any(Number),
            totalQuestions: expect.any(Number),
            averageResponseTime: expect.any(Number),
            mostCommonTopics: expect.any(Array),
          },
        },
      });
    });

    it('should handle pagination parameters', async () => {
      const { questionAnsweringService } = require('../../services/questionAnswering');
      questionAnsweringService.getConversationHistory = jest.fn().mockResolvedValue({
        items: [],
        total: 0,
        totalQuestions: 0,
        averageResponseTime: 0,
        mostCommonTopics: [],
      });

      await request(app)
        .get(`/api/qa/conversations/${documentId}?limit=10&offset=5`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(questionAnsweringService.getConversationHistory).toHaveBeenCalledWith(
        documentId,
        testUser.id,
        expect.objectContaining({ limit: 10, offset: 5 })
      );
    });

    it('should require authentication', async () => {
      await request(app)
        .get(`/api/qa/conversations/${documentId}`)
        .expect(401);
    });
  });

  describe('GET /api/qa/conversation/:conversationId', () => {
    it('should retrieve a specific conversation', async () => {
      const { questionAnsweringService } = require('../../services/questionAnswering');
      questionAnsweringService.getConversation = jest.fn().mockResolvedValue({
        id: conversationId,
        documentId,
        userId: testUser.id,
        questions: [
          {
            id: 'q1',
            question: 'What are the payment terms?',
            answer: 'Payment is due within 30 days.',
            confidence: 0.92,
            timestamp: new Date(),
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await request(app)
        .get(`/api/qa/conversation/${conversationId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: conversationId,
          documentId,
          questions: expect.any(Array),
        },
      });
    });

    it('should return 404 for non-existent conversation', async () => {
      const { questionAnsweringService } = require('../../services/questionAnswering');
      questionAnsweringService.getConversation = jest.fn().mockResolvedValue(null);

      await request(app)
        .get(`/api/qa/conversation/${conversationId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should require authentication', async () => {
      await request(app)
        .get(`/api/qa/conversation/${conversationId}`)
        .expect(401);
    });
  });

  describe('POST /api/qa/bulk-ask', () => {
    const validBulkRequest = {
      documentId,
      questions: [
        'What are the payment terms?',
        'What is the termination clause?',
        'Are there any penalties?',
      ],
    };

    it('should process multiple questions', async () => {
      const { questionAnsweringService } = require('../../services/questionAnswering');
      questionAnsweringService.askMultipleQuestions = jest.fn().mockResolvedValue({
        conversationId: 'bulk-conv-123',
        answers: [
          { question: 'What are the payment terms?', answer: 'Payment due in 30 days', confidence: 0.92 },
          { question: 'What is the termination clause?', answer: 'Either party may terminate...', confidence: 0.88 },
          { question: 'Are there any penalties?', answer: 'Late payment penalty is 1.5%', confidence: 0.85 },
        ],
        successCount: 3,
        failureCount: 0,
        averageConfidence: 0.88,
        totalProcessingTime: 4500,
      });

      const response = await request(app)
        .post('/api/qa/bulk-ask')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validBulkRequest)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Bulk questions processed successfully',
        data: {
          documentId,
          conversationId: expect.any(String),
          questions: 3,
          responses: expect.any(Array),
          summary: {
            totalQuestions: 3,
            successfulAnswers: 3,
            failedAnswers: 0,
            averageConfidence: expect.any(Number),
          },
        },
      });
    });

    it('should reject too many questions', async () => {
      const tooManyQuestions = Array(15).fill('What is this?');
      
      await request(app)
        .post('/api/qa/bulk-ask')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          documentId,
          questions: tooManyQuestions,
        })
        .expect(400);
    });

    it('should require authentication', async () => {
      await request(app)
        .post('/api/qa/bulk-ask')
        .send(validBulkRequest)
        .expect(401);
    });
  });

  describe('GET /api/qa/:documentId/suggested-questions', () => {
    it('should generate suggested questions', async () => {
      const { questionAnsweringService } = require('../../services/questionAnswering');
      questionAnsweringService.generateSuggestedQuestions = jest.fn().mockResolvedValue({
        questions: [
          { question: 'What are the payment terms?', category: 'financial', priority: 'high' },
          { question: 'How can this contract be terminated?', category: 'legal', priority: 'medium' },
          { question: 'What are my obligations?', category: 'obligations', priority: 'high' },
        ],
        categories: ['financial', 'legal', 'obligations'],
      });

      const response = await request(app)
        .get(`/api/qa/${documentId}/suggested-questions`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          documentId,
          questions: expect.any(Array),
          categories: expect.any(Array),
          totalSuggestions: expect.any(Number),
          generatedAt: expect.any(String),
        },
      });
    });

    it('should handle category filtering', async () => {
      const { questionAnsweringService } = require('../../services/questionAnswering');
      questionAnsweringService.generateSuggestedQuestions = jest.fn().mockResolvedValue({
        questions: [
          { question: 'What are the payment terms?', category: 'financial', priority: 'high' },
        ],
        categories: ['financial'],
      });

      await request(app)
        .get(`/api/qa/${documentId}/suggested-questions?category=financial&limit=5`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(questionAnsweringService.generateSuggestedQuestions).toHaveBeenCalledWith(
        documentId,
        testUser.id,
        expect.objectContaining({ category: 'financial', limit: 5 })
      );
    });

    it('should require authentication', async () => {
      await request(app)
        .get(`/api/qa/${documentId}/suggested-questions`)
        .expect(401);
    });
  });

  describe('POST /api/qa/conversation/:conversationId/feedback', () => {
    const validFeedback = {
      questionId: 'q123',
      rating: 4,
      feedback: 'Very helpful answer',
      helpful: true,
    };

    it('should submit feedback successfully', async () => {
      const { questionAnsweringService } = require('../../services/questionAnswering');
      questionAnsweringService.submitFeedback = jest.fn().mockResolvedValue(true);

      const response = await request(app)
        .post(`/api/qa/conversation/${conversationId}/feedback`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(validFeedback)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Feedback submitted successfully',
        data: {
          conversationId,
          questionId: validFeedback.questionId,
          submittedAt: expect.any(String),
        },
      });
    });

    it('should validate rating range', async () => {
      await request(app)
        .post(`/api/qa/conversation/${conversationId}/feedback`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          ...validFeedback,
          rating: 6, // Invalid rating
        })
        .expect(400);
    });

    it('should require authentication', async () => {
      await request(app)
        .post(`/api/qa/conversation/${conversationId}/feedback`)
        .send(validFeedback)
        .expect(401);
    });
  });

  describe('DELETE /api/qa/conversation/:conversationId', () => {
    it('should delete conversation successfully', async () => {
      const { questionAnsweringService } = require('../../services/questionAnswering');
      questionAnsweringService.deleteConversation = jest.fn().mockResolvedValue(true);

      const response = await request(app)
        .delete(`/api/qa/conversation/${conversationId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Conversation deleted successfully',
        data: {
          conversationId,
          deletedAt: expect.any(String),
        },
      });
    });

    it('should require authentication', async () => {
      await request(app)
        .delete(`/api/qa/conversation/${conversationId}`)
        .expect(401);
    });
  });

  describe('POST /api/qa/embeddings/:documentId', () => {
    it('should generate embeddings successfully', async () => {
      // Mock firestore service
      const { firestoreService } = require('../../services/firestore');
      firestoreService.getDocument = jest.fn().mockResolvedValue({
        id: documentId,
        userId: testUser.id,
        content: 'Document content...',
      });

      const { questionAnsweringService } = require('../../services/questionAnswering');
      questionAnsweringService.generateDocumentEmbeddings = jest.fn().mockResolvedValue({
        embeddingCount: 150,
        chunkCount: 25,
        processingTime: 3000,
      });

      const response = await request(app)
        .post(`/api/qa/embeddings/${documentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Embeddings generated successfully',
        data: {
          documentId,
          embeddingCount: expect.any(Number),
          chunkCount: expect.any(Number),
          processingTime: expect.any(Number),
          generatedAt: expect.any(String),
        },
      });
    });

    it('should return 404 for non-existent document', async () => {
      const { firestoreService } = require('../../services/firestore');
      firestoreService.getDocument = jest.fn().mockResolvedValue(null);

      await request(app)
        .post(`/api/qa/embeddings/${documentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should deny access to documents not owned by user', async () => {
      const { firestoreService } = require('../../services/firestore');
      firestoreService.getDocument = jest.fn().mockResolvedValue({
        id: documentId,
        userId: 'other-user-id',
        content: 'Document content...',
      });

      await request(app)
        .post(`/api/qa/embeddings/${documentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);
    });

    it('should require authentication', async () => {
      await request(app)
        .post(`/api/qa/embeddings/${documentId}`)
        .expect(401);
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      const { questionAnsweringService } = require('../../services/questionAnswering');
      questionAnsweringService.askQuestion = jest.fn().mockRejectedValue(new Error('AI service unavailable'));

      await request(app)
        .post('/api/qa/ask')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          documentId,
          question: 'What are the terms?',
        })
        .expect(500);
    });

    it('should validate UUID formats', async () => {
      await request(app)
        .post('/api/qa/ask')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          documentId: 'invalid-uuid',
          question: 'What are the terms?',
        })
        .expect(400);
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting to Q&A endpoints', async () => {
      const { questionAnsweringService } = require('../../services/questionAnswering');
      questionAnsweringService.askQuestion = jest.fn().mockResolvedValue({
        questionId: 'q123',
        conversationId: 'c123',
        answer: 'Test answer',
        confidence: 0.9,
        sources: [],
        relatedClauses: [],
        suggestedFollowUps: [],
        responseTime: 1000,
      });

      const response = await request(app)
        .post('/api/qa/ask')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          documentId,
          question: 'What are the terms?',
        })
        .expect(200);

      // Check that rate limit headers are present
      expect(response.headers).toHaveProperty('x-ratelimit-limit');
      expect(response.headers).toHaveProperty('x-ratelimit-remaining');
    });
  });
});