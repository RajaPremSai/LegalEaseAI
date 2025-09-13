import { AIAnalysisService } from '../../services/aiAnalysis';
import { PredictionServiceClient } from '@google-cloud/aiplatform';

// Mock the Google Cloud AI Platform client
jest.mock('@google-cloud/aiplatform');

describe('AIAnalysisService', () => {
  let aiService: AIAnalysisService;
  let mockClient: jest.Mocked<PredictionServiceClient>;

  beforeEach(() => {
    // Set up environment variables for testing
    process.env.GOOGLE_CLOUD_PROJECT_ID = 'test-project';
    process.env.GOOGLE_CLOUD_LOCATION = 'us-central1';

    // Create mock client
    mockClient = {
      predict: jest.fn()
    } as any;

    (PredictionServiceClient as jest.MockedClass<typeof PredictionServiceClient>).mockImplementation(() => mockClient);

    aiService = new AIAnalysisService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('analyzeDocument', () => {
    const sampleDocument = `
      RENTAL AGREEMENT
      
      This agreement is between John Doe (Tenant) and Jane Smith (Landlord).
      
      1. RENT: Tenant agrees to pay $1,200 per month.
      2. SECURITY DEPOSIT: Tenant must pay a $2,400 security deposit.
      3. TERMINATION: Either party may terminate with 30 days notice.
      4. PETS: No pets allowed without written permission.
    `;

    it('should analyze a document and return comprehensive analysis', async () => {
      // Mock AI responses
      const mockSummaryResponse = {
        predictions: [{
          content: 'This is a standard rental agreement between a tenant and landlord. The tenant agrees to pay $1,200 monthly rent plus a $2,400 security deposit. Either party can terminate with 30 days notice, and pets require written permission.'
        }]
      };

      const mockKeyTermsResponse = {
        predictions: [{
          content: `[
            {
              "term": "Security Deposit",
              "definition": "Money paid upfront to cover potential damages",
              "importance": "high"
            },
            {
              "term": "Termination Notice",
              "definition": "Required advance warning before ending the lease",
              "importance": "medium"
            }
          ]`
        }]
      };

      const mockRisksResponse = {
        predictions: [{
          content: `[
            {
              "category": "financial",
              "severity": "medium",
              "description": "High security deposit of 2x monthly rent",
              "affectedClause": "SECURITY DEPOSIT: Tenant must pay a $2,400 security deposit",
              "recommendation": "Ensure you understand conditions for deposit return"
            }
          ]`
        }]
      };

      const mockClausesResponse = {
        predictions: [{
          content: `[
            {
              "title": "Monthly Rent Payment",
              "content": "RENT: Tenant agrees to pay $1,200 per month",
              "riskLevel": "low",
              "explanation": "Standard monthly rent obligation"
            },
            {
              "title": "Security Deposit Requirement",
              "content": "SECURITY DEPOSIT: Tenant must pay a $2,400 security deposit",
              "riskLevel": "medium",
              "explanation": "High deposit amount - ensure you understand return conditions"
            }
          ]`
        }]
      };

      // Set up mock responses in order
      mockClient.predict
        .mockResolvedValueOnce([mockSummaryResponse])
        .mockResolvedValueOnce([mockKeyTermsResponse])
        .mockResolvedValueOnce([mockRisksResponse])
        .mockResolvedValueOnce([mockClausesResponse]);

      const result = await aiService.analyzeDocument(sampleDocument, 'lease', 'US');

      expect(result).toBeDefined();
      expect(result.summary).toContain('rental agreement');
      expect(result.keyTerms).toHaveLength(2);
      expect(result.keyTerms[0].term).toBe('Security Deposit');
      expect(result.risks).toHaveLength(1);
      expect(result.risks[0].category).toBe('financial');
      expect(result.clauses).toHaveLength(2);
      expect(result.riskScore).toBe('low'); // Only one medium risk, should be low
      expect(result.recommendations).toEqual(expect.arrayContaining([
        expect.stringContaining('Review all financial obligations')
      ]));
      expect(result.generatedAt).toBeInstanceOf(Date);
    });

    it('should handle AI service errors gracefully', async () => {
      mockClient.predict.mockRejectedValue(new Error('AI service unavailable'));

      await expect(aiService.analyzeDocument(sampleDocument, 'lease', 'US'))
        .rejects.toThrow('Failed to analyze document with AI');
    });

    it('should calculate risk score correctly based on risks', async () => {
      // Mock responses with high-risk items
      const mockResponses = [
        { predictions: [{ content: 'Test summary' }] },
        { predictions: [{ content: '[]' }] },
        { 
          predictions: [{ 
            content: `[
              {
                "category": "legal",
                "severity": "high",
                "description": "Binding arbitration clause",
                "affectedClause": "All disputes must go to arbitration",
                "recommendation": "Consider legal review"
              },
              {
                "category": "financial",
                "severity": "high",
                "description": "Unlimited liability clause",
                "affectedClause": "Tenant liable for all damages",
                "recommendation": "Negotiate liability limits"
              }
            ]`
          }]
        },
        { predictions: [{ content: '[]' }] }
      ];

      mockClient.predict
        .mockResolvedValueOnce([mockResponses[0]])
        .mockResolvedValueOnce([mockResponses[1]])
        .mockResolvedValueOnce([mockResponses[2]])
        .mockResolvedValueOnce([mockResponses[3]]);

      const result = await aiService.analyzeDocument(sampleDocument, 'lease', 'US');

      expect(result.riskScore).toBe('high');
      expect(result.recommendations).toEqual(expect.arrayContaining([
        expect.stringContaining('Consider consulting with a lawyer')
      ]));
    });

    it('should handle malformed AI responses', async () => {
      // Mock responses with invalid JSON
      const mockResponses = [
        { predictions: [{ content: 'Valid summary text' }] },
        { predictions: [{ content: 'Invalid JSON [' }] },
        { predictions: [{ content: 'Invalid JSON {' }] },
        { predictions: [{ content: 'Invalid JSON ]' }] }
      ];

      mockClient.predict
        .mockResolvedValueOnce([mockResponses[0]])
        .mockResolvedValueOnce([mockResponses[1]])
        .mockResolvedValueOnce([mockResponses[2]])
        .mockResolvedValueOnce([mockResponses[3]]);

      const result = await aiService.analyzeDocument(sampleDocument, 'lease', 'US');

      expect(result.summary).toBe('Valid summary text');
      expect(result.keyTerms).toHaveLength(0);
      expect(result.risks).toHaveLength(0);
      expect(result.clauses).toHaveLength(0);
      expect(result.riskScore).toBe('low');
    });

    it('should truncate long documents appropriately', async () => {
      const longDocument = 'A'.repeat(10000);
      
      mockClient.predict.mockResolvedValue([{
        predictions: [{ content: 'Test response' }]
      }]);

      await aiService.analyzeDocument(longDocument, 'contract', 'US');

      // Verify that predict was called with truncated text
      const calls = mockClient.predict.mock.calls;
      expect(calls.length).toBe(4); // summary, keyTerms, risks, clauses

      // Check that the document text in prompts was truncated
      calls.forEach(call => {
        const instances = call[0].instances;
        const prompt = instances[0].prompt;
        expect(prompt.length).toBeLessThan(10000);
      });
    });

    it('should generate appropriate recommendations for different risk types', async () => {
      const mockRisksResponse = {
        predictions: [{
          content: `[
            {
              "category": "privacy",
              "severity": "medium",
              "description": "Broad data collection",
              "affectedClause": "We collect all user data",
              "recommendation": "Review privacy policy"
            },
            {
              "category": "financial",
              "severity": "low",
              "description": "Standard fees apply",
              "affectedClause": "Monthly service fee",
              "recommendation": "Budget for fees"
            }
          ]`
        }]
      };

      mockClient.predict
        .mockResolvedValueOnce([{ predictions: [{ content: 'Summary' }] }])
        .mockResolvedValueOnce([{ predictions: [{ content: '[]' }] }])
        .mockResolvedValueOnce([mockRisksResponse])
        .mockResolvedValueOnce([{ predictions: [{ content: '[]' }] }]);

      const result = await aiService.analyzeDocument(sampleDocument, 'terms_of_service', 'US');

      expect(result.recommendations).toEqual(expect.arrayContaining([
        expect.stringContaining('Consider the privacy implications')
      ]));
      expect(result.recommendations).toEqual(expect.arrayContaining([
        expect.stringContaining('Review all financial obligations')
      ]));
    });
  });

  describe('error handling', () => {
    it('should handle missing environment variables', () => {
      delete process.env.GOOGLE_CLOUD_PROJECT_ID;
      
      expect(() => new AIAnalysisService()).toThrow();
    });

    it('should handle empty AI responses', async () => {
      mockClient.predict.mockResolvedValue([{ predictions: [] }]);

      const result = await aiService.analyzeDocument('test', 'contract', 'US');

      expect(result.summary).toBe('');
      expect(result.keyTerms).toHaveLength(0);
      expect(result.risks).toHaveLength(0);
      expect(result.clauses).toHaveLength(0);
    });

    it('should handle network timeouts', async () => {
      mockClient.predict.mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 100)
        )
      );

      await expect(aiService.analyzeDocument('test', 'contract', 'US'))
        .rejects.toThrow('Failed to analyze document with AI');
    });
  });
});