import { DocumentAIService } from '../../services/documentAI';

// Mock Google Cloud services
jest.mock('@google-cloud/documentai', () => ({
  DocumentProcessorServiceClient: jest.fn().mockImplementation(() => ({
    processDocument: jest.fn(),
  })),
}));

jest.mock('@google-cloud/storage', () => ({
  Storage: jest.fn().mockImplementation(() => ({
    bucket: jest.fn().mockReturnValue({
      file: jest.fn().mockReturnValue({
        download: jest.fn(),
      }),
    }),
  })),
}));

// Mock environment config
jest.mock('../../config/environment', () => ({
  googleCloudConfig: {
    projectId: 'test-project',
    location: 'us-central1',
    processorId: 'test-processor-id',
    keyFilename: 'test-key.json',
  },
  storageConfig: {
    tempBucket: 'test-temp-bucket',
  },
}));

describe('DocumentAI Service - Basic Tests', () => {
  let documentAIService: DocumentAIService;

  beforeEach(() => {
    documentAIService = new DocumentAIService();
  });

  it('should create DocumentAI service instance', () => {
    expect(documentAIService).toBeDefined();
    expect(documentAIService).toBeInstanceOf(DocumentAIService);
  });

  describe('Text Preprocessing', () => {
    it('should clean up text with extra whitespace', () => {
      const mockExtractedText = {
        text: 'This   is    a   test   document   with   extra   spaces',
        pages: [{
          pageNumber: 1,
          text: 'This   is    a   test',
          dimensions: { width: 612, height: 792 },
          blocks: [{
            text: 'This   is    a   test',
            boundingBox: { x: 0, y: 0, width: 100, height: 20 },
            confidence: 0.9,
            type: 'paragraph' as const,
          }],
        }],
        entities: [],
        confidence: 0.9,
      };

      const result = documentAIService.preprocessText(mockExtractedText);

      expect(result.text).toBe('This is a test document with extra spaces');
      expect(result.pages[0].text).toBe('This is a test');
      expect(result.pages[0].blocks[0].text).toBe('This is a test');
    });

    it('should normalize paragraph breaks', () => {
      const mockExtractedText = {
        text: 'Paragraph 1\n\n\n\nParagraph 2\n\n\n\nParagraph 3',
        pages: [],
        entities: [],
        confidence: 0.9,
      };

      const result = documentAIService.preprocessText(mockExtractedText);

      expect(result.text).toBe('Paragraph 1\n\nParagraph 2\n\nParagraph 3');
    });
  });

  describe('Legal Metadata Extraction', () => {
    it('should detect lease agreement', () => {
      const mockExtractedText = {
        text: 'This lease agreement is between landlord John Smith and tenant Jane Doe.',
        pages: [],
        entities: [],
        confidence: 0.9,
      };

      const metadata = documentAIService.extractLegalMetadata(mockExtractedText);

      expect(metadata.documentType).toBe('lease');
      expect(metadata.parties).toContain('John Smith');
      expect(metadata.parties).toContain('Jane Doe');
    });

    it('should detect contract', () => {
      const mockExtractedText = {
        text: 'This contract agreement between Party A and Party B, whereas both parties agree.',
        pages: [],
        entities: [],
        confidence: 0.9,
      };

      const metadata = documentAIService.extractLegalMetadata(mockExtractedText);

      expect(metadata.documentType).toBe('contract');
      expect(metadata.parties).toContain('Party A');
      expect(metadata.parties).toContain('Party B');
    });

    it('should extract dates', () => {
      const mockExtractedText = {
        text: 'Effective from 01/15/2024 until December 31, 2024.',
        pages: [],
        entities: [],
        confidence: 0.9,
      };

      const metadata = documentAIService.extractLegalMetadata(mockExtractedText);

      expect(metadata.dates).toContain('01/15/2024');
      expect(metadata.dates).toContain('December 31, 2024');
    });

    it('should extract monetary amounts', () => {
      const mockExtractedText = {
        text: 'Monthly payment of $1,500.00 and deposit of 2000 dollars.',
        pages: [],
        entities: [],
        confidence: 0.9,
      };

      const metadata = documentAIService.extractLegalMetadata(mockExtractedText);

      expect(metadata.amounts).toContain('$1,500.00');
      expect(metadata.amounts).toContain('2000 dollars');
    });

    it('should detect jurisdiction', () => {
      const mockExtractedText = {
        text: 'Governed by the laws of California.',
        pages: [],
        entities: [],
        confidence: 0.9,
      };

      const metadata = documentAIService.extractLegalMetadata(mockExtractedText);

      expect(metadata.jurisdiction).toBe('US-CA');
    });

    it('should handle unknown document type', () => {
      const mockExtractedText = {
        text: 'This is just some random text without legal indicators.',
        pages: [],
        entities: [],
        confidence: 0.9,
      };

      const metadata = documentAIService.extractLegalMetadata(mockExtractedText);

      expect(metadata.documentType).toBe('other');
      expect(metadata.jurisdiction).toBe('unknown');
      expect(metadata.parties).toHaveLength(0);
      expect(metadata.dates).toHaveLength(0);
      expect(metadata.amounts).toHaveLength(0);
    });
  });
});