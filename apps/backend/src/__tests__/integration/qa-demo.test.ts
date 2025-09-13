/**
 * Q&A System Integration Demo
 * This test demonstrates the Q&A system functionality with mock data
 */

interface MockDocument {
  id: string;
  userId: string;
  filename: string;
  documentType: string;
  jurisdiction: string;
  analysis: {
    summary: string;
    riskScore: string;
    clauses: Array<{
      id: string;
      title: string;
      content: string;
      riskLevel: string;
      explanation: string;
    }>;
  };
}

interface MockQAService {
  documents: Map<string, MockDocument>;
  conversations: Map<string, any>;
  embeddings: Map<string, any[]>;
  
  askQuestion(documentId: string, userId: string, question: string): Promise<any>;
  generateEmbeddings(document: MockDocument): Promise<void>;
  findRelevantSections(documentId: string, question: string): any[];
}

describe('Q&A System Integration Demo', () => {
  let mockQAService: MockQAService;
  let sampleDocument: MockDocument;

  beforeEach(() => {
    // Create sample document
    sampleDocument = {
      id: 'lease-001',
      userId: 'user-123',
      filename: 'apartment-lease.pdf',
      documentType: 'lease',
      jurisdiction: 'US-CA',
      analysis: {
        summary: 'This is a 12-month residential lease agreement for an apartment in California.',
        riskScore: 'medium',
        clauses: [
          {
            id: 'clause-rent',
            title: 'Monthly Rent Payment',
            content: 'Tenant agrees to pay monthly rent of $2,500 on or before the first day of each month. Late fees of $50 will be charged for payments received after the 5th day of the month.',
            riskLevel: 'low',
            explanation: 'Standard rent payment terms with reasonable late fee policy.'
          },
          {
            id: 'clause-deposit',
            title: 'Security Deposit',
            content: 'Tenant shall pay a security deposit of $5,000 upon signing this lease. The deposit will be held in an interest-bearing account and returned within 30 days of lease termination, minus any deductions for damages.',
            riskLevel: 'high',
            explanation: 'High security deposit amount - twice the monthly rent. This is above average for the area.'
          },
          {
            id: 'clause-pets',
            title: 'Pet Policy',
            content: 'No pets are allowed on the premises without prior written consent from the landlord. Unauthorized pets will result in immediate lease termination.',
            riskLevel: 'medium',
            explanation: 'Strict no-pet policy with severe consequences for violations.'
          },
          {
            id: 'clause-maintenance',
            title: 'Maintenance and Repairs',
            content: 'Tenant is responsible for all maintenance and repairs, including major appliances and HVAC systems. Landlord is only responsible for structural issues.',
            riskLevel: 'high',
            explanation: 'Unusual clause placing excessive maintenance burden on tenant, including major systems typically covered by landlord.'
          }
        ]
      }
    };

    // Create mock Q&A service
    mockQAService = {
      documents: new Map(),
      conversations: new Map(),
      embeddings: new Map(),

      async askQuestion(documentId: string, userId: string, question: string) {
        const document = this.documents.get(documentId);
        if (!document) {
          throw new Error('Document not found');
        }

        const relevantSections = this.findRelevantSections(documentId, question);
        const answer = this.generateAnswer(question, relevantSections);
        
        return {
          answer,
          sources: relevantSections.map(section => ({
            clauseId: section.id,
            clauseTitle: section.title,
            relevantText: section.content.substring(0, 100) + '...',
            confidence: section.relevance
          })),
          conversationId: 'conv-' + Date.now(),
          confidence: relevantSections.length > 0 ? relevantSections[0].relevance : 0.5
        };
      },

      async generateEmbeddings(document: MockDocument) {
        // Mock embedding generation
        const embeddings = document.analysis.clauses.map(clause => ({
          clauseId: clause.id,
          embedding: Array.from({ length: 10 }, () => Math.random()), // Simple mock embeddings
          text: clause.content,
          metadata: {
            title: clause.title,
            riskLevel: clause.riskLevel
          }
        }));
        
        this.embeddings.set(document.id, embeddings);
      },

      findRelevantSections(documentId: string, question: string) {
        const document = this.documents.get(documentId);
        if (!document) return [];

        const questionLower = question.toLowerCase();
        
        // Simple keyword matching for demo purposes
        return document.analysis.clauses
          .map(clause => ({
            ...clause,
            relevance: this.calculateRelevance(questionLower, clause)
          }))
          .filter(clause => clause.relevance > 0.3)
          .sort((a, b) => b.relevance - a.relevance)
          .slice(0, 3);
      },

      calculateRelevance(question: string, clause: any): number {
        const keywords = {
          'rent': ['rent', 'payment', 'monthly', 'cost', 'much'],
          'deposit': ['deposit', 'security', 'refund', 'amount'],
          'pet': ['pet', 'animal', 'dog', 'cat'],
          'maintenance': ['maintenance', 'repair', 'fix', 'hvac', 'appliance', 'responsible'],
          'lease': ['lease', 'term', 'duration', 'contract'],
          'risk': ['risk', 'problem', 'issue', 'concern', 'main']
        };

        let relevance = 0;
        const clauseText = (clause.title + ' ' + clause.content + ' ' + clause.explanation).toLowerCase();

        // Check for keyword matches
        for (const [category, words] of Object.entries(keywords)) {
          const questionHasKeyword = words.some(word => question.includes(word));
          const clauseHasKeyword = words.some(word => clauseText.includes(word));
          
          if (questionHasKeyword && clauseHasKeyword) {
            relevance += 0.4;
          }
        }

        // Direct text matching
        const questionWords = question.toLowerCase().split(/\s+/);
        const clauseWords = clauseText.split(/\s+/);
        const commonWords = questionWords.filter(word => 
          word.length > 2 && clauseWords.includes(word)
        );
        
        if (commonWords.length > 0) {
          relevance += commonWords.length * 0.2;
        }

        // Boost for clause title matches
        if (questionWords.some(word => clause.title.toLowerCase().includes(word))) {
          relevance += 0.3;
        }

        return Math.min(1.0, relevance);
      },

      generateAnswer(question: string, relevantSections: any[]): string {
        if (relevantSections.length === 0) {
          return "I couldn't find specific information about that in the document. Please try rephrasing your question or ask about a different topic.";
        }

        const topSection = relevantSections[0];
        const questionLower = question.toLowerCase();

        // Generate contextual answers based on question type
        if (questionLower.includes('how much') || questionLower.includes('cost') || questionLower.includes('amount')) {
          if (topSection.id === 'clause-rent') {
            return 'The monthly rent is $2,500, due on or before the first day of each month. Late fees of $50 apply for payments received after the 5th.';
          }
          if (topSection.id === 'clause-deposit') {
            return 'The security deposit is $5,000, which is quite high at twice the monthly rent. This will be held in an interest-bearing account.';
          }
        }

        if (questionLower.includes('pet') || questionLower.includes('animal')) {
          return 'No pets are allowed without prior written consent from the landlord. Unauthorized pets will result in immediate lease termination. This is a strict policy with severe consequences.';
        }

        if (questionLower.includes('maintenance') || questionLower.includes('repair')) {
          return 'You would be responsible for ALL maintenance and repairs, including major appliances and HVAC systems. This is unusual and places excessive burden on you as the tenant. Typically, landlords cover major systems.';
        }

        if (questionLower.includes('risk') || questionLower.includes('concern') || questionLower.includes('problem')) {
          return 'The main risks in this lease include: 1) Very high security deposit ($5,000), 2) Unusual maintenance clause making you responsible for major systems, and 3) Strict pet policy with immediate termination consequences.';
        }

        // Default response
        return `Based on the ${topSection.title} clause: ${topSection.explanation}`;
      }
    };

    // Add sample document to service
    mockQAService.documents.set(sampleDocument.id, sampleDocument);
  });

  describe('Document Analysis Q&A', () => {
    it('should answer questions about rent amount', async () => {
      const response = await mockQAService.askQuestion(
        sampleDocument.id,
        sampleDocument.userId,
        'How much is the monthly rent?'
      );

      expect(response.answer).toContain('$2,500');
      expect(response.answer).toContain('first day of each month');
      expect(response.sources.length).toBeGreaterThanOrEqual(1);
      expect(response.sources[0].clauseTitle).toBe('Monthly Rent Payment');
      expect(response.confidence).toBeGreaterThan(0.5);
    });

    it('should answer questions about security deposit', async () => {
      const response = await mockQAService.askQuestion(
        sampleDocument.id,
        sampleDocument.userId,
        'What is the security deposit amount?'
      );

      expect(response.answer).toContain('$5,000');
      expect(response.answer).toContain('twice the monthly rent');
      expect(response.sources[0].clauseTitle).toBe('Security Deposit');
    });

    it('should answer questions about pet policy', async () => {
      const response = await mockQAService.askQuestion(
        sampleDocument.id,
        sampleDocument.userId,
        'Can I have a pet in this apartment?'
      );

      expect(response.answer).toContain('No pets are allowed');
      expect(response.answer).toContain('written consent');
      expect(response.answer).toContain('immediate lease termination');
    });

    it('should identify maintenance risks', async () => {
      const response = await mockQAService.askQuestion(
        sampleDocument.id,
        sampleDocument.userId,
        'Who is responsible for maintenance and repairs?'
      );

      expect(response.answer).toContain('responsible for ALL maintenance');
      expect(response.answer).toContain('unusual');
      expect(response.answer).toContain('excessive burden');
      expect(response.answer).toContain('major systems');
    });

    it('should provide risk overview when asked', async () => {
      const response = await mockQAService.askQuestion(
        sampleDocument.id,
        sampleDocument.userId,
        'What are the main risks in this lease?'
      );

      expect(response.answer).toContain('main risks');
      expect(response.answer).toContain('$5,000');
      expect(response.answer).toContain('maintenance clause');
      expect(response.answer).toContain('pet policy');
    });

    it('should handle questions about unfamiliar topics', async () => {
      const response = await mockQAService.askQuestion(
        sampleDocument.id,
        sampleDocument.userId,
        'What is the parking situation?'
      );

      expect(response.answer).toContain("couldn't find specific information");
      expect(response.sources).toHaveLength(0);
    });
  });

  describe('Source Citation Accuracy', () => {
    it('should provide accurate source citations', async () => {
      const response = await mockQAService.askQuestion(
        sampleDocument.id,
        sampleDocument.userId,
        'Tell me about the security deposit'
      );

      expect(response.sources.length).toBeGreaterThanOrEqual(1);
      const source = response.sources[0];
      
      expect(source.clauseId).toBe('clause-deposit');
      expect(source.clauseTitle).toBe('Security Deposit');
      expect(source.relevantText).toContain('$5,000');
      expect(source.confidence).toBeGreaterThan(0.3);
    });

    it('should rank sources by relevance', async () => {
      // Add a question that might match multiple clauses
      const response = await mockQAService.askQuestion(
        sampleDocument.id,
        sampleDocument.userId,
        'What are my financial obligations?'
      );

      if (response.sources.length > 1) {
        // First source should have higher confidence than subsequent ones
        expect(response.sources[0].confidence).toBeGreaterThanOrEqual(response.sources[1].confidence);
      }
    });
  });

  describe('Conversation Context', () => {
    it('should maintain conversation context across questions', async () => {
      // First question
      const response1 = await mockQAService.askQuestion(
        sampleDocument.id,
        sampleDocument.userId,
        'How much is the rent?'
      );

      expect(response1.conversationId).toBeDefined();

      // Follow-up question (in real implementation, this would use conversation context)
      const response2 = await mockQAService.askQuestion(
        sampleDocument.id,
        sampleDocument.userId,
        'When is it due?'
      );

      expect(response2.conversationId).toBeDefined();
      // In a full implementation, this would reference the previous rent discussion
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent documents', async () => {
      await expect(
        mockQAService.askQuestion('non-existent', 'user-123', 'What is this?')
      ).rejects.toThrow('Document not found');
    });

    it('should handle empty questions gracefully', async () => {
      const response = await mockQAService.askQuestion(
        sampleDocument.id,
        sampleDocument.userId,
        ''
      );

      expect(response.answer).toContain("couldn't find specific information");
    });
  });

  describe('Embedding Generation', () => {
    it('should generate embeddings for document clauses', async () => {
      await mockQAService.generateEmbeddings(sampleDocument);
      
      const embeddings = mockQAService.embeddings.get(sampleDocument.id);
      expect(embeddings).toBeDefined();
      expect(embeddings).toHaveLength(4); // One for each clause
      
      embeddings.forEach(embedding => {
        expect(embedding.clauseId).toBeDefined();
        expect(embedding.embedding).toHaveLength(10); // Mock embedding size
        expect(embedding.text).toBeDefined();
        expect(embedding.metadata.title).toBeDefined();
      });
    });
  });
});