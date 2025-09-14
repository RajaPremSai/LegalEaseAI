/**
 * AI Accuracy Validation Test Suite
 * Tests AI analysis accuracy with diverse legal document samples
 */

import request from 'supertest';
import { app } from '../../index';
import { DocumentAnalysisService } from '../../services/documentAnalysis';
import { RiskAssessmentService } from '../../services/riskAssessment';
import { QuestionAnsweringService } from '../../services/questionAnswering';
import fs from 'fs';
import path from 'path';

describe('AI Accuracy Validation E2E Tests', () => {
  let analysisService: DocumentAnalysisService;
  let riskService: RiskAssessmentService;
  let qaService: QuestionAnsweringService;

  beforeAll(() => {
    analysisService = new DocumentAnalysisService();
    riskService = new RiskAssessmentService();
    qaService = new QuestionAnsweringService();
  });

  describe('Document Type Classification Accuracy', () => {
    const testDocuments = [
      {
        name: 'rental-agreement-standard.pdf',
        expectedType: 'lease',
        expectedJurisdiction: 'california',
        content: `RESIDENTIAL LEASE AGREEMENT
        This lease agreement is entered into between John Doe (Landlord) and Jane Smith (Tenant)
        for the property located at 123 Main St, Los Angeles, CA 90210.
        Monthly rent: $2,500 due on the 1st of each month.
        Security deposit: $5,000 required upon signing.
        Lease term: 12 months starting January 1, 2024.`
      },
      {
        name: 'loan-agreement-personal.pdf',
        expectedType: 'loan_agreement',
        expectedJurisdiction: 'new_york',
        content: `PERSONAL LOAN AGREEMENT
        Lender: ABC Bank, New York, NY
        Borrower: John Smith, SSN: XXX-XX-XXXX
        Principal Amount: $50,000
        Interest Rate: 8.5% APR
        Term: 60 months
        Monthly Payment: $1,023.26
        Default provisions apply if payment is more than 30 days late.`
      },
      {
        name: 'terms-of-service-saas.pdf',
        expectedType: 'terms_of_service',
        expectedJurisdiction: 'delaware',
        content: `TERMS OF SERVICE
        Welcome to TechCorp SaaS Platform
        By using our service, you agree to these terms.
        Service availability: 99.9% uptime guarantee
        Data retention: 30 days after account termination
        Limitation of liability: Maximum liability is monthly subscription fee
        Governing law: Delaware state law applies`
      },
      {
        name: 'privacy-policy-gdpr.pdf',
        expectedType: 'privacy_policy',
        expectedJurisdiction: 'european_union',
        content: `PRIVACY POLICY
        This policy complies with GDPR requirements.
        Data controller: EuroTech Ltd, Dublin, Ireland
        Personal data collected: email, name, usage analytics
        Legal basis: legitimate interest and consent
        Data retention: 2 years after last activity
        Your rights: access, rectification, erasure, portability
        Contact DPO: privacy@eurotech.eu`
      }
    ];

    testDocuments.forEach(doc => {
      test(`should correctly classify ${doc.name} as ${doc.expectedType}`, async () => {
        const analysis = await analysisService.analyzeDocument({
          id: `test-${Date.now()}`,
          content: doc.content,
          filename: doc.name
        });

        expect(analysis.documentType).toBe(doc.expectedType);
        expect(analysis.jurisdiction.toLowerCase()).toContain(doc.expectedJurisdiction.toLowerCase());
        expect(analysis.confidence).toBeGreaterThan(0.8);
      });
    });
  });

  describe('Risk Assessment Accuracy', () => {
    const riskTestCases = [
      {
        name: 'High-risk rental agreement',
        content: `LEASE AGREEMENT
        Monthly rent: $3,000 due on 1st, late fee $500 after 1 day
        Security deposit: $9,000 (3 months rent)
        Tenant responsible for ALL repairs including structural
        No pets allowed, violation results in immediate eviction
        Landlord may enter without notice for any reason
        No subletting under any circumstances
        Lease automatically renews unless 90 days notice given`,
        expectedRiskScore: 'high',
        expectedRisks: [
          'excessive_late_fees',
          'high_security_deposit',
          'unfair_repair_responsibility',
          'privacy_violations',
          'restrictive_subletting'
        ]
      },
      {
        name: 'Medium-risk loan agreement',
        content: `LOAN AGREEMENT
        Principal: $25,000 at 12% APR
        Collateral: Vehicle title required
        Default: 15 days late triggers acceleration
        Prepayment penalty: 2% of remaining balance
        Personal guarantee required from spouse
        Arbitration required for disputes`,
        expectedRiskScore: 'medium',
        expectedRisks: [
          'high_interest_rate',
          'collateral_requirement',
          'prepayment_penalty',
          'personal_guarantee'
        ]
      },
      {
        name: 'Low-risk standard contract',
        content: `SERVICE AGREEMENT
        Monthly fee: $100 for consulting services
        30-day notice for termination by either party
        Standard limitation of liability
        Confidentiality provisions
        Governing law: State of incorporation`,
        expectedRiskScore: 'low',
        expectedRisks: []
      }
    ];

    riskTestCases.forEach(testCase => {
      test(`should assess ${testCase.name} with ${testCase.expectedRiskScore} risk`, async () => {
        const riskAssessment = await riskService.assessRisks({
          content: testCase.content,
          documentType: 'contract'
        });

        expect(riskAssessment.overallRisk).toBe(testCase.expectedRiskScore);
        
        if (testCase.expectedRisks.length > 0) {
          testCase.expectedRisks.forEach(expectedRisk => {
            const foundRisk = riskAssessment.risks.find(r => 
              r.category.toLowerCase().includes(expectedRisk.toLowerCase()) ||
              r.description.toLowerCase().includes(expectedRisk.replace('_', ' '))
            );
            expect(foundRisk).toBeDefined();
          });
        }

        expect(riskAssessment.confidence).toBeGreaterThan(0.7);
      });
    });
  });

  describe('Question Answering Accuracy', () => {
    const qaTestCases = [
      {
        document: `RENTAL LEASE AGREEMENT
        Rent: $2,000/month due 1st of month
        Late fee: $50 after 5 days
        Security deposit: $4,000
        Pet policy: Cats allowed with $300 deposit
        Maintenance: Tenant responsible for minor repairs under $100
        Termination: 30 days written notice required`,
        questions: [
          {
            question: 'How much is the monthly rent?',
            expectedAnswer: '$2,000',
            expectedConfidence: 0.95
          },
          {
            question: 'Are pets allowed?',
            expectedAnswer: 'cats allowed',
            expectedConfidence: 0.9
          },
          {
            question: 'What happens if rent is late?',
            expectedAnswer: '$50 late fee after 5 days',
            expectedConfidence: 0.85
          },
          {
            question: 'Who pays for repairs?',
            expectedAnswer: 'tenant responsible for minor repairs under $100',
            expectedConfidence: 0.8
          }
        ]
      },
      {
        document: `LOAN AGREEMENT
        Principal: $50,000
        Interest rate: 7.5% APR
        Term: 5 years (60 payments)
        Monthly payment: $1,001.23
        Prepayment: Allowed without penalty after 12 months
        Default: Payment 30+ days late constitutes default`,
        questions: [
          {
            question: 'What is the interest rate?',
            expectedAnswer: '7.5% APR',
            expectedConfidence: 0.95
          },
          {
            question: 'Can I pay off the loan early?',
            expectedAnswer: 'allowed without penalty after 12 months',
            expectedConfidence: 0.85
          },
          {
            question: 'When am I in default?',
            expectedAnswer: 'payment 30+ days late',
            expectedConfidence: 0.9
          }
        ]
      }
    ];

    qaTestCases.forEach((testCase, docIndex) => {
      testCase.questions.forEach((qa, qIndex) => {
        test(`should answer "${qa.question}" accurately for document ${docIndex + 1}`, async () => {
          const response = await qaService.answerQuestion({
            documentContent: testCase.document,
            question: qa.question,
            conversationHistory: []
          });

          expect(response.confidence).toBeGreaterThan(qa.expectedConfidence);
          
          const answerLower = response.answer.toLowerCase();
          const expectedLower = qa.expectedAnswer.toLowerCase();
          
          expect(answerLower).toContain(expectedLower);
          expect(response.sources).toBeDefined();
          expect(response.sources.length).toBeGreaterThan(0);
        });
      });
    });
  });

  describe('Multi-language Analysis Accuracy', () => {
    const multiLanguageTests = [
      {
        language: 'spanish',
        content: `CONTRATO DE ARRENDAMIENTO
        Renta mensual: $1,500 pesos
        Depósito de garantía: $3,000 pesos
        Duración: 12 meses
        El inquilino es responsable de servicios públicos`,
        expectedTerms: ['renta mensual', 'depósito', 'inquilino'],
        expectedType: 'lease'
      },
      {
        language: 'french',
        content: `CONTRAT DE BAIL
        Loyer mensuel: 1200€
        Dépôt de garantie: 2400€
        Durée: 24 mois
        Le locataire doit maintenir les lieux en bon état`,
        expectedTerms: ['loyer', 'dépôt', 'locataire'],
        expectedType: 'lease'
      }
    ];

    multiLanguageTests.forEach(test => {
      test(`should analyze ${test.language} documents accurately`, async () => {
        const analysis = await analysisService.analyzeDocument({
          id: `test-${test.language}-${Date.now()}`,
          content: test.content,
          filename: `contract-${test.language}.pdf`
        });

        expect(analysis.documentType).toBe(test.expectedType);
        expect(analysis.language).toBe(test.language);
        
        test.expectedTerms.forEach(term => {
          const foundTerm = analysis.keyTerms.find(kt => 
            kt.term.toLowerCase().includes(term.toLowerCase())
          );
          expect(foundTerm).toBeDefined();
        });
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle corrupted or unreadable documents', async () => {
      const corruptedContent = 'ÿþÿþÿþ corrupted binary data ÿþÿþÿþ';
      
      const analysis = await analysisService.analyzeDocument({
        id: 'corrupted-test',
        content: corruptedContent,
        filename: 'corrupted.pdf'
      });

      expect(analysis.status).toBe('error');
      expect(analysis.error).toContain('unable to process');
    });

    test('should handle extremely long documents', async () => {
      const longContent = 'This is a very long document. '.repeat(10000);
      
      const analysis = await analysisService.analyzeDocument({
        id: 'long-test',
        content: longContent,
        filename: 'long-document.pdf'
      });

      expect(analysis.status).toBe('analyzed');
      expect(analysis.summary).toBeDefined();
      expect(analysis.processingTime).toBeLessThan(60000); // Should complete within 60 seconds
    });

    test('should handle documents with no legal content', async () => {
      const nonLegalContent = `
        RECIPE FOR CHOCOLATE CAKE
        Ingredients:
        - 2 cups flour
        - 1 cup sugar
        - 1/2 cup cocoa powder
        Instructions:
        1. Mix dry ingredients
        2. Add wet ingredients
        3. Bake at 350°F for 30 minutes
      `;

      const analysis = await analysisService.analyzeDocument({
        id: 'non-legal-test',
        content: nonLegalContent,
        filename: 'recipe.pdf'
      });

      expect(analysis.documentType).toBe('other');
      expect(analysis.riskScore).toBe('low');
      expect(analysis.keyTerms).toHaveLength(0);
    });
  });

  describe('Performance and Accuracy Benchmarks', () => {
    test('should maintain accuracy above 85% for document classification', async () => {
      const testSuite = [
        { content: 'LEASE AGREEMENT...', expectedType: 'lease' },
        { content: 'LOAN CONTRACT...', expectedType: 'loan_agreement' },
        { content: 'TERMS OF SERVICE...', expectedType: 'terms_of_service' },
        { content: 'PRIVACY POLICY...', expectedType: 'privacy_policy' },
        { content: 'EMPLOYMENT CONTRACT...', expectedType: 'contract' }
      ];

      let correctClassifications = 0;
      
      for (const test of testSuite) {
        const analysis = await analysisService.analyzeDocument({
          id: `benchmark-${Date.now()}`,
          content: test.content,
          filename: 'test.pdf'
        });

        if (analysis.documentType === test.expectedType) {
          correctClassifications++;
        }
      }

      const accuracy = correctClassifications / testSuite.length;
      expect(accuracy).toBeGreaterThan(0.85);
    });

    test('should process documents within performance thresholds', async () => {
      const testDocument = `
        STANDARD LEASE AGREEMENT
        This lease agreement contains standard terms and conditions
        for residential rental property. The document includes
        rent payment terms, security deposit requirements,
        maintenance responsibilities, and termination procedures.
      `.repeat(50); // Create a moderately sized document

      const startTime = Date.now();
      
      const analysis = await analysisService.analyzeDocument({
        id: 'performance-test',
        content: testDocument,
        filename: 'performance-test.pdf'
      });

      const processingTime = Date.now() - startTime;

      expect(processingTime).toBeLessThan(30000); // Should complete within 30 seconds
      expect(analysis.status).toBe('analyzed');
    });
  });
});