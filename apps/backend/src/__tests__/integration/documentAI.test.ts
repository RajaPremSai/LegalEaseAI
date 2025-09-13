import { DocumentAIService, ExtractedText } from '../../services/documentAI';
import { Storage } from '@google-cloud/storage';
import { DocumentProcessorServiceClient } from '@google-cloud/documentai';

// Mock Google Cloud services
jest.mock('@google-cloud/documentai');
jest.mock('@google-cloud/storage');

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

describe('DocumentAI Service Integration Tests', () => {
  let documentAIService: DocumentAIService;
  let mockClient: jest.Mocked<DocumentProcessorServiceClient>;
  let mockStorage: jest.Mocked<Storage>;
  let mockBucket: any;
  let mockFile: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Document AI client
    mockClient = {
      processDocument: jest.fn(),
    } as any;
    (DocumentProcessorServiceClient as jest.MockedClass<typeof DocumentProcessorServiceClient>)
      .mockImplementation(() => mockClient);

    // Mock Storage
    mockFile = {
      download: jest.fn(),
    };
    mockBucket = {
      file: jest.fn().mockReturnValue(mockFile),
    };
    mockStorage = {
      bucket: jest.fn().mockReturnValue(mockBucket),
    } as any;
    (Storage as jest.MockedClass<typeof Storage>).mockImplementation(() => mockStorage);

    documentAIService = new DocumentAIService();
  });

  describe('Document Processing', () => {
    it('should process PDF document successfully', async () => {
      const mockDocumentAIResponse = {
        document: {
          text: 'This is a sample legal document with important clauses.',
          pages: [{
            pageNumber: 1,
            dimension: { width: 612, height: 792 },
            blocks: [{
              layout: {
                textAnchor: {
                  textSegments: [{ startIndex: 0, endIndex: 50 }]
                },
                boundingPoly: {
                  vertices: [
                    { x: 100, y: 100 },
                    { x: 500, y: 100 },
                    { x: 500, y: 150 },
                    { x: 100, y: 150 }
                  ]
                },
                confidence: 0.95
              }
            }]
          }],
          entities: [{
            type: 'PERSON',
            mentionText: 'John Doe',
            confidence: 0.9,
            pageAnchor: {
              pageRefs: [{
                page: 0,
                boundingPoly: {
                  vertices: [
                    { x: 200, y: 200 },
                    { x: 300, y: 200 },
                    { x: 300, y: 220 },
                    { x: 200, y: 220 }
                  ]
                }
              }]
            }
          }]
        }
      };

      mockFile.download.mockResolvedValue([Buffer.from('PDF content')]);
      mockClient.processDocument.mockResolvedValue([mockDocumentAIResponse] as any);

      const result = await documentAIService.processDocument('test-file.pdf', 'application/pdf');

      expect(result).toBeDefined();
      expect(result.text).toBe('This is a sample legal document with important clauses.');
      expect(result.pages).toHaveLength(1);
      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].type).toBe('PERSON');
      expect(result.entities[0].mentionText).toBe('John Doe');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should handle Document AI processing errors with fallback', async () => {
      mockFile.download.mockResolvedValue([Buffer.from('PDF content')]);
      mockClient.processDocument.mockRejectedValue(new Error('RESOURCE_EXHAUSTED'));

      const result = await documentAIService.processDocument('test-file.pdf', 'application/pdf');

      expect(result).toBeDefined();
      expect(result.text).toContain('PDF text extraction requires additional libraries');
      expect(result.confidence).toBe(0.5);
    });

    it('should process plain text files directly', async () => {
      const textContent = 'This is a plain text legal document.\nWith multiple lines.\nAnd important clauses.';
      mockFile.download.mockResolvedValue([Buffer.from(textContent)]);
      mockClient.processDocument.mockRejectedValue(new Error('INVALID_ARGUMENT'));

      const result = await documentAIService.processDocument('test-file.txt', 'text/plain');

      expect(result).toBeDefined();
      expect(result.text).toBe(textContent);
      expect(result.pages).toHaveLength(1);
      expect(result.pages[0].blocks).toHaveLength(3); // Three lines
      expect(result.confidence).toBe(1.0);
    });

    it('should handle unsupported file types gracefully', async () => {
      mockFile.download.mockResolvedValue([Buffer.from('Unknown content')]);
      mockClient.processDocument.mockRejectedValue(new Error('INVALID_ARGUMENT'));

      const result = await documentAIService.processDocument('test-file.unknown', 'application/unknown');

      expect(result).toBeDefined();
      expect(result.text).toContain('Document content could not be extracted');
      expect(result.confidence).toBe(0);
    });
  });

  describe('Text Preprocessing', () => {
    it('should clean up extracted text', () => {
      const mockExtractedText: ExtractedText = {
        text: 'This   is    a   document\n\n\nwith   extra   spaces   and   special   chars   @#$%',
        pages: [{
          pageNumber: 1,
          text: 'This   is    a   document\n\n\nwith   extra   spaces',
          dimensions: { width: 612, height: 792 },
          blocks: [{
            text: 'This   is    a   document',
            boundingBox: { x: 0, y: 0, width: 100, height: 20 },
            confidence: 0.9,
            type: 'paragraph',
          }],
        }],
        entities: [],
        confidence: 0.9,
      };

      const result = documentAIService.preprocessText(mockExtractedText);

      expect(result.text).toBe('This is a document with extra spaces and special chars');
      expect(result.pages[0].text).toBe('This is a document\n\nwith extra spaces');
      expect(result.pages[0].blocks[0].text).toBe('This is a document');
    });
  });

  describe('Legal Metadata Extraction', () => {
    it('should detect lease agreement document type', () => {
      const mockExtractedText: ExtractedText = {
        text: 'This lease agreement is between the landlord John Smith and tenant Jane Doe for the property located at 123 Main St.',
        pages: [],
        entities: [],
        confidence: 0.9,
      };

      const metadata = documentAIService.extractLegalMetadata(mockExtractedText);

      expect(metadata.documentType).toBe('lease');
      expect(metadata.parties).toContain('John Smith');
      expect(metadata.parties).toContain('Jane Doe');
    });

    it('should detect contract document type', () => {
      const mockExtractedText: ExtractedText = {
        text: 'This contract agreement is between Party A and Party B, whereas both parties agree to the following terms.',
        pages: [],
        entities: [],
        confidence: 0.9,
      };

      const metadata = documentAIService.extractLegalMetadata(mockExtractedText);

      expect(metadata.documentType).toBe('contract');
      expect(metadata.parties).toContain('Party A');
      expect(metadata.parties).toContain('Party B');
    });

    it('should extract dates from document', () => {
      const mockExtractedText: ExtractedText = {
        text: 'This agreement is effective from 01/15/2024 and expires on December 31, 2024.',
        pages: [],
        entities: [],
        confidence: 0.9,
      };

      const metadata = documentAIService.extractLegalMetadata(mockExtractedText);

      expect(metadata.dates).toContain('01/15/2024');
      expect(metadata.dates).toContain('December 31, 2024');
    });

    it('should extract monetary amounts', () => {
      const mockExtractedText: ExtractedText = {
        text: 'The monthly rent is $1,500.00 and the security deposit is $3000 dollars.',
        pages: [],
        entities: [],
        confidence: 0.9,
      };

      const metadata = documentAIService.extractLegalMetadata(mockExtractedText);

      expect(metadata.amounts).toContain('$1,500.00');
      expect(metadata.amounts).toContain('3000 dollars');
    });

    it('should detect jurisdiction', () => {
      const mockExtractedText: ExtractedText = {
        text: 'This agreement is governed by the laws of the State of California.',
        pages: [],
        entities: [],
        confidence: 0.9,
      };

      const metadata = documentAIService.extractLegalMetadata(mockExtractedText);

      expect(metadata.jurisdiction).toBe('US-CA');
    });

    it('should handle unknown document types', () => {
      const mockExtractedText: ExtractedText = {
        text: 'This is some random document without specific legal indicators.',
        pages: [],
        entities: [],
        confidence: 0.9,
      };

      const metadata = documentAIService.extractLegalMetadata(mockExtractedText);

      expect(metadata.documentType).toBe('other');
      expect(metadata.jurisdiction).toBe('unknown');
    });
  });

  describe('Error Handling', () => {
    it('should handle storage download errors', async () => {
      mockFile.download.mockRejectedValue(new Error('File not found'));

      await expect(documentAIService.processDocument('nonexistent-file.pdf', 'application/pdf'))
        .rejects.toThrow('Document processing failed');
    });

    it('should handle Document AI service unavailable', async () => {
      mockFile.download.mockResolvedValue([Buffer.from('PDF content')]);
      mockClient.processDocument.mockRejectedValue(new Error('UNAVAILABLE'));

      // Should fallback to OCR
      const result = await documentAIService.processDocument('test-file.pdf', 'application/pdf');
      expect(result).toBeDefined();
      expect(result.confidence).toBe(0.5); // Fallback confidence
    });

    it('should handle both Document AI and fallback failures', async () => {
      mockFile.download.mockRejectedValue(new Error('Storage error'));
      mockClient.processDocument.mockRejectedValue(new Error('Document AI error'));

      await expect(documentAIService.processDocument('test-file.pdf', 'application/pdf'))
        .rejects.toThrow('Document processing failed');
    });
  });

  describe('Document AI Response Parsing', () => {
    it('should handle empty Document AI response', async () => {
      mockFile.download.mockResolvedValue([Buffer.from('PDF content')]);
      mockClient.processDocument.mockResolvedValue([{ document: null }] as any);

      await expect(documentAIService.processDocument('test-file.pdf', 'application/pdf'))
        .rejects.toThrow('No document returned from Document AI');
    });

    it('should handle Document AI response without pages', async () => {
      const mockResponse = {
        document: {
          text: 'Simple text without page structure',
          pages: null,
          entities: []
        }
      };

      mockFile.download.mockResolvedValue([Buffer.from('PDF content')]);
      mockClient.processDocument.mockResolvedValue([mockResponse] as any);

      const result = await documentAIService.processDocument('test-file.pdf', 'application/pdf');

      expect(result).toBeDefined();
      expect(result.text).toBe('Simple text without page structure');
      expect(result.pages).toHaveLength(0);
    });
  });
});