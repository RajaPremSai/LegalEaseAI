/**
 * Unit tests for Q&A system core functionality
 * These tests focus on the business logic without external dependencies
 */

describe('Q&A System Core Logic', () => {
  describe('Cosine Similarity Calculation', () => {
    // Test the cosine similarity function in isolation
    function cosineSimilarity(a: number[], b: number[]): number {
      if (a.length !== b.length) {
        return 0;
      }

      let dotProduct = 0;
      let normA = 0;
      let normB = 0;

      for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
      }

      if (normA === 0 || normB === 0) {
        return 0;
      }

      return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    it('should return 1 for identical vectors', () => {
      const vector1 = [1, 2, 3];
      const vector2 = [1, 2, 3];
      
      const similarity = cosineSimilarity(vector1, vector2);
      expect(similarity).toBeCloseTo(1, 5);
    });

    it('should return 0 for orthogonal vectors', () => {
      const vector1 = [1, 0, 0];
      const vector2 = [0, 1, 0];
      
      const similarity = cosineSimilarity(vector1, vector2);
      expect(similarity).toBeCloseTo(0, 5);
    });

    it('should return 0 for vectors of different lengths', () => {
      const vector1 = [1, 2];
      const vector2 = [1, 2, 3];
      
      const similarity = cosineSimilarity(vector1, vector2);
      expect(similarity).toBe(0);
    });

    it('should handle zero vectors', () => {
      const vector1 = [0, 0, 0];
      const vector2 = [1, 2, 3];
      
      const similarity = cosineSimilarity(vector1, vector2);
      expect(similarity).toBe(0);
    });

    it('should calculate correct similarity for known vectors', () => {
      const vector1 = [1, 1, 0];
      const vector2 = [1, 0, 1];
      
      const similarity = cosineSimilarity(vector1, vector2);
      // Expected: (1*1 + 1*0 + 0*1) / (sqrt(2) * sqrt(2)) = 1/2 = 0.5
      expect(similarity).toBeCloseTo(0.5, 5);
    });
  });

  describe('Answer Confidence Calculation', () => {
    interface RelevantSection {
      similarity: number;
      metadata: {
        clauseTitle: string;
        riskLevel: string;
      };
    }

    function calculateAnswerConfidence(
      relevantSections: RelevantSection[],
      answer: string
    ): number {
      if (relevantSections.length === 0) return 0;

      // Base confidence on average similarity of top sections
      const avgSimilarity = relevantSections
        .slice(0, 3)
        .reduce((sum, section) => sum + section.similarity, 0) / Math.min(3, relevantSections.length);

      // Adjust based on answer characteristics
      let confidence = avgSimilarity;

      // Lower confidence if answer indicates uncertainty
      if (answer.toLowerCase().includes('cannot') || 
          answer.toLowerCase().includes('unclear') ||
          answer.toLowerCase().includes('not specified')) {
        confidence *= 0.7;
      }

      // Higher confidence if answer references specific sections
      if (answer.toLowerCase().includes('section') || 
          answer.toLowerCase().includes('clause')) {
        confidence *= 1.1;
      }

      return Math.min(1.0, Math.max(0.0, confidence));
    }

    it('should return 0 for empty relevant sections', () => {
      const confidence = calculateAnswerConfidence([], 'Some answer');
      expect(confidence).toBe(0);
    });

    it('should calculate base confidence from similarity scores', () => {
      const sections: RelevantSection[] = [
        { similarity: 0.9, metadata: { clauseTitle: 'Test', riskLevel: 'low' } },
        { similarity: 0.8, metadata: { clauseTitle: 'Test', riskLevel: 'low' } }
      ];
      
      const confidence = calculateAnswerConfidence(sections, 'Clear answer');
      expect(confidence).toBeCloseTo(0.85, 2); // (0.9 + 0.8) / 2
    });

    it('should reduce confidence for uncertain answers', () => {
      const sections: RelevantSection[] = [
        { similarity: 0.9, metadata: { clauseTitle: 'Test', riskLevel: 'low' } }
      ];
      
      const confidence = calculateAnswerConfidence(sections, 'I cannot determine this from the document');
      expect(confidence).toBeCloseTo(0.63, 2); // 0.9 * 0.7
    });

    it('should increase confidence for specific references', () => {
      const sections: RelevantSection[] = [
        { similarity: 0.8, metadata: { clauseTitle: 'Test', riskLevel: 'low' } }
      ];
      
      const confidence = calculateAnswerConfidence(sections, 'According to Section 3, the answer is...');
      expect(confidence).toBeCloseTo(0.88, 2); // 0.8 * 1.1
    });

    it('should cap confidence at 1.0', () => {
      const sections: RelevantSection[] = [
        { similarity: 0.95, metadata: { clauseTitle: 'Test', riskLevel: 'low' } }
      ];
      
      const confidence = calculateAnswerConfidence(sections, 'According to clause 5, the section clearly states...');
      expect(confidence).toBe(1.0); // Capped at 1.0
    });
  });

  describe('Source Citation Creation', () => {
    interface DocumentEmbedding {
      clauseId: string;
      text: string;
      similarity: number;
      metadata: {
        clauseTitle: string;
        riskLevel: string;
        location: {
          startIndex: number;
          endIndex: number;
        };
      };
    }

    interface SourceCitation {
      clauseId: string;
      clauseTitle: string;
      relevantText: string;
      location: {
        startIndex: number;
        endIndex: number;
      };
      confidence: number;
    }

    function createSourceCitations(
      relevantSections: DocumentEmbedding[],
      answer: string
    ): SourceCitation[] {
      return relevantSections
        .filter(section => section.similarity > 0.4) // Only high-confidence sources
        .map(section => ({
          clauseId: section.clauseId.replace('-title', ''), // Remove title suffix if present
          clauseTitle: section.metadata.clauseTitle,
          relevantText: section.text.substring(0, 200) + (section.text.length > 200 ? '...' : ''),
          location: section.metadata.location,
          confidence: section.similarity
        }))
        .slice(0, 3); // Limit to top 3 sources
    }

    it('should create citations from high-confidence sections', () => {
      const sections: DocumentEmbedding[] = [
        {
          clauseId: 'clause-1',
          text: 'This is a long clause about security deposits that explains the requirements in detail.',
          similarity: 0.9,
          metadata: {
            clauseTitle: 'Security Deposit',
            riskLevel: 'medium',
            location: { startIndex: 100, endIndex: 200 }
          }
        },
        {
          clauseId: 'clause-2',
          text: 'Short clause',
          similarity: 0.8,
          metadata: {
            clauseTitle: 'Rent Payment',
            riskLevel: 'low',
            location: { startIndex: 300, endIndex: 350 }
          }
        }
      ];

      const citations = createSourceCitations(sections, 'Answer about deposits');
      
      expect(citations).toHaveLength(2);
      expect(citations[0].clauseTitle).toBe('Security Deposit');
      expect(citations[0].confidence).toBe(0.9);
      expect(citations[0].relevantText).toContain('security deposits');
    });

    it('should filter out low-confidence sections', () => {
      const sections: DocumentEmbedding[] = [
        {
          clauseId: 'clause-1',
          text: 'High confidence section',
          similarity: 0.8,
          metadata: {
            clauseTitle: 'Important Clause',
            riskLevel: 'high',
            location: { startIndex: 0, endIndex: 100 }
          }
        },
        {
          clauseId: 'clause-2',
          text: 'Low confidence section',
          similarity: 0.3, // Below 0.4 threshold
          metadata: {
            clauseTitle: 'Irrelevant Clause',
            riskLevel: 'low',
            location: { startIndex: 200, endIndex: 300 }
          }
        }
      ];

      const citations = createSourceCitations(sections, 'Answer');
      
      expect(citations).toHaveLength(1);
      expect(citations[0].clauseTitle).toBe('Important Clause');
    });

    it('should truncate long text and add ellipsis', () => {
      const longText = 'A'.repeat(250); // 250 characters
      const sections: DocumentEmbedding[] = [
        {
          clauseId: 'clause-1',
          text: longText,
          similarity: 0.9,
          metadata: {
            clauseTitle: 'Long Clause',
            riskLevel: 'medium',
            location: { startIndex: 0, endIndex: 250 }
          }
        }
      ];

      const citations = createSourceCitations(sections, 'Answer');
      
      expect(citations[0].relevantText).toHaveLength(203); // 200 + '...'
      expect(citations[0].relevantText.endsWith('...')).toBe(true);
    });

    it('should limit to top 3 sources', () => {
      const sections: DocumentEmbedding[] = Array.from({ length: 5 }, (_, i) => ({
        clauseId: `clause-${i + 1}`,
        text: `Section ${i + 1}`,
        similarity: 0.9 - i * 0.1, // Decreasing similarity
        metadata: {
          clauseTitle: `Clause ${i + 1}`,
          riskLevel: 'low',
          location: { startIndex: i * 100, endIndex: (i + 1) * 100 }
        }
      }));

      const citations = createSourceCitations(sections, 'Answer');
      
      expect(citations).toHaveLength(3);
      expect(citations[0].clauseTitle).toBe('Clause 1'); // Highest similarity
      expect(citations[2].clauseTitle).toBe('Clause 3'); // Third highest
    });

    it('should remove title suffix from clause IDs', () => {
      const sections: DocumentEmbedding[] = [
        {
          clauseId: 'clause-1-title',
          text: 'Title section',
          similarity: 0.8,
          metadata: {
            clauseTitle: 'Test Clause',
            riskLevel: 'low',
            location: { startIndex: 0, endIndex: 100 }
          }
        }
      ];

      const citations = createSourceCitations(sections, 'Answer');
      
      expect(citations[0].clauseId).toBe('clause-1');
    });
  });

  describe('Text Processing Utilities', () => {
    function truncateText(text: string, maxLength: number): string {
      if (text.length <= maxLength) {
        return text;
      }
      return text.substring(0, maxLength) + '...';
    }

    it('should return original text if within limit', () => {
      const text = 'Short text';
      const result = truncateText(text, 20);
      expect(result).toBe('Short text');
    });

    it('should truncate and add ellipsis if over limit', () => {
      const text = 'This is a very long text that exceeds the limit';
      const result = truncateText(text, 20);
      expect(result).toBe('This is a very long ...'); // 20 chars + '...'
      expect(result.length).toBe(23);
    });

    it('should handle empty text', () => {
      const result = truncateText('', 10);
      expect(result).toBe('');
    });

    it('should handle exact length match', () => {
      const text = 'Exactly twenty chars';
      const result = truncateText(text, 20);
      expect(result).toBe('Exactly twenty chars');
    });
  });
});