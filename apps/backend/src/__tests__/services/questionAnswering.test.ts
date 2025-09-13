import { QuestionAnsweringService } from '../../services/questionAnswering';
import { FirestoreService } from '../../services/firestore';
import { Document, Clause, DocumentAnalysis } from '@legal-ai/shared';

// Mock the Google Cloud services
jest.mock('@google-cloud/aiplatform');
jest.mock('../../services/firestore');
jest.mock('../../config/google-cloud', () => ({
  getGoogleCloudService: jest.fn().mockReturnValue({
    getFirestore: jest.fn().mockReturnValue({
      collection: jest.fn(),
      doc: jest.fn(),
      batch: jest.fn()
    })
  })
}));

describe('QuestionAnsweringService', () => {
  let qaService: QuestionAnsweringService;
  let mockFirestoreService: jest.Mocked<FirestoreService>;

  // Sample test data
  const sampleDocument: Document = {
    id: 'test-doc-1',
    userId: 'test-user-1',
    filename: 'test-lease.pdf',
    documentType: 'lease',
    jurisdiction: 'US-CA',
    uploadedAt: new Date(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    status: 'analyzed',
    metadata: {
      pageCount: 5,
      wordCount: 2500,
      language: 'en',
      extractedText: 'This is a lease agreement between landlord and tenant...'
    },
    analysis: {
      summary: 'This is a residential lease agreement for a one-year term.',
      riskScore: 'medium',
      keyTerms: [
        {
          term: 'Security Deposit',
          definition: 'Money held by landlord as protection against damages',
          importance: 'high',
          location: { startIndex: 100, endIndex: 116 }
        }
      ],
      risks: [
        {
          category: 'financial',
          severity: 'medium',
          description: 'High security deposit required',
          affectedClause: 'Security deposit clause',
          recommendation: 'Negotiate lower deposit amount'
        }
      ],
      recommendations: ['Review termination clauses carefully'],
      clauses: [
        {
          id: 'clause-1',
          title: 'Security Deposit',
          content: 'Tenant shall pay a security deposit of $2,000 upon signing this lease.',
          location: { startIndex: 100, endIndex: 200 },
          riskLevel: 'medium',
          explanation: 'This clause requires a significant upfront payment.'
        },
        {
          id: 'clause-2',
          title: 'Rent Payment',
          content: 'Monthly rent of $1,500 is due on the first of each month.',
          location: { startIndex: 300, endIndex: 400 },
          riskLevel: 'low',
          explanation: 'Standard rent payment terms.'
        }
      ],
      generatedAt: new Date()
    }
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create service instance
    qaService = new QuestionAnsweringService();
    
    // Get mocked firestore service
    mockFirestoreService = qaService['firestoreService'] as jest.Mocked<FirestoreService>;

    // Mock environment variables
    process.env.GOOGLE_CLOUD_PROJECT_ID = 'test-project';
    process.env.GOOGLE_CLOUD_LOCATION = 'us-central1';
  });

  describe('askQuestion', () => {
    it('should process a question and return an answer with sources', async () => {
      // Mock Firestore responses
      mockFirestoreService.getDocument.mockResolvedValue({
        id: sampleDocument.id,
        userId: sampleDocument.userId,
        filename: sampleDocument.filename,
        documentType: sampleDocument.documentType,
        jurisdiction: sampleDocument.jurisdiction,
        uploadedAt: sampleDocument.uploadedAt,
        expiresAt: sampleDocument.expiresAt,
        status: sampleDocument.status,
        metadata: {
          ...sampleDocument.metadata,
          fileSize: 1024,
          mimeType: 'application/pdf'
        },
        storageInfo: {
          bucketName: 'test-bucket',
          fileName: 'test-file.pdf'
        }
      });

      mockFirestoreService.getAnalysisByDocumentId.mockResolvedValue({
        id: 'analysis-1',
        documentId: sampleDocument.id,
        userId: sampleDocument.userId,
        summary: sampleDocument.analysis!.summary,
        riskScore: sampleDocument.analysis!.riskScore,
        keyTerms: sampleDocument.analysis!.keyTerms.map(term => ({
          ...term,
          location: { page: 1, section: 'main' }
        })),
        risks: sampleDocument.analysis!.risks,
        recommendations: sampleDocument.analysis!.recommendations,
        generatedAt: sampleDocument.analysis!.generatedAt
      });

      // Mock embeddings collection
      const mockDb = {
        collection: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({
          empty: false,
          docs: [
            {
              data: () => ({
                documentId: sampleDocument.id,
                clauseId: 'clause-1',
                text: sampleDocument.analysis!.clauses[0].content,
                embedding: new Array(768).fill(0.1), // Mock embedding vector
                metadata: {
                  clauseTitle: sampleDocument.analysis!.clauses[0].title,
                  riskLevel: sampleDocument.analysis!.clauses[0].riskLevel,
                  location: sampleDocument.analysis!.clauses[0].location
                }
              })
            }
          ]
        }),
        doc: jest.fn().mockReturnThis(),
        set: jest.fn(),
        update: jest.fn()
      };

      mockFirestoreService.db = mockDb as any;

      // Mock AI service responses
      const mockClient = {
        predict: jest.fn()
          .mockResolvedValueOnce([{
            predictions: [{ embeddings: { values: new Array(768).fill(0.1) } }]
          }])
          .mockResolvedValueOnce([{
            predictions: [{ 
              content: 'Based on the security deposit clause, you are required to pay $2,000 upfront. This is a standard requirement but you may be able to negotiate a lower amount.'
            }]
          }])
      };

      qaService['client'] = mockClient as any;

      // Test the question answering
      const result = await qaService.askQuestion(
        sampleDocument.id,
        sampleDocument.userId,
        'How much is the security deposit?'
      );

      expect(result).toBeDefined();
      expect(result.answer).toContain('$2,000');
      expect(result.sources).toHaveLength(1);
      expect(result.sources[0].clauseTitle).toBe('Security Deposit');
      expect(result.conversationId).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should handle questions when document is not found', async () => {
      mockFirestoreService.getDocument.mockResolvedValue(null);

      await expect(
        qaService.askQuestion('non-existent-doc', 'user-1', 'What is this about?')
      ).rejects.toThrow('Document not found');
    });

    it('should handle questions when analysis is not found', async () => {
      mockFirestoreService.getDocument.mockResolvedValue({
        id: 'doc-1',
        userId: 'user-1',
        filename: 'test.pdf',
        documentType: 'contract',
        jurisdiction: 'US',
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

      mockFirestoreService.getAnalysisByDocumentId.mockResolvedValue(null);

      await expect(
        qaService.askQuestion('doc-1', 'user-1', 'What is this about?')
      ).rejects.toThrow('Document analysis not found');
    });
  });

  describe('generateDocumentEmbeddings', () => {
    it('should generate embeddings for all document clauses', async () => {
      const mockClient = {
        predict: jest.fn().mockResolvedValue([{
          predictions: [{ embeddings: { values: new Array(768).fill(0.1) } }]
        }])
      };

      qaService['client'] = mockClient as any;

      const mockBatch = {
        set: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined)
      };

      mockFirestoreService.db = {
        batch: () => mockBatch,
        collection: jest.fn().mockReturnThis(),
        doc: jest.fn().mockReturnThis()
      } as any;

      await qaService.generateDocumentEmbeddings(sampleDocument);

      // Should call predict for each clause (content + title/explanation)
      expect(mockClient.predict).toHaveBeenCalledTimes(4); // 2 clauses × 2 embeddings each
      expect(mockBatch.commit).toHaveBeenCalled();
    });

    it('should handle documents without analysis', async () => {
      const documentWithoutAnalysis = { ...sampleDocument, analysis: undefined };

      await expect(
        qaService.generateDocumentEmbeddings(documentWithoutAnalysis)
      ).rejects.toThrow('Document analysis with clauses is required');
    });
  });

  describe('getConversationHistory', () => {
    it('should retrieve conversation history for a document', async () => {
      const mockConversations = [
        {
          id: 'conv-1',
          documentId: sampleDocument.id,
          userId: sampleDocument.userId,
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

      const mockSnapshot = {
        docs: mockConversations.map(conv => ({ data: () => conv }))
      };

      mockFirestoreService.db = {
        collection: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue(mockSnapshot)
      } as any;

      const result = await qaService.getConversationHistory(
        sampleDocument.id,
        sampleDocument.userId
      );

      expect(result).toHaveLength(1);
      expect(result[0].messages).toHaveLength(2);
      expect(result[0].messages[0].content).toBe('What is the rent amount?');
    });
  });

  describe('cleanupDocumentData', () => {
    it('should delete conversations and embeddings for a document', async () => {
      const mockBatch = {
        delete: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined)
      };

      const mockSnapshot = {
        docs: [
          { ref: 'conv-ref-1' },
          { ref: 'conv-ref-2' }
        ]
      };

      const mockEmbeddingsSnapshot = {
        docs: [
          { ref: 'emb-ref-1' },
          { ref: 'emb-ref-2' }
        ]
      };

      mockFirestoreService.db = {
        batch: () => mockBatch,
        collection: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        get: jest.fn()
          .mockResolvedValueOnce(mockSnapshot)
          .mockResolvedValueOnce(mockEmbeddingsSnapshot)
      } as any;

      await qaService.cleanupDocumentData(sampleDocument.id);

      expect(mockBatch.delete).toHaveBeenCalledTimes(4); // 2 conversations + 2 embeddings
      expect(mockBatch.commit).toHaveBeenCalled();
    });
  });

  describe('cosineSimilarity', () => {
    it('should calculate cosine similarity correctly', () => {
      const vector1 = [1, 0, 0];
      const vector2 = [0, 1, 0];
      const vector3 = [1, 0, 0];

      const similarity1 = qaService['cosineSimilarity'](vector1, vector2);
      const similarity2 = qaService['cosineSimilarity'](vector1, vector3);

      expect(similarity1).toBe(0); // Orthogonal vectors
      expect(similarity2).toBe(1); // Identical vectors
    });

    it('should handle vectors of different lengths', () => {
      const vector1 = [1, 0];
      const vector2 = [1, 0, 0];

      const similarity = qaService['cosineSimilarity'](vector1, vector2);
      expect(similarity).toBe(0);
    });

    it('should handle zero vectors', () => {
      const vector1 = [0, 0, 0];
      const vector2 = [1, 0, 0];

      const similarity = qaService['cosineSimilarity'](vector1, vector2);
      expect(similarity).toBe(0);
    });
  });
});