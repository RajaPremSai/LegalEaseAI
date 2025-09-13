import { ExtractedText } from './documentAI';

export interface DocumentStructure {
  title: string;
  sections: DocumentSection[];
  headers: HeaderInfo[];
  clauses: ClauseInfo[];
  signatures: SignatureInfo[];
  tables: TableInfo[];
}

export interface DocumentSection {
  id: string;
  title: string;
  content: string;
  level: number; // 1 = main section, 2 = subsection, etc.
  startPage: number;
  endPage: number;
  clauses: ClauseInfo[];
}

export interface HeaderInfo {
  text: string;
  level: number;
  pageNumber: number;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface ClauseInfo {
  id: string;
  title: string;
  content: string;
  type: 'standard' | 'termination' | 'payment' | 'liability' | 'confidentiality' | 'other';
  riskLevel: 'low' | 'medium' | 'high';
  pageNumber: number;
  sectionId?: string;
}

export interface SignatureInfo {
  type: 'signature_line' | 'date_line' | 'witness_line';
  text: string;
  pageNumber: number;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface TableInfo {
  id: string;
  title?: string;
  rows: string[][];
  pageNumber: number;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface DocumentClassification {
  primaryType: string;
  subType?: string;
  confidence: number;
  indicators: string[];
}

export interface JurisdictionInfo {
  country: string;
  state?: string;
  city?: string;
  confidence: number;
  indicators: string[];
}

export class MetadataExtractorService {
  /**
   * Extract comprehensive document structure and metadata
   */
  extractDocumentStructure(extractedText: ExtractedText): DocumentStructure {
    const headers = this.extractHeaders(extractedText);
    const sections = this.extractSections(extractedText, headers);
    const clauses = this.extractClauses(extractedText, sections);
    const signatures = this.extractSignatures(extractedText);
    const tables = this.extractTables(extractedText);
    const title = this.extractDocumentTitle(extractedText, headers);

    return {
      title,
      sections,
      headers,
      clauses,
      signatures,
      tables,
    };
  }

  /**
   * Classify document type using ML patterns
   */
  classifyDocument(extractedText: ExtractedText): DocumentClassification {
    const text = extractedText.text.toLowerCase();
    const classifications = this.getDocumentClassifications();
    
    let bestMatch: DocumentClassification = {
      primaryType: 'other',
      confidence: 0,
      indicators: [],
    };

    for (const [type, patterns] of Object.entries(classifications)) {
      const matches = patterns.keywords.filter(keyword => text.includes(keyword.toLowerCase()));
      const structuralMatches = patterns.structural.filter(pattern => {
        const regex = new RegExp(pattern, 'gi');
        return regex.test(text);
      });

      const confidence = (matches.length * 0.6 + structuralMatches.length * 0.4) / 
                        (patterns.keywords.length * 0.6 + patterns.structural.length * 0.4);

      if (confidence > bestMatch.confidence) {
        bestMatch = {
          primaryType: type,
          subType: this.determineSubType(type, text),
          confidence,
          indicators: [...matches, ...structuralMatches],
        };
      }
    }

    return bestMatch;
  }

  /**
   * Detect jurisdiction with enhanced accuracy
   */
  detectJurisdiction(extractedText: ExtractedText): JurisdictionInfo {
    const text = extractedText.text.toLowerCase();
    const jurisdictions = this.getJurisdictionPatterns();
    
    let bestMatch: JurisdictionInfo = {
      country: 'unknown',
      confidence: 0,
      indicators: [],
    };

    for (const [jurisdiction, patterns] of Object.entries(jurisdictions)) {
      const matches = patterns.filter(pattern => text.includes(pattern.toLowerCase()));
      const confidence = matches.length / patterns.length;

      if (confidence > bestMatch.confidence) {
        const [country, state] = jurisdiction.split('-');
        bestMatch = {
          country,
          state: state || undefined,
          confidence,
          indicators: matches,
        };
      }
    }

    // Enhanced detection using legal terminology
    if (bestMatch.confidence < 0.3) {
      bestMatch = this.detectJurisdictionByLegalTerms(text);
    }

    return bestMatch;
  }

  /**
   * Extract document headers with hierarchy
   */
  private extractHeaders(extractedText: ExtractedText): HeaderInfo[] {
    const headers: HeaderInfo[] = [];

    extractedText.pages.forEach(page => {
      page.blocks.forEach(block => {
        if (this.isHeader(block)) {
          headers.push({
            text: block.text.trim(),
            level: this.determineHeaderLevel(block.text),
            pageNumber: page.pageNumber,
            boundingBox: block.boundingBox,
          });
        }
      });
    });

    return headers.sort((a, b) => a.pageNumber - b.pageNumber);
  }

  /**
   * Extract document sections based on headers
   */
  private extractSections(extractedText: ExtractedText, headers: HeaderInfo[]): DocumentSection[] {
    const sections: DocumentSection[] = [];
    let currentSection: Partial<DocumentSection> | null = null;

    extractedText.pages.forEach(page => {
      page.blocks.forEach(block => {
        const header = headers.find(h => 
          h.pageNumber === page.pageNumber && 
          h.text === block.text.trim()
        );

        if (header) {
          // Save previous section
          if (currentSection && currentSection.content) {
            sections.push({
              id: `section-${sections.length + 1}`,
              title: currentSection.title || '',
              content: currentSection.content.trim(),
              level: currentSection.level || 1,
              startPage: currentSection.startPage || 1,
              endPage: page.pageNumber - 1,
              clauses: [],
            });
          }

          // Start new section
          currentSection = {
            title: header.text,
            content: '',
            level: header.level,
            startPage: page.pageNumber,
          };
        } else if (currentSection) {
          // Add content to current section
          currentSection.content = (currentSection.content || '') + block.text + '\n';
        }
      });
    });

    // Add final section
    if (currentSection && currentSection.content) {
      sections.push({
        id: `section-${sections.length + 1}`,
        title: currentSection.title || '',
        content: currentSection.content.trim(),
        level: currentSection.level || 1,
        startPage: currentSection.startPage || 1,
        endPage: extractedText.pages.length,
        clauses: [],
      });
    }

    return sections;
  }

  /**
   * Extract clauses with risk assessment
   */
  private extractClauses(extractedText: ExtractedText, sections: DocumentSection[]): ClauseInfo[] {
    const clauses: ClauseInfo[] = [];
    const clausePatterns = this.getClausePatterns();

    sections.forEach(section => {
      const sectionText = section.content.toLowerCase();
      
      for (const [clauseType, patterns] of Object.entries(clausePatterns)) {
        patterns.forEach(pattern => {
          const regex = new RegExp(pattern, 'gi');
          let match;
          
          while ((match = regex.exec(section.content)) !== null) {
            const clauseText = this.extractClauseText(section.content, match.index);
            
            clauses.push({
              id: `clause-${clauses.length + 1}`,
              title: this.generateClauseTitle(clauseText, clauseType),
              content: clauseText,
              type: clauseType as ClauseInfo['type'],
              riskLevel: this.assessClauseRisk(clauseText, clauseType),
              pageNumber: section.startPage,
              sectionId: section.id,
            });
          }
        });
      }
    });

    return clauses;
  }

  /**
   * Extract signature lines and date fields
   */
  private extractSignatures(extractedText: ExtractedText): SignatureInfo[] {
    const signatures: SignatureInfo[] = [];
    const signaturePatterns = {
      signature_line: [
        /signature\s*:?\s*_+/gi,
        /signed\s*:?\s*_+/gi,
        /by\s*:?\s*_+/gi,
        /_+\s*\(signature\)/gi,
      ],
      date_line: [
        /date\s*:?\s*_+/gi,
        /_+\s*\(date\)/gi,
        /dated\s*:?\s*_+/gi,
      ],
      witness_line: [
        /witness\s*:?\s*_+/gi,
        /witnessed\s*by\s*:?\s*_+/gi,
      ],
    };

    extractedText.pages.forEach(page => {
      page.blocks.forEach(block => {
        for (const [type, patterns] of Object.entries(signaturePatterns)) {
          patterns.forEach(pattern => {
            if (pattern.test(block.text)) {
              signatures.push({
                type: type as SignatureInfo['type'],
                text: block.text.trim(),
                pageNumber: page.pageNumber,
                boundingBox: block.boundingBox,
              });
            }
          });
        }
      });
    });

    return signatures;
  }

  /**
   * Extract tables from document
   */
  private extractTables(extractedText: ExtractedText): TableInfo[] {
    const tables: TableInfo[] = [];
    
    // Simple table detection based on text patterns
    extractedText.pages.forEach(page => {
      const pageText = page.text;
      const lines = pageText.split('\n');
      
      let currentTable: string[][] = [];
      let tableStarted = false;
      
      lines.forEach(line => {
        const cells = this.detectTableRow(line);
        
        if (cells.length > 1) {
          if (!tableStarted) {
            tableStarted = true;
            currentTable = [];
          }
          currentTable.push(cells);
        } else if (tableStarted && currentTable.length > 1) {
          // End of table
          tables.push({
            id: `table-${tables.length + 1}`,
            rows: currentTable,
            pageNumber: page.pageNumber,
          });
          tableStarted = false;
          currentTable = [];
        }
      });
      
      // Add final table if exists
      if (tableStarted && currentTable.length > 1) {
        tables.push({
          id: `table-${tables.length + 1}`,
          rows: currentTable,
          pageNumber: page.pageNumber,
        });
      }
    });

    return tables;
  }

  /**
   * Extract document title
   */
  private extractDocumentTitle(extractedText: ExtractedText, headers: HeaderInfo[]): string {
    // Try to find title from first page headers
    const firstPageHeaders = headers.filter(h => h.pageNumber === 1);
    
    if (firstPageHeaders.length > 0) {
      // Return the first header as title
      return firstPageHeaders[0].text;
    }

    // Fallback: look for title patterns in first page
    const firstPage = extractedText.pages[0];
    if (firstPage) {
      const titlePatterns = [
        /^([A-Z\s]+(?:AGREEMENT|CONTRACT|LEASE|POLICY))/m,
        /^([A-Z\s]{10,50})/m, // All caps text (likely title)
      ];

      for (const pattern of titlePatterns) {
        const match = firstPage.text.match(pattern);
        if (match) {
          return match[1].trim();
        }
      }
    }

    return 'Untitled Document';
  }

  /**
   * Check if a text block is a header
   */
  private isHeader(block: any): boolean {
    const text = block.text.trim();
    
    // Header indicators
    const headerIndicators = [
      text.length < 100, // Short text
      text === text.toUpperCase(), // All uppercase
      /^\d+\./.test(text), // Starts with number
      /^[A-Z][A-Z\s]+$/.test(text), // All caps words
      block.confidence > 0.8, // High confidence
    ];

    return headerIndicators.filter(Boolean).length >= 2;
  }

  /**
   * Determine header level
   */
  private determineHeaderLevel(text: string): number {
    if (/^\d+\./.test(text)) return 1; // "1. Main Section"
    if (/^\d+\.\d+/.test(text)) return 2; // "1.1 Subsection"
    if (/^\d+\.\d+\.\d+/.test(text)) return 3; // "1.1.1 Sub-subsection"
    if (text === text.toUpperCase() && text.length < 50) return 1;
    return 2; // Default to level 2
  }

  /**
   * Get document classification patterns
   */
  private getDocumentClassifications(): Record<string, { keywords: string[], structural: string[] }> {
    return {
      lease: {
        keywords: ['lease', 'rental', 'tenant', 'landlord', 'premises', 'rent'],
        structural: ['monthly rent', 'security deposit', 'lease term'],
      },
      contract: {
        keywords: ['contract', 'agreement', 'party', 'whereas', 'consideration'],
        structural: ['party of the first part', 'party of the second part'],
      },
      terms_of_service: {
        keywords: ['terms of service', 'user agreement', 'acceptable use', 'service'],
        structural: ['by using this service', 'these terms'],
      },
      privacy_policy: {
        keywords: ['privacy policy', 'personal information', 'data collection', 'cookies'],
        structural: ['we collect', 'your information'],
      },
      loan_agreement: {
        keywords: ['loan', 'borrower', 'lender', 'principal', 'interest', 'promissory'],
        structural: ['loan amount', 'interest rate', 'payment schedule'],
      },
    };
  }

  /**
   * Get jurisdiction detection patterns
   */
  private getJurisdictionPatterns(): Record<string, string[]> {
    return {
      'US-CA': ['california', 'ca', 'state of california', 'california law'],
      'US-NY': ['new york', 'ny', 'state of new york', 'new york law'],
      'US-TX': ['texas', 'tx', 'state of texas', 'texas law'],
      'US-FL': ['florida', 'fl', 'state of florida', 'florida law'],
      'US': ['united states', 'usa', 'u.s.', 'federal law', 'american'],
      'UK': ['united kingdom', 'england', 'scotland', 'wales', 'british law'],
      'CA': ['canada', 'canadian', 'ontario', 'quebec', 'british columbia'],
    };
  }

  /**
   * Get clause detection patterns
   */
  private getClausePatterns(): Record<string, string[]> {
    return {
      termination: [
        'termination',
        'terminate this agreement',
        'end this contract',
        'breach of contract',
      ],
      payment: [
        'payment',
        'monthly rent',
        'due date',
        'late fee',
        'interest rate',
      ],
      liability: [
        'liability',
        'damages',
        'indemnify',
        'hold harmless',
        'limitation of liability',
      ],
      confidentiality: [
        'confidential',
        'non-disclosure',
        'proprietary information',
        'trade secrets',
      ],
    };
  }

  /**
   * Determine document subtype
   */
  private determineSubType(primaryType: string, text: string): string | undefined {
    const subTypePatterns: Record<string, Record<string, string[]>> = {
      lease: {
        residential: ['residential', 'apartment', 'house', 'dwelling'],
        commercial: ['commercial', 'office', 'retail', 'business'],
      },
      contract: {
        employment: ['employment', 'employee', 'job', 'work'],
        service: ['service agreement', 'consulting', 'professional services'],
      },
    };

    const patterns = subTypePatterns[primaryType];
    if (!patterns) return undefined;

    for (const [subType, keywords] of Object.entries(patterns)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        return subType;
      }
    }

    return undefined;
  }

  /**
   * Detect jurisdiction by legal terminology
   */
  private detectJurisdictionByLegalTerms(text: string): JurisdictionInfo {
    const legalTerms = {
      'US': ['common law', 'statute of limitations', 'federal court'],
      'UK': ['solicitor', 'barrister', 'crown court', 'high court'],
      'CA': ['crown', 'provincial court', 'supreme court of canada'],
    };

    for (const [country, terms] of Object.entries(legalTerms)) {
      const matches = terms.filter(term => text.includes(term));
      if (matches.length > 0) {
        return {
          country,
          confidence: matches.length / terms.length,
          indicators: matches,
        };
      }
    }

    return {
      country: 'unknown',
      confidence: 0,
      indicators: [],
    };
  }

  /**
   * Detect table row from text line
   */
  private detectTableRow(line: string): string[] {
    // Simple table detection based on separators
    const separators = ['\t', '|', '  ', ','];
    
    for (const sep of separators) {
      const cells = line.split(sep).map(cell => cell.trim()).filter(cell => cell.length > 0);
      if (cells.length > 1) {
        return cells;
      }
    }

    return [line.trim()];
  }

  /**
   * Extract clause text around a match
   */
  private extractClauseText(content: string, matchIndex: number): string {
    const sentences = content.split(/[.!?]+/);
    let charCount = 0;
    
    for (const sentence of sentences) {
      charCount += sentence.length + 1;
      if (charCount > matchIndex) {
        return sentence.trim();
      }
    }

    return content.substring(matchIndex, matchIndex + 200); // Fallback
  }

  /**
   * Generate clause title
   */
  private generateClauseTitle(clauseText: string, clauseType: string): string {
    const words = clauseText.split(' ').slice(0, 8).join(' ');
    return `${clauseType.charAt(0).toUpperCase() + clauseType.slice(1)} Clause: ${words}...`;
  }

  /**
   * Assess clause risk level
   */
  private assessClauseRisk(clauseText: string, clauseType: string): ClauseInfo['riskLevel'] {
    const text = clauseText.toLowerCase();
    
    const highRiskIndicators = [
      'unlimited liability',
      'personal guarantee',
      'immediate termination',
      'no refund',
      'waive rights',
    ];

    const mediumRiskIndicators = [
      'penalty',
      'forfeit',
      'breach',
      'default',
      'liquidated damages',
    ];

    if (highRiskIndicators.some(indicator => text.includes(indicator))) {
      return 'high';
    }

    if (mediumRiskIndicators.some(indicator => text.includes(indicator))) {
      return 'medium';
    }

    return 'low';
  }
}

export const metadataExtractorService = new MetadataExtractorService();