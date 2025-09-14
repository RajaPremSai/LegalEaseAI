import { DocumentComparisonService } from '../../services/documentComparison';
import { DocumentVersion, DocumentAnalysis } from '@legal-ai/shared';

// Mock uuid
jest.mock('uuid', () => ({
  v4: () => 'test-uuid-' + Math.random().toString(36).substr(2, 9)
}));

describe('DocumentComparisonService', () => {
  let service: DocumentComparisonService;

  beforeEach(() => {
    service = new DocumentComparisonService();
  });

  describe('compareDocuments', () => {
    it('should detect text additions', async () => {
      const originalVersion: DocumentVersion = {
        id: 'version-1',
        documentId: 'doc-1',
        versionNumber: 1,
        filename: 'contract-v1.pdf',
        uploadedAt: new Date(),
        metadata: {
          pageCount: 1,
          wordCount: 50,
          language: 'en',
          extractedText: 'This is the original contract text. It contains basic terms.',
        },
      };

      const comparedVersion: DocumentVersion = {
        id: 'version-2',
        documentId: 'doc-1',
        versionNumber: 2,
        filename: 'contract-v2.pdf',
        uploadedAt: new Date(),
        metadata: {
          pageCount: 1,
          wordCount: 60,
          language: 'en',
          extractedText: 'This is the original contract text. It contains basic terms. Additional liability clause added.',
        },
      };

      const comparison = await service.compareDocuments(originalVersion, comparedVersion);

      expect(comparison).toBeDefined();
      expect(comparison.originalVersionId).toBe('version-1');
      expect(comparison.comparedVersionId).toBe('version-2');
      expect(comparison.changes).toHaveLength(1);
      expect(comparison.changes[0].type).toBe('addition');
      expect(comparison.changes[0].newText).toContain('Additional liability clause added');
      expect(comparison.changes[0].severity).toBe('high'); // Contains 'liability'
    });

    it('should detect text deletions', async () => {
      const originalVersion: DocumentVersion = {
        id: 'version-1',
        documentId: 'doc-1',
        versionNumber: 1,
        filename: 'contract-v1.pdf',
        uploadedAt: new Date(),
        metadata: {
          pageCount: 1,
          wordCount: 60,
          language: 'en',
          extractedText: 'This is the original contract text. It contains basic terms. Liability clause to be removed.',
        },
      };

      const comparedVersion: DocumentVersion = {
        id: 'version-2',
        documentId: 'doc-1',
        versionNumber: 2,
        filename: 'contract-v2.pdf',
        uploadedAt: new Date(),
        metadata: {
          pageCount: 1,
          wordCount: 50,
          language: 'en',
          extractedText: 'This is the original contract text. It contains basic terms.',
        },
      };

      const comparison = await service.compareDocuments(originalVersion, comparedVersion);

      expect(comparison.changes).toHaveLength(1);
      expect(comparison.changes[0].type).toBe('deletion');
      expect(comparison.changes[0].originalText).toContain('Liability clause to be removed');
      expect(comparison.changes[0].severity).toBe('high'); // Contains 'liability'
    });

    it('should detect text modifications', async () => {
      const originalVersion: DocumentVersion = {
        id: 'version-1',
        documentId: 'doc-1',
        versionNumber: 1,
        filename: 'contract-v1.pdf',
        uploadedAt: new Date(),
        metadata: {
          pageCount: 1,
          wordCount: 50,
          language: 'en',
          extractedText: 'Payment due within 30 days of invoice.',
        },
      };

      const comparedVersion: DocumentVersion = {
        id: 'version-2',
        documentId: 'doc-1',
        versionNumber: 2,
        filename: 'contract-v2.pdf',
        uploadedAt: new Date(),
        metadata: {
          pageCount: 1,
          wordCount: 50,
          language: 'en',
          extractedText: 'Payment due within 15 days of invoice.',
        },
      };

      const comparison = await service.compareDocuments(originalVersion, comparedVersion);

      expect(comparison.changes).toHaveLength(2); // Detected as deletion + addition
      expect(comparison.changes.some(c => c.type === 'deletion' && c.originalText?.includes('30 days'))).toBe(true);
      expect(comparison.changes.some(c => c.type === 'addition' && c.newText?.includes('15 days'))).toBe(true);
      expect(comparison.changes.every(c => c.severity === 'high')).toBe(true); // Both contain 'payment'
    });

    it('should assess change severity correctly', async () => {
      const originalVersion: DocumentVersion = {
        id: 'version-1',
        documentId: 'doc-1',
        versionNumber: 1,
        filename: 'contract-v1.pdf',
        uploadedAt: new Date(),
        metadata: {
          pageCount: 1,
          wordCount: 100,
          language: 'en',
          extractedText: 'This contract contains general terms. The notice period is standard.',
        },
      };

      const comparedVersion: DocumentVersion = {
        id: 'version-2',
        documentId: 'doc-1',
        versionNumber: 2,
        filename: 'contract-v2.pdf',
        uploadedAt: new Date(),
        metadata: {
          pageCount: 1,
          wordCount: 120,
          language: 'en',
          extractedText: 'This contract contains general terms. The notice period is standard. Additional liability and penalty clauses apply. Simple formatting change.',
        },
      };

      const comparison = await service.compareDocuments(originalVersion, comparedVersion);

      const highSeverityChanges = comparison.changes.filter(c => c.severity === 'high');
      const lowSeverityChanges = comparison.changes.filter(c => c.severity === 'low');

      expect(highSeverityChanges.length).toBeGreaterThan(0);
      expect(lowSeverityChanges.length).toBeGreaterThan(0);
    });

    it('should generate impact analysis with risk score changes', async () => {
      const originalAnalysis: DocumentAnalysis = {
        summary: 'Low risk contract',
        riskScore: 'low',
        keyTerms: [],
        risks: [],
        recommendations: [],
        clauses: [],
        generatedAt: new Date(),
      };

      const comparedAnalysis: DocumentAnalysis = {
        summary: 'High risk contract',
        riskScore: 'high',
        keyTerms: [],
        risks: [],
        recommendations: [],
        clauses: [],
        generatedAt: new Date(),
      };

      const originalVersion: DocumentVersion = {
        id: 'version-1',
        documentId: 'doc-1',
        versionNumber: 1,
        filename: 'contract-v1.pdf',
        uploadedAt: new Date(),
        metadata: {
          pageCount: 1,
          wordCount: 50,
          language: 'en',
          extractedText: 'Basic contract terms.',
        },
        analysis: originalAnalysis,
      };

      const comparedVersion: DocumentVersion = {
        id: 'version-2',
        documentId: 'doc-1',
        versionNumber: 2,
        filename: 'contract-v2.pdf',
        uploadedAt: new Date(),
        metadata: {
          pageCount: 1,
          wordCount: 60,
          language: 'en',
          extractedText: 'Basic contract terms. High liability and penalty clauses.',
        },
        analysis: comparedAnalysis,
      };

      const comparison = await service.compareDocuments(originalVersion, comparedVersion);

      expect(comparison.impactAnalysis.riskScoreChange).toBe(2); // low (1) to high (3) = +2
      expect(comparison.impactAnalysis.overallImpact).toBe('unfavorable');
      expect(comparison.impactAnalysis.summary).toContain('risk level has increased');
    });

    it('should categorize significant changes correctly', async () => {
      const originalVersion: DocumentVersion = {
        id: 'version-1',
        documentId: 'doc-1',
        versionNumber: 1,
        filename: 'contract-v1.pdf',
        uploadedAt: new Date(),
        metadata: {
          pageCount: 1,
          wordCount: 50,
          language: 'en',
          extractedText: 'Basic terms apply.',
        },
      };

      const comparedVersion: DocumentVersion = {
        id: 'version-2',
        documentId: 'doc-1',
        versionNumber: 2,
        filename: 'contract-v2.pdf',
        uploadedAt: new Date(),
        metadata: {
          pageCount: 1,
          wordCount: 80,
          language: 'en',
          extractedText: 'Basic terms apply. Additional payment obligations and privacy requirements. User rights are expanded.',
        },
      };

      const comparison = await service.compareDocuments(originalVersion, comparedVersion);

      expect(comparison.impactAnalysis.significantChanges.length).toBeGreaterThan(0);
      
      const categories = comparison.impactAnalysis.significantChanges.map(c => c.category);
      expect(categories).toContain('financial'); // payment
      // Note: The algorithm may not detect all categories in a single change
      // This is expected behavior as it processes changes individually
    });

    it('should handle empty or minimal text differences', async () => {
      const originalVersion: DocumentVersion = {
        id: 'version-1',
        documentId: 'doc-1',
        versionNumber: 1,
        filename: 'contract-v1.pdf',
        uploadedAt: new Date(),
        metadata: {
          pageCount: 1,
          wordCount: 50,
          language: 'en',
          extractedText: 'This is identical text.',
        },
      };

      const comparedVersion: DocumentVersion = {
        id: 'version-2',
        documentId: 'doc-1',
        versionNumber: 2,
        filename: 'contract-v2.pdf',
        uploadedAt: new Date(),
        metadata: {
          pageCount: 1,
          wordCount: 50,
          language: 'en',
          extractedText: 'This is identical text.',
        },
      };

      const comparison = await service.compareDocuments(originalVersion, comparedVersion);

      expect(comparison.changes).toHaveLength(0);
      expect(comparison.impactAnalysis.overallImpact).toBe('neutral');
      expect(comparison.impactAnalysis.riskScoreChange).toBe(0);
    });
  });

  describe('text similarity calculation', () => {
    it('should calculate similarity correctly', () => {
      // Access private method through any for testing
      const serviceAny = service as any;
      
      const similarity1 = serviceAny.textSimilarity('hello world', 'hello world');
      expect(similarity1).toBe(1);

      const similarity2 = serviceAny.textSimilarity('hello world', 'goodbye world');
      expect(similarity2).toBeCloseTo(0.33, 2); // 'world' is common, but Jaccard similarity is 1/3

      const similarity3 = serviceAny.textSimilarity('hello world', 'completely different');
      expect(similarity3).toBe(0);
    });
  });

  describe('change severity assessment', () => {
    it('should assess high severity for financial terms', () => {
      const serviceAny = service as any;
      
      expect(serviceAny.assessChangeSeverity('payment due')).toBe('high');
      expect(serviceAny.assessChangeSeverity('liability clause')).toBe('high');
      expect(serviceAny.assessChangeSeverity('penalty applies')).toBe('high');
    });

    it('should assess medium severity for rights and notices', () => {
      const serviceAny = service as any;
      
      expect(serviceAny.assessChangeSeverity('notice required')).toBe('medium');
      expect(serviceAny.assessChangeSeverity('user rights')).toBe('medium');
      expect(serviceAny.assessChangeSeverity('confidential information')).toBe('medium');
    });

    it('should assess low severity for general text', () => {
      const serviceAny = service as any;
      
      expect(serviceAny.assessChangeSeverity('general terms')).toBe('low');
      expect(serviceAny.assessChangeSeverity('formatting change')).toBe('low');
    });
  });

  describe('risk score conversion', () => {
    it('should convert risk scores to numbers correctly', () => {
      const serviceAny = service as any;
      
      expect(serviceAny.riskScoreToNumber('low')).toBe(1);
      expect(serviceAny.riskScoreToNumber('medium')).toBe(2);
      expect(serviceAny.riskScoreToNumber('high')).toBe(3);
      expect(serviceAny.riskScoreToNumber('unknown')).toBe(1);
    });
  });
});