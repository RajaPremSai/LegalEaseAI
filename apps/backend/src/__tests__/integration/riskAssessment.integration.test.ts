import { AIAnalysisService } from '../../services/aiAnalysis';
import { RiskAssessmentService } from '../../services/riskAssessment';

// Custom Jest matcher
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeOneOf(expected: any[]): R;
    }
  }
}

expect.extend({
  toBeOneOf(received, expected) {
    const pass = expected.includes(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be one of ${expected.join(', ')}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be one of ${expected.join(', ')}`,
        pass: false,
      };
    }
  },
});

// Mock Google Cloud services for testing
jest.mock('@google-cloud/aiplatform', () => ({
  PredictionServiceClient: jest.fn().mockImplementation(() => ({
    predict: jest.fn().mockResolvedValue([{
      predictions: [{
        content: JSON.stringify([{
          category: 'financial',
          severity: 'high',
          description: 'AI-identified financial risk',
          affectedClause: 'Sample clause text',
          recommendation: 'AI recommendation'
        }])
      }]
    }])
  }))
}));

describe('Risk Assessment Integration Tests', () => {
  let aiAnalysisService: AIAnalysisService;
  let riskAssessmentService: RiskAssessmentService;

  beforeEach(() => {
    // Set required environment variables
    process.env.GOOGLE_CLOUD_PROJECT_ID = 'test-project';
    process.env.GOOGLE_CLOUD_LOCATION = 'us-central1';

    aiAnalysisService = new AIAnalysisService();
    riskAssessmentService = new RiskAssessmentService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('AI Analysis with Risk Assessment Integration', () => {
    it('should combine AI and pattern-based risk assessments', async () => {
      const documentText = `
        RENTAL AGREEMENT
        
        The tenant shall indemnify and hold harmless the landlord from any and all claims,
        damages, or losses arising from the tenant's use of the premises.
        
        This lease automatically renews for successive one-year terms unless either party
        provides written notice of termination at least 60 days prior to the end of the term.
        
        Late fees of $50 will be charged for rent payments received after the 5th day of the month.
        
        Tenants are jointly and severally liable for all obligations under this lease.
      `;

      const result = await aiAnalysisService.analyzeDocument(
        documentText,
        'lease',
        'US'
      );

      // Verify comprehensive analysis
      expect(result).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.keyTerms).toBeDefined();
      expect(result.risks).toBeDefined();
      expect(result.recommendations).toBeDefined();
      expect(result.clauses).toBeDefined();

      // Verify risk assessment integration
      expect(result.risks.length).toBeGreaterThan(0);
      expect(result.riskScore).toBeOneOf(['low', 'medium', 'high']);

      // Should identify pattern-based risks
      const patternRisks = result.risks.filter(r => 
        r.description.includes('indemnify') || 
        r.description.includes('automatic') ||
        r.description.includes('jointly and severally')
      );
      expect(patternRisks.length).toBeGreaterThan(0);

      // Should have meaningful recommendations
      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.recommendations.some(r => r.length > 10)).toBe(true);
    });

    it('should handle high-risk loan agreements appropriately', async () => {
      const loanText = `
        LOAN AGREEMENT
        
        This loan carries a variable interest rate that may increase based on the prime rate
        plus a margin of 3.5%. The rate may be adjusted quarterly.
        
        Borrower agrees to unlimited liability for all obligations under this agreement.
        
        A prepayment penalty of 3% applies to any payments made within the first 24 months.
        
        Cross-default provisions apply - default on any other obligation will constitute
        default under this agreement.
        
        Borrower must indemnify and hold harmless the lender from all third-party claims.
      `;

      const result = await aiAnalysisService.analyzeDocument(
        loanText,
        'loan_agreement',
        'US'
      );

      // Should identify as high risk due to multiple severe risk factors
      expect(result.riskScore).toBe('high');

      // Should identify specific loan risks
      const loanRisks = result.risks.filter(r => 
        r.description.toLowerCase().includes('variable') ||
        r.description.toLowerCase().includes('unlimited') ||
        r.description.toLowerCase().includes('prepayment') ||
        r.description.toLowerCase().includes('cross-default')
      );
      expect(loanRisks.length).toBeGreaterThan(0);

      // Should recommend legal consultation for high-risk document
      expect(result.recommendations.some(r => 
        r.toLowerCase().includes('lawyer') || r.toLowerCase().includes('legal')
      )).toBe(true);
    });

    it('should properly assess low-risk standard agreements', async () => {
      const standardText = `
        SERVICE AGREEMENT
        
        This agreement governs the provision of consulting services between the parties.
        
        Services will be provided as described in the attached statement of work.
        
        Payment is due within 30 days of invoice receipt.
        
        Either party may terminate this agreement with 30 days written notice.
        
        Standard confidentiality provisions apply to protect both parties' information.
        
        Disputes will be resolved through good faith negotiation first, then mediation if needed.
      `;

      const result = await aiAnalysisService.analyzeDocument(
        standardText,
        'contract',
        'US'
      );

      // Should be assessed as low to medium risk
      expect(['low', 'medium']).toContain(result.riskScore);

      // Should have fewer high-severity risks
      const highRisks = result.risks.filter(r => r.severity === 'high');
      expect(highRisks.length).toBeLessThanOrEqual(1);

      // Should still provide helpful recommendations
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('should handle privacy policies with data sharing concerns', async () => {
      const privacyText = `
        PRIVACY POLICY
        
        We collect personal information including your name, email, location data,
        browsing history, and device information.
        
        We may share your personal information with third parties including our partners,
        advertisers, and service providers for marketing purposes.
        
        We retain your information indefinitely unless you request deletion.
        
        By using our service, you consent to our data practices as described herein.
        
        We may update this policy at any time without prior notice.
      `;

      const result = await aiAnalysisService.analyzeDocument(
        privacyText,
        'privacy_policy',
        'US'
      );

      // Should identify privacy risks
      const privacyRisks = result.risks.filter(r => r.category === 'privacy');
      expect(privacyRisks.length).toBeGreaterThan(0);

      // Should identify data sharing risks
      expect(result.risks.some(r => 
        r.description.toLowerCase().includes('share') ||
        r.description.toLowerCase().includes('third parties')
      )).toBe(true);

      // Should provide privacy-specific recommendations
      expect(result.recommendations.some(r => 
        r.toLowerCase().includes('privacy') || r.toLowerCase().includes('data')
      )).toBe(true);
    });
  });

  describe('Risk Assessment Service Standalone Tests', () => {
    it('should accurately identify financial risks in complex clauses', async () => {
      const complexFinancialText = `
        In the event of default, borrower shall be liable for all costs and expenses,
        including but not limited to attorney fees, court costs, collection fees,
        and any other charges without limitation as to amount or type.
      `;

      const mockClauses = [{
        id: 'financial-clause',
        title: 'Default Provisions',
        content: complexFinancialText,
        location: { startIndex: 0, endIndex: complexFinancialText.length },
        riskLevel: 'high' as const,
        explanation: 'Default clause with unlimited liability'
      }];

      const result = await riskAssessmentService.assessDocumentRisks(
        complexFinancialText,
        mockClauses,
        'loan_agreement',
        'US'
      );

      expect(result.risks.some(r => 
        r.category === 'financial' && r.severity === 'high'
      )).toBe(true);

      expect(result.overallRiskScore).toBe('high');
    });

    it('should provide contextual recommendations based on document type', async () => {
      const testCases = [
        {
          documentType: 'lease',
          text: 'Standard lease terms apply',
          expectedRecommendation: /lease|rent|deposit/i
        },
        {
          documentType: 'loan_agreement',
          text: 'Standard loan terms apply',
          expectedRecommendation: /interest|payment|loan/i
        },
        {
          documentType: 'terms_of_service',
          text: 'Standard terms apply',
          expectedRecommendation: /rights|data|terms/i
        }
      ];

      for (const testCase of testCases) {
        const result = await riskAssessmentService.assessDocumentRisks(
          testCase.text,
          [],
          testCase.documentType as any,
          'US'
        );

        const hasContextualRecommendation = result.recommendations.some(r =>
          testCase.expectedRecommendation.test(r)
        );

        expect(hasContextualRecommendation).toBe(true);
      }
    });
  });

  describe('Performance and Reliability', () => {
    it('should handle large documents efficiently', async () => {
      const largeDocument = `
        COMPREHENSIVE LEGAL AGREEMENT
        
        This agreement contains multiple sections with various legal provisions.
      `.repeat(100) + `
        The parties agree to unlimited liability for all damages.
        Automatic renewal provisions apply unless terminated with notice.
        Binding arbitration is required for all disputes.
        Data may be shared with third parties for any purpose.
      `;

      const startTime = Date.now();
      
      const result = await aiAnalysisService.analyzeDocument(
        largeDocument,
        'contract',
        'US'
      );

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // Should complete within reasonable time (10 seconds for integration test)
      expect(processingTime).toBeLessThan(10000);

      // Should still identify risks accurately
      expect(result.risks.length).toBeGreaterThan(0);
      expect(result.riskScore).toBeOneOf(['low', 'medium', 'high']);
    });

    it('should gracefully handle malformed or unusual text', async () => {
      const malformedText = `
        @@@ LEGAL DOCUMENT @@@
        
        This is a document with unusual formatting!!!
        
        CLAUSE 1: Something about liability... maybe unlimited???
        
        CLAUSE 2: $$$ MONEY STUFF $$$
        
        [REDACTED] information has been removed.
        
        THE END.
      `;

      const result = await aiAnalysisService.analyzeDocument(
        malformedText,
        'contract',
        'US'
      );

      // Should not crash and should provide some analysis
      expect(result).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.riskScore).toBeOneOf(['low', 'medium', 'high']);
      expect(result.recommendations).toBeDefined();
    });
  });
});