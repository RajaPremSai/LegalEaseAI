import { MetadataExtractorService } from '../../services/metadataExtractor';
import { ExtractedText } from '../../services/documentAI';

describe('MetadataExtractor Service', () => {
  let metadataExtractor: MetadataExtractorService;

  beforeEach(() => {
    metadataExtractor = new MetadataExtractorService();
  });

  describe('Document Classification', () => {
    it('should classify lease agreement correctly', () => {
      const mockExtractedText: ExtractedText = {
        text: 'This lease agreement is between landlord John Smith and tenant Jane Doe for the rental of premises located at 123 Main St. Monthly rent is $1,500.',
        pages: [],
        entities: [],
        confidence: 0.9,
      };

      const classification = metadataExtractor.classifyDocument(mockExtractedText);

      expect(classification.primaryType).toBe('lease');
      expect(classification.confidence).toBeGreaterThan(0);
      expect(classification.indicators).toContain('lease');
      expect(classification.indicators).toContain('landlord');
      expect(classification.indicators).toContain('tenant');
    });

    it('should classify contract correctly', () => {
      const mockExtractedText: ExtractedText = {
        text: 'This contract agreement is between Party A and Party B, whereas both parties agree to the terms and consideration outlined herein.',
        pages: [],
        entities: [],
        confidence: 0.9,
      };

      const classification = metadataExtractor.classifyDocument(mockExtractedText);

      expect(classification.primaryType).toBe('contract');
      expect(classification.confidence).toBeGreaterThan(0);
      expect(classification.indicators).toContain('contract');
      expect(classification.indicators).toContain('party');
    });

    it('should classify terms of service correctly', () => {
      const mockExtractedText: ExtractedText = {
        text: 'These Terms of Service govern your use of our service. By using this service, you agree to these terms and acceptable use policies.',
        pages: [],
        entities: [],
        confidence: 0.9,
      };

      const classification = metadataExtractor.classifyDocument(mockExtractedText);

      expect(classification.primaryType).toBe('terms_of_service');
      expect(classification.confidence).toBeGreaterThan(0);
    });

    it('should classify privacy policy correctly', () => {
      const mockExtractedText: ExtractedText = {
        text: 'This Privacy Policy explains how we collect, use, and protect your personal information and data collection practices.',
        pages: [],
        entities: [],
        confidence: 0.9,
      };

      const classification = metadataExtractor.classifyDocument(mockExtractedText);

      expect(classification.primaryType).toBe('privacy_policy');
      expect(classification.confidence).toBeGreaterThan(0);
    });

    it('should classify loan agreement correctly', () => {
      const mockExtractedText: ExtractedText = {
        text: 'This loan agreement is between the lender ABC Bank and borrower John Doe. The principal amount is $50,000 with an interest rate of 5%.',
        pages: [],
        entities: [],
        confidence: 0.9,
      };

      const classification = metadataExtractor.classifyDocument(mockExtractedText);

      expect(classification.primaryType).toBe('loan_agreement');
      expect(classification.confidence).toBeGreaterThan(0);
    });

    it('should default to other for unknown document types', () => {
      const mockExtractedText: ExtractedText = {
        text: 'This is just some random text that does not match any specific document type patterns.',
        pages: [],
        entities: [],
        confidence: 0.9,
      };

      const classification = metadataExtractor.classifyDocument(mockExtractedText);

      expect(classification.primaryType).toBe('other');
      expect(classification.confidence).toBe(0);
    });
  });

  describe('Jurisdiction Detection', () => {
    it('should detect California jurisdiction', () => {
      const mockExtractedText: ExtractedText = {
        text: 'This agreement is governed by the laws of the State of California.',
        pages: [],
        entities: [],
        confidence: 0.9,
      };

      const jurisdiction = metadataExtractor.detectJurisdiction(mockExtractedText);

      expect(jurisdiction.country).toBe('US');
      expect(jurisdiction.state).toBe('CA');
      expect(jurisdiction.confidence).toBeGreaterThan(0);
      expect(jurisdiction.indicators).toContain('state of california');
    });

    it('should detect New York jurisdiction', () => {
      const mockExtractedText: ExtractedText = {
        text: 'This contract shall be governed by New York law.',
        pages: [],
        entities: [],
        confidence: 0.9,
      };

      const jurisdiction = metadataExtractor.detectJurisdiction(mockExtractedText);

      expect(jurisdiction.country).toBe('US');
      expect(jurisdiction.state).toBe('NY');
    });

    it('should detect UK jurisdiction', () => {
      const mockExtractedText: ExtractedText = {
        text: 'This agreement is subject to the laws of England and Wales in the United Kingdom.',
        pages: [],
        entities: [],
        confidence: 0.9,
      };

      const jurisdiction = metadataExtractor.detectJurisdiction(mockExtractedText);

      expect(jurisdiction.country).toBe('UK');
    });

    it('should detect jurisdiction by legal terms', () => {
      const mockExtractedText: ExtractedText = {
        text: 'This matter shall be resolved in federal court under common law principles.',
        pages: [],
        entities: [],
        confidence: 0.9,
      };

      const jurisdiction = metadataExtractor.detectJurisdiction(mockExtractedText);

      expect(jurisdiction.country).toBe('US');
      expect(jurisdiction.indicators).toContain('common law');
    });

    it('should return unknown for unidentifiable jurisdiction', () => {
      const mockExtractedText: ExtractedText = {
        text: 'This is a document without any jurisdictional indicators.',
        pages: [],
        entities: [],
        confidence: 0.9,
      };

      const jurisdiction = metadataExtractor.detectJurisdiction(mockExtractedText);

      expect(jurisdiction.country).toBe('unknown');
      expect(jurisdiction.confidence).toBe(0);
    });
  });

  describe('Document Structure Extraction', () => {
    it('should extract document structure with headers and sections', () => {
      const mockExtractedText: ExtractedText = {
        text: 'RENTAL AGREEMENT\n\n1. PARTIES\nThis agreement is between...\n\n2. PROPERTY\nThe rental property is...',
        pages: [{
          pageNumber: 1,
          text: 'RENTAL AGREEMENT\n\n1. PARTIES\nThis agreement is between...\n\n2. PROPERTY\nThe rental property is...',
          dimensions: { width: 612, height: 792 },
          blocks: [
            {
              text: 'RENTAL AGREEMENT',
              boundingBox: { x: 100, y: 50, width: 200, height: 30 },
              confidence: 0.95,
              type: 'header',
            },
            {
              text: '1. PARTIES',
              boundingBox: { x: 50, y: 100, width: 100, height: 20 },
              confidence: 0.9,
              type: 'header',
            },
            {
              text: 'This agreement is between...',
              boundingBox: { x: 50, y: 130, width: 400, height: 60 },
              confidence: 0.85,
              type: 'paragraph',
            },
            {
              text: '2. PROPERTY',
              boundingBox: { x: 50, y: 200, width: 100, height: 20 },
              confidence: 0.9,
              type: 'header',
            },
            {
              text: 'The rental property is...',
              boundingBox: { x: 50, y: 230, width: 400, height: 60 },
              confidence: 0.85,
              type: 'paragraph',
            },
          ],
        }],
        entities: [],
        confidence: 0.9,
      };

      const structure = metadataExtractor.extractDocumentStructure(mockExtractedText);

      expect(structure.title).toBe('RENTAL AGREEMENT');
      expect(structure.headers).toHaveLength(3); // Title + 2 section headers
      expect(structure.sections).toHaveLength(2); // 2 main sections
      expect(structure.sections[0].title).toBe('1. PARTIES');
      expect(structure.sections[1].title).toBe('2. PROPERTY');
    });

    it('should extract clauses with risk assessment', () => {
      const mockExtractedText: ExtractedText = {
        text: 'The tenant shall pay unlimited liability for any damages. In case of breach, immediate termination will occur.',
        pages: [{
          pageNumber: 1,
          text: 'The tenant shall pay unlimited liability for any damages. In case of breach, immediate termination will occur.',
          dimensions: { width: 612, height: 792 },
          blocks: [{
            text: 'The tenant shall pay unlimited liability for any damages. In case of breach, immediate termination will occur.',
            boundingBox: { x: 50, y: 100, width: 400, height: 40 },
            confidence: 0.9,
            type: 'paragraph',
          }],
        }],
        entities: [],
        confidence: 0.9,
      };

      const structure = metadataExtractor.extractDocumentStructure(mockExtractedText);

      expect(structure.clauses.length).toBeGreaterThan(0);
      
      // Should detect high-risk clauses
      const highRiskClauses = structure.clauses.filter(clause => clause.riskLevel === 'high');
      expect(highRiskClauses.length).toBeGreaterThan(0);
    });

    it('should extract signature lines', () => {
      const mockExtractedText: ExtractedText = {
        text: 'Signature: _________________ Date: _________________',
        pages: [{
          pageNumber: 1,
          text: 'Signature: _________________ Date: _________________',
          dimensions: { width: 612, height: 792 },
          blocks: [{
            text: 'Signature: _________________ Date: _________________',
            boundingBox: { x: 50, y: 700, width: 400, height: 20 },
            confidence: 0.9,
            type: 'paragraph',
          }],
        }],
        entities: [],
        confidence: 0.9,
      };

      const structure = metadataExtractor.extractDocumentStructure(mockExtractedText);

      expect(structure.signatures.length).toBeGreaterThan(0);
      expect(structure.signatures.some(sig => sig.type === 'signature_line')).toBe(true);
      expect(structure.signatures.some(sig => sig.type === 'date_line')).toBe(true);
    });

    it('should extract tables', () => {
      const mockExtractedText: ExtractedText = {
        text: 'Item\tQuantity\tPrice\nWidget A\t5\t$10.00\nWidget B\t3\t$15.00',
        pages: [{
          pageNumber: 1,
          text: 'Item\tQuantity\tPrice\nWidget A\t5\t$10.00\nWidget B\t3\t$15.00',
          dimensions: { width: 612, height: 792 },
          blocks: [{
            text: 'Item\tQuantity\tPrice\nWidget A\t5\t$10.00\nWidget B\t3\t$15.00',
            boundingBox: { x: 50, y: 300, width: 400, height: 60 },
            confidence: 0.9,
            type: 'paragraph',
          }],
        }],
        entities: [],
        confidence: 0.9,
      };

      const structure = metadataExtractor.extractDocumentStructure(mockExtractedText);

      expect(structure.tables.length).toBeGreaterThan(0);
      expect(structure.tables[0].rows).toHaveLength(3); // Header + 2 data rows
      expect(structure.tables[0].rows[0]).toEqual(['Item', 'Quantity', 'Price']);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty document', () => {
      const mockExtractedText: ExtractedText = {
        text: '',
        pages: [],
        entities: [],
        confidence: 0,
      };

      const structure = metadataExtractor.extractDocumentStructure(mockExtractedText);
      const classification = metadataExtractor.classifyDocument(mockExtractedText);
      const jurisdiction = metadataExtractor.detectJurisdiction(mockExtractedText);

      expect(structure.title).toBe('Untitled Document');
      expect(structure.sections).toHaveLength(0);
      expect(classification.primaryType).toBe('other');
      expect(jurisdiction.country).toBe('unknown');
    });

    it('should handle document with no clear structure', () => {
      const mockExtractedText: ExtractedText = {
        text: 'This is just a paragraph of text without any clear structure or headers.',
        pages: [{
          pageNumber: 1,
          text: 'This is just a paragraph of text without any clear structure or headers.',
          dimensions: { width: 612, height: 792 },
          blocks: [{
            text: 'This is just a paragraph of text without any clear structure or headers.',
            boundingBox: { x: 50, y: 100, width: 400, height: 20 },
            confidence: 0.9,
            type: 'paragraph',
          }],
        }],
        entities: [],
        confidence: 0.9,
      };

      const structure = metadataExtractor.extractDocumentStructure(mockExtractedText);

      expect(structure.title).toBe('Untitled Document');
      expect(structure.headers).toHaveLength(0);
      expect(structure.sections).toHaveLength(0);
    });
  });
});