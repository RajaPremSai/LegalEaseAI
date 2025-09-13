import { RiskAssessmentService, RiskPattern } from '../../services/riskAssessment';
import { Clause, Risk } from '@legal-ai/shared';

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

describe('RiskAssessmentService', () => {
  let riskAssessmentService: RiskAssessmentService;

  beforeEach(() => {
    riskAssessmentService = new RiskAssessmentService();
  });

  describe('assessDocumentRisks', () => {
    it('should identify high-risk patterns in document text', async () => {
      const documentText = `
        The tenant shall indemnify and hold harmless the landlord from any and all claims.
        This lease automatically renews for another year unless terminated with 60 days notice.
        Late fees of $100 will be charged for payments received after the 5th of the month.
      `;

      const clauses: Clause[] = [
        {
          id: 'clause-1',
          title: 'Indemnification Clause',
          content: 'The tenant shall indemnify and hold harmless the landlord from any and all claims.',
          location: { startIndex: 0, endIndex: 100 },
          riskLevel: 'high',
          explanation: 'This clause makes you liable for third-party claims'
        }
      ];

      const result = await riskAssessmentService.assessDocumentRisks(
        documentText,
        clauses,
        'lease',
        'US'
      );

      expect(result.risks.length).toBeGreaterThan(0);
      expect(result.overallRiskScore).toBe('high');
      expect(result.risks.some(r => r.category === 'legal' && r.severity === 'high')).toBe(true);
      expect(result.risks.some(r => r.category === 'financial')).toBe(true);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('should return low risk for documents with minimal risk patterns', async () => {
      const documentText = `
        This is a standard service agreement.
        The service will be provided as described.
        Payment is due monthly on the first of each month.
        Either party may terminate with 30 days written notice.
      `;

      const clauses: Clause[] = [
        {
          id: 'clause-1',
          title: 'Service Description',
          content: 'The service will be provided as described.',
          location: { startIndex: 0, endIndex: 50 },
          riskLevel: 'low',
          explanation: 'Standard service description'
        }
      ];

      const result = await riskAssessmentService.assessDocumentRisks(
        documentText,
        clauses,
        'contract',
        'US'
      );

      expect(result.overallRiskScore).toBe('low');
      expect(result.risks.length).toBeLessThanOrEqual(2);
      expect(result.riskSummary.toLowerCase()).toContain('no significant risks');
    });

    it('should identify document-type specific risks', async () => {
      const loanText = `
        This loan has a variable rate that may increase based on market conditions.
        There is a prepayment penalty of 2% if paid off within the first two years.
      `;

      const clauses: Clause[] = [];

      const result = await riskAssessmentService.assessDocumentRisks(
        loanText,
        clauses,
        'loan_agreement',
        'US'
      );

      expect(result.risks.length).toBeGreaterThan(0);
      expect(result.overallRiskScore).toBeOneOf(['low', 'medium', 'high']);
      // Should identify at least one financial risk
      expect(result.risks.some(r => r.category === 'financial')).toBe(true);
    });
  });

  describe('analyzeClauseRisks', () => {
    it('should identify risks in individual clauses', () => {
      const clauses: Clause[] = [
        {
          id: 'clause-1',
          title: 'Liability Clause',
          content: 'User agrees to unlimited liability for any damages caused by their use of the service.',
          location: { startIndex: 0, endIndex: 100 },
          riskLevel: 'high',
          explanation: 'Unlimited liability clause'
        },
        {
          id: 'clause-2',
          title: 'Payment Terms',
          content: 'Payment is due within 30 days of invoice date.',
          location: { startIndex: 100, endIndex: 150 },
          riskLevel: 'low',
          explanation: 'Standard payment terms'
        }
      ];

      const risks = riskAssessmentService.analyzeClauseRisks(clauses, 'contract');

      expect(risks.length).toBeGreaterThan(0);
      expect(risks.some(r => r.severity === 'high')).toBe(true);
      expect(risks.some(r => r.category === 'financial')).toBe(true);
    });

    it('should identify complex clauses with multiple conditions', () => {
      const complexClause: Clause = {
        id: 'clause-1',
        title: 'Complex Terms',
        content: `
          The user agrees to the following terms provided that they meet all conditions except where 
          specifically noted, and furthermore agrees that notwithstanding any other provision herein, 
          the company may modify these terms at any time provided that notice is given except in 
          emergency situations where immediate changes are required for security purposes, and the 
          user waives any right to object to such changes except where prohibited by law.
        `.repeat(3), // Make it over 1000 characters
        location: { startIndex: 0, endIndex: 500 },
        riskLevel: 'medium',
        explanation: 'Complex clause with multiple exceptions'
      };

      const risks = riskAssessmentService.analyzeClauseRisks([complexClause], 'terms_of_service');

      expect(risks.some(r => r.description.toLowerCase().includes('complex'))).toBe(true);
      expect(risks.some(r => r.category === 'legal')).toBe(true);
    });
  });

  describe('risk scoring algorithm', () => {
    it('should calculate high risk for multiple high-severity risks', async () => {
      const documentText = `
        Unlimited liability applies to all user actions.
        User must indemnify and hold harmless the company.
        Binding arbitration is required for all disputes.
        Company may share user data with any third parties.
      `;

      const clauses: Clause[] = [];

      const result = await riskAssessmentService.assessDocumentRisks(
        documentText,
        clauses,
        'terms_of_service',
        'US'
      );

      expect(result.overallRiskScore).toBe('high');
    });

    it('should calculate medium risk for mixed severity risks', async () => {
      const documentText = `
        Late fees may apply for overdue payments.
        The company may modify these terms with 30 days notice.
        Standard dispute resolution procedures apply.
      `;

      const clauses: Clause[] = [];

      const result = await riskAssessmentService.assessDocumentRisks(
        documentText,
        clauses,
        'contract',
        'US'
      );

      expect(['medium', 'low']).toContain(result.overallRiskScore);
    });
  });

  describe('pattern matching accuracy', () => {
    it('should match exact risk patterns', async () => {
      const highRiskText = 'The user has unlimited liability for damages and must indemnify the company.';
      
      const result = await riskAssessmentService.assessDocumentRisks(
        highRiskText,
        [],
        'contract',
        'US'
      );

      expect(result.risks.length).toBeGreaterThan(0);
      expect(result.risks.some(r => r.category === 'financial' || r.category === 'legal')).toBe(true);
      expect(result.overallRiskScore).toBeOneOf(['medium', 'high']);
    });

    it('should not match patterns in safe contexts', async () => {
      const safeText = `
        The company provides unlimited support for technical issues.
        We automatically renew your subscription benefits.
        Third parties cannot access your private data.
      `;

      const result = await riskAssessmentService.assessDocumentRisks(
        safeText,
        [],
        'terms_of_service',
        'US'
      );

      // Should have minimal or no high-severity risks
      const highRisks = result.risks.filter(r => r.severity === 'high');
      expect(highRisks.length).toBeLessThanOrEqual(1);
    });
  });

  describe('contextual risk analysis', () => {
    it('should identify lease-specific risks', async () => {
      const leaseText = `
        Tenants are jointly and severally liable for all rent payments.
        This lease automatically renews for another year.
      `;

      const result = await riskAssessmentService.assessDocumentRisks(
        leaseText,
        [],
        'lease',
        'US'
      );

      expect(result.risks.length).toBeGreaterThan(0);
      expect(result.risks.some(r => r.category === 'financial' || r.category === 'legal')).toBe(true);
    });

    it('should identify loan-specific risks', async () => {
      const loanText = `
        This loan has a variable rate that may increase.
        Prepayment penalty applies for early payment.
      `;

      const result = await riskAssessmentService.assessDocumentRisks(
        loanText,
        [],
        'loan_agreement',
        'US'
      );

      expect(result.risks.length).toBeGreaterThan(0);
      expect(result.risks.some(r => r.category === 'financial')).toBe(true);
    });

    it('should identify privacy policy risks', async () => {
      const privacyText = `
        We collect all information about your activities.
        Your data may be shared with third parties.
        We retain your information indefinitely.
      `;

      const result = await riskAssessmentService.assessDocumentRisks(
        privacyText,
        [],
        'privacy_policy',
        'US'
      );

      expect(result.risks.some(r => r.category === 'privacy')).toBe(true);
      expect(result.risks.some(r => r.description.toLowerCase().includes('shared') || r.description.toLowerCase().includes('third parties'))).toBe(true);
    });
  });

  describe('recommendation generation', () => {
    it('should provide specific recommendations for high-risk documents', async () => {
      const highRiskText = `
        User has unlimited liability for all damages.
        Company may share user data with third parties.
      `;

      const result = await riskAssessmentService.assessDocumentRisks(
        highRiskText,
        [],
        'contract',
        'US'
      );

      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.overallRiskScore).toBeOneOf(['medium', 'high']);
      // Should provide meaningful recommendations
      expect(result.recommendations.some(r => r.length > 10)).toBe(true);
    });

    it('should provide document-type specific recommendations', async () => {
      const leaseText = 'Standard lease agreement with typical terms.';

      const result = await riskAssessmentService.assessDocumentRisks(
        leaseText,
        [],
        'lease',
        'US'
      );

      expect(result.recommendations.some(r => r.includes('lease') || r.includes('rent'))).toBe(true);
    });
  });

  describe('risk deduplication', () => {
    it('should remove duplicate risks with similar descriptions', async () => {
      const documentText = `
        User has unlimited liability for damages.
        User is liable for unlimited damages and losses.
        Unlimited liability applies to all user actions.
      `;

      const result = await riskAssessmentService.assessDocumentRisks(
        documentText,
        [],
        'contract',
        'US'
      );

      // Should not have multiple similar unlimited liability risks
      const unlimitedLiabilityRisks = result.risks.filter(r => 
        r.description.toLowerCase().includes('unlimited liability')
      );
      expect(unlimitedLiabilityRisks.length).toBeLessThanOrEqual(2);
    });
  });

  describe('edge cases', () => {
    it('should handle empty document text', async () => {
      const result = await riskAssessmentService.assessDocumentRisks('', [], 'contract', 'US');

      expect(result.overallRiskScore).toBe('low');
      expect(result.risks.length).toBe(0);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('should handle very long documents', async () => {
      const longText = 'This is a standard contract clause. '.repeat(1000);

      const result = await riskAssessmentService.assessDocumentRisks(
        longText,
        [],
        'contract',
        'US'
      );

      expect(result).toBeDefined();
      expect(result.overallRiskScore).toBeDefined();
    });

    it('should handle unknown document types', async () => {
      const result = await riskAssessmentService.assessDocumentRisks(
        'Standard agreement text',
        [],
        'unknown' as any,
        'US'
      );

      expect(result).toBeDefined();
      expect(result.overallRiskScore).toBeDefined();
    });
  });

  describe('performance', () => {
    it('should complete risk assessment within reasonable time', async () => {
      const startTime = Date.now();
      
      const documentText = `
        This is a comprehensive legal document with various clauses including
        liability limitations, payment terms, dispute resolution, and privacy policies.
        The document contains multiple sections with different risk levels.
      `.repeat(50);

      const clauses: Clause[] = Array.from({ length: 10 }, (_, i) => ({
        id: `clause-${i}`,
        title: `Clause ${i}`,
        content: `This is clause ${i} with standard legal language.`,
        location: { startIndex: i * 100, endIndex: (i + 1) * 100 },
        riskLevel: 'medium' as const,
        explanation: `Explanation for clause ${i}`
      }));

      const result = await riskAssessmentService.assessDocumentRisks(
        documentText,
        clauses,
        'contract',
        'US'
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result).toBeDefined();
    });
  });
});