import { DocumentProcessorServiceClient } from '@google-cloud/documentai';
import { Storage } from '@google-cloud/storage';
import { googleCloudConfig, storageConfig } from '../config/environment';

export interface ExtractedText {
  text: string;
  pages: PageInfo[];
  entities: EntityInfo[];
  confidence: number;
}

export interface PageInfo {
  pageNumber: number;
  text: string;
  dimensions: {
    width: number;
    height: number;
  };
  blocks: TextBlock[];
}

export interface TextBlock {
  text: string;
  boundingBox: BoundingBox;
  confidence: number;
  type: 'paragraph' | 'line' | 'word' | 'header' | 'footer';
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EntityInfo {
  type: string;
  mentionText: string;
  confidence: number;
  boundingBox?: BoundingBox;
  pageNumber?: number;
}

export class DocumentAIService {
  private client: DocumentProcessorServiceClient;
  private storage: Storage;
  private processorName: string;

  constructor() {
    this.client = new DocumentProcessorServiceClient({
      projectId: googleCloudConfig.projectId,
      keyFilename: googleCloudConfig.keyFilename,
    });

    this.storage = new Storage({
      projectId: googleCloudConfig.projectId,
      keyFilename: googleCloudConfig.keyFilename,
    });

    // Construct processor resource name
    this.processorName = `projects/${googleCloudConfig.projectId}/locations/${googleCloudConfig.location}/processors/${googleCloudConfig.processorId}`;
  }

  /**
   * Process document using Google Document AI
   */
  async processDocument(filePath: string, mimeType: string): Promise<ExtractedText> {
    try {
      // Download file from Cloud Storage
      const bucket = this.storage.bucket(storageConfig.tempBucket);
      const file = bucket.file(filePath);
      const [fileBuffer] = await file.download();

      // Prepare request for Document AI
      const request = {
        name: this.processorName,
        rawDocument: {
          content: fileBuffer.toString('base64'),
          mimeType: mimeType,
        },
      };

      // Process document
      const [result] = await this.client.processDocument(request);
      
      if (!result.document) {
        throw new Error('No document returned from Document AI');
      }

      return this.parseDocumentAIResponse(result.document);
    } catch (error) {
      console.error('Document AI processing error:', error);
      
      // Fallback to OCR if Document AI fails
      if (this.shouldFallbackToOCR(error)) {
        console.log('Falling back to OCR processing...');
        return await this.fallbackOCRProcessing(filePath, mimeType);
      }
      
      throw new Error(`Document processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parse Document AI response into our format
   */
  private parseDocumentAIResponse(document: any): ExtractedText {
    const pages: PageInfo[] = [];
    const entities: EntityInfo[] = [];
    let fullText = '';

    // Process pages
    if (document.pages) {
      document.pages.forEach((page: any, pageIndex: number) => {
        const pageInfo: PageInfo = {
          pageNumber: pageIndex + 1,
          text: '',
          dimensions: {
            width: page.dimension?.width || 0,
            height: page.dimension?.height || 0,
          },
          blocks: [],
        };

        // Extract text blocks from page
        if (page.blocks) {
          page.blocks.forEach((block: any) => {
            const blockText = this.extractTextFromLayout(block.layout, document.text);
            pageInfo.text += blockText + '\n';
            
            pageInfo.blocks.push({
              text: blockText,
              boundingBox: this.extractBoundingBox(block.layout?.boundingPoly),
              confidence: block.layout?.confidence || 0,
              type: this.determineBlockType(block),
            });
          });
        }

        // Extract paragraphs if blocks are not available
        if (page.paragraphs && pageInfo.blocks.length === 0) {
          page.paragraphs.forEach((paragraph: any) => {
            const paragraphText = this.extractTextFromLayout(paragraph.layout, document.text);
            pageInfo.text += paragraphText + '\n';
            
            pageInfo.blocks.push({
              text: paragraphText,
              boundingBox: this.extractBoundingBox(paragraph.layout?.boundingPoly),
              confidence: paragraph.layout?.confidence || 0,
              type: 'paragraph',
            });
          });
        }

        pages.push(pageInfo);
        fullText += pageInfo.text;
      });
    }

    // Process entities
    if (document.entities) {
      document.entities.forEach((entity: any) => {
        entities.push({
          type: entity.type || 'unknown',
          mentionText: entity.mentionText || '',
          confidence: entity.confidence || 0,
          boundingBox: this.extractBoundingBox(entity.pageAnchor?.pageRefs?.[0]?.boundingPoly),
          pageNumber: entity.pageAnchor?.pageRefs?.[0]?.page ? 
            parseInt(entity.pageAnchor.pageRefs[0].page) + 1 : undefined,
        });
      });
    }

    // Calculate overall confidence
    const confidence = this.calculateOverallConfidence(pages);

    return {
      text: fullText.trim(),
      pages,
      entities,
      confidence,
    };
  }

  /**
   * Extract text from layout object
   */
  private extractTextFromLayout(layout: any, documentText: string): string {
    if (!layout?.textAnchor?.textSegments) {
      return '';
    }

    let text = '';
    layout.textAnchor.textSegments.forEach((segment: any) => {
      const startIndex = parseInt(segment.startIndex) || 0;
      const endIndex = parseInt(segment.endIndex) || documentText.length;
      text += documentText.substring(startIndex, endIndex);
    });

    return text;
  }

  /**
   * Extract bounding box from polygon
   */
  private extractBoundingBox(boundingPoly: any): BoundingBox {
    if (!boundingPoly?.vertices || boundingPoly.vertices.length === 0) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }

    const vertices = boundingPoly.vertices;
    const xs = vertices.map((v: any) => parseFloat(v.x) || 0);
    const ys = vertices.map((v: any) => parseFloat(v.y) || 0);

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  /**
   * Determine block type based on properties
   */
  private determineBlockType(block: any): TextBlock['type'] {
    // Simple heuristics to determine block type
    if (block.layout?.textAnchor?.textSegments) {
      const text = block.layout.textAnchor.textSegments[0]?.text || '';
      
      // Check if it looks like a header (short, uppercase, etc.)
      if (text.length < 100 && text === text.toUpperCase() && text.trim().length > 0) {
        return 'header';
      }
      
      // Check if it's at the bottom of the page (footer)
      if (block.layout?.boundingPoly?.vertices) {
        const boundingBox = this.extractBoundingBox(block.layout.boundingPoly);
        // Simple check: if it's in the bottom 10% of the page
        if (boundingBox.y > 0.9) {
          return 'footer';
        }
      }
    }

    return 'paragraph';
  }

  /**
   * Calculate overall confidence score
   */
  private calculateOverallConfidence(pages: PageInfo[]): number {
    if (pages.length === 0) return 0;

    let totalConfidence = 0;
    let totalBlocks = 0;

    pages.forEach(page => {
      page.blocks.forEach(block => {
        totalConfidence += block.confidence;
        totalBlocks++;
      });
    });

    return totalBlocks > 0 ? totalConfidence / totalBlocks : 0;
  }

  /**
   * Determine if we should fallback to OCR
   */
  private shouldFallbackToOCR(error: any): boolean {
    // Fallback conditions
    const fallbackConditions = [
      'INVALID_ARGUMENT',
      'RESOURCE_EXHAUSTED',
      'UNAVAILABLE',
      'processor not found',
      'quota exceeded',
    ];

    const errorMessage = error?.message?.toLowerCase() || '';
    return fallbackConditions.some(condition => 
      errorMessage.includes(condition.toLowerCase())
    );
  }

  /**
   * Fallback OCR processing using basic text extraction
   */
  private async fallbackOCRProcessing(filePath: string, mimeType: string): Promise<ExtractedText> {
    try {
      // For PDF files, we can use a simple text extraction
      if (mimeType === 'application/pdf') {
        return await this.extractPDFText(filePath);
      }

      // For text files, read directly
      if (mimeType === 'text/plain') {
        return await this.extractPlainText(filePath);
      }

      // For other formats, return basic structure
      return {
        text: 'Document content could not be extracted. Please try uploading a PDF or text file.',
        pages: [{
          pageNumber: 1,
          text: 'Content extraction failed',
          dimensions: { width: 0, height: 0 },
          blocks: [],
        }],
        entities: [],
        confidence: 0,
      };
    } catch (error) {
      console.error('Fallback OCR processing error:', error);
      throw new Error('Both Document AI and fallback OCR processing failed');
    }
  }

  /**
   * Extract text from PDF using basic methods
   */
  private async extractPDFText(filePath: string): Promise<ExtractedText> {
    // This is a simplified implementation
    // In a real scenario, you'd use a PDF parsing library like pdf-parse
    const bucket = this.storage.bucket(storageConfig.tempBucket);
    const file = bucket.file(filePath);
    const [fileBuffer] = await file.download();

    // Basic PDF text extraction (simplified)
    const text = 'PDF text extraction requires additional libraries. Please use Document AI for full functionality.';
    
    return {
      text,
      pages: [{
        pageNumber: 1,
        text,
        dimensions: { width: 612, height: 792 }, // Standard letter size
        blocks: [{
          text,
          boundingBox: { x: 0, y: 0, width: 612, height: 792 },
          confidence: 0.5,
          type: 'paragraph',
        }],
      }],
      entities: [],
      confidence: 0.5,
    };
  }

  /**
   * Extract text from plain text files
   */
  private async extractPlainText(filePath: string): Promise<ExtractedText> {
    const bucket = this.storage.bucket(storageConfig.tempBucket);
    const file = bucket.file(filePath);
    const [fileBuffer] = await file.download();
    
    const text = fileBuffer.toString('utf-8');
    const lines = text.split('\n');
    
    const blocks: TextBlock[] = lines.map((line, index) => ({
      text: line,
      boundingBox: { x: 0, y: index * 20, width: 500, height: 20 },
      confidence: 1.0,
      type: 'line' as const,
    }));

    return {
      text,
      pages: [{
        pageNumber: 1,
        text,
        dimensions: { width: 500, height: lines.length * 20 },
        blocks,
      }],
      entities: [],
      confidence: 1.0,
    };
  }

  /**
   * Preprocess extracted text for better analysis
   */
  preprocessText(extractedText: ExtractedText): ExtractedText {
    // Clean up the text
    let cleanedText = extractedText.text
      .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
      .replace(/\n\s*\n/g, '\n\n') // Normalize paragraph breaks
      .trim();

    // Remove common OCR artifacts
    cleanedText = cleanedText
      .replace(/[^\w\s\.\,\;\:\!\?\-\(\)\[\]\{\}\"\']/g, '') // Remove special characters
      .replace(/\b[A-Z]{1}\b/g, '') // Remove single uppercase letters (OCR artifacts)
      .replace(/\s+/g, ' '); // Final whitespace cleanup

    // Update pages with cleaned text
    const cleanedPages = extractedText.pages.map(page => ({
      ...page,
      text: this.cleanPageText(page.text),
      blocks: page.blocks.map(block => ({
        ...block,
        text: this.cleanBlockText(block.text),
      })),
    }));

    return {
      ...extractedText,
      text: cleanedText,
      pages: cleanedPages,
    };
  }

  /**
   * Clean page text
   */
  private cleanPageText(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n\n')
      .trim();
  }

  /**
   * Clean block text
   */
  private cleanBlockText(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Extract key information from legal documents
   */
  extractLegalMetadata(extractedText: ExtractedText): {
    documentType: string;
    parties: string[];
    dates: string[];
    amounts: string[];
    jurisdiction: string;
  } {
    const text = extractedText.text.toLowerCase();
    
    // Detect document type
    const documentType = this.detectDocumentType(text);
    
    // Extract parties (simplified)
    const parties = this.extractParties(text);
    
    // Extract dates
    const dates = this.extractDates(text);
    
    // Extract monetary amounts
    const amounts = this.extractAmounts(text);
    
    // Detect jurisdiction
    const jurisdiction = this.detectJurisdiction(text);

    return {
      documentType,
      parties,
      dates,
      amounts,
      jurisdiction,
    };
  }

  /**
   * Detect document type based on content
   */
  private detectDocumentType(text: string): string {
    const typePatterns = {
      'lease': ['lease agreement', 'rental agreement', 'tenancy', 'landlord', 'tenant'],
      'contract': ['contract', 'agreement', 'party', 'parties', 'whereas'],
      'terms_of_service': ['terms of service', 'terms and conditions', 'user agreement'],
      'privacy_policy': ['privacy policy', 'data collection', 'personal information'],
      'loan_agreement': ['loan agreement', 'promissory note', 'borrower', 'lender'],
    };

    for (const [type, patterns] of Object.entries(typePatterns)) {
      if (patterns.some(pattern => text.includes(pattern))) {
        return type;
      }
    }

    return 'other';
  }

  /**
   * Extract party names from document
   */
  private extractParties(text: string): string[] {
    const parties: string[] = [];
    
    // Look for common party indicators
    const partyPatterns = [
      /between\s+([^,\n]+)\s+and\s+([^,\n]+)/gi,
      /party\s+(?:of\s+the\s+)?(?:first|second)\s+part[:\s]+([^,\n]+)/gi,
      /landlord[:\s]+([^,\n]+)/gi,
      /tenant[:\s]+([^,\n]+)/gi,
      /borrower[:\s]+([^,\n]+)/gi,
      /lender[:\s]+([^,\n]+)/gi,
    ];

    partyPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        for (let i = 1; i < match.length; i++) {
          if (match[i]) {
            parties.push(match[i].trim());
          }
        }
      }
    });

    return [...new Set(parties)]; // Remove duplicates
  }

  /**
   * Extract dates from document
   */
  private extractDates(text: string): string[] {
    const datePatterns = [
      /\b\d{1,2}\/\d{1,2}\/\d{4}\b/g, // MM/DD/YYYY
      /\b\d{1,2}-\d{1,2}-\d{4}\b/g,   // MM-DD-YYYY
      /\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+\d{4}\b/gi,
    ];

    const dates: string[] = [];
    datePatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        dates.push(...matches);
      }
    });

    return [...new Set(dates)];
  }

  /**
   * Extract monetary amounts from document
   */
  private extractAmounts(text: string): string[] {
    const amountPatterns = [
      /\$[\d,]+\.?\d*/g,
      /\b\d+\s+dollars?\b/gi,
      /\b(?:usd|dollars?)\s*[\d,]+\.?\d*/gi,
    ];

    const amounts: string[] = [];
    amountPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        amounts.push(...matches);
      }
    });

    return [...new Set(amounts)];
  }

  /**
   * Detect jurisdiction from document content
   */
  private detectJurisdiction(text: string): string {
    const jurisdictionPatterns = {
      'US-CA': ['california', 'ca', 'state of california'],
      'US-NY': ['new york', 'ny', 'state of new york'],
      'US-TX': ['texas', 'tx', 'state of texas'],
      'US-FL': ['florida', 'fl', 'state of florida'],
      'US': ['united states', 'usa', 'u.s.', 'federal'],
      'UK': ['united kingdom', 'england', 'scotland', 'wales'],
      'CA': ['canada', 'canadian'],
    };

    for (const [jurisdiction, patterns] of Object.entries(jurisdictionPatterns)) {
      if (patterns.some(pattern => text.includes(pattern))) {
        return jurisdiction;
      }
    }

    return 'unknown';
  }
}

export const documentAIService = new DocumentAIService();