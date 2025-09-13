import {
  DocumentSchema,
  UserSchema,
  DocumentAnalysisSchema,
  DocumentUploadSchema,
  UserRegistrationSchema,
  QuestionSchema,
} from '../schemas';

describe('Data Model Validation Edge Cases', () => {
  describe('Document Validation', () => {
    it('should handle documents with maximum allowed values', () => {
      const maxDocument = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: '123e4567-e89b-12d3-a456-426614174001',
        filename: 'a'.repeat(255), // Maximum filename length
        documentType: 'contract' as const,
        jurisdiction: 'US',
        uploadedAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        status: 'processing' as const,
        metadata: {
          pageCount: 1000, // Large document
          wordCount: 100000, // Large word count
          language: 'en',
          extractedText: 'x'.repeat(10000), // Large text
        },
      };
      
      expect(() => DocumentSchema.parse(maxDocument)).not.toThrow();
    });

    it('should reject documents with invalid expiry dates', () => {
      const invalidDocument = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: '123e4567-e89b-12d3-a456-426614174001',
        filename: 'test.pdf',
        documentType: 'contract' as const,
        jurisdiction: 'US',
        uploadedAt: new Date(),
        expiresAt: new Date('invalid-date'),
        status: 'processing' as const,
        metadata: {
          pageCount: 1,
          wordCount: 100,
          language: 'en',
          extractedText: 'text',
        },
      };
      
      expect(() => DocumentSchema.parse(invalidDocument)).toThrow();
    });

    it('should handle documents with complex analysis data', () => {
      const complexDocument = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: '123e4567-e89b-12d3-a456-426614174001',
        filename: 'complex-contract.pdf',
        documentType: 'contract' as const,
        jurisdiction: 'US',
        uploadedAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        status: 'analyzed' as const,
        metadata: {
          pageCount: 50,
          wordCount: 15000,
          language: 'en',
          extractedText: 'Complex legal document text...',
        },
        analysis: {
          summary: 'This is a comprehensive analysis of a complex legal document with multiple clauses and risk factors.',
          riskScore: 'high' as const,
          keyTerms: [
            {
              term: 'Force Majeure',
              definition: 'An unforeseeable circumstance that prevents a party from fulfilling a contract.',
              importance: 'high' as const,
              location: { startIndex: 1000, endIndex: 1100, pageNumber: 5 },
            },
            {
              term: 'Indemnification',
              definition: 'Security or protection against a loss or other financial burden.',
              importance: 'high' as const,
              location: { startIndex: 2000, endIndex: 2150, pageNumber: 10 },
            },
          ],
          risks: [
            {
              category: 'financial' as const,
              severity: 'high' as const,
              description: 'Unlimited liability clause could result in significant financial exposure.',
              affectedClause: 'Section 8.2 - Liability and Indemnification',
              recommendation: 'Negotiate a liability cap or seek legal counsel to review this clause.',
            },
            {
              category: 'legal' as const,
              severity: 'medium' as const,
              description: 'Broad termination clause may allow counterparty to terminate without cause.',
              affectedClause: 'Section 12.1 - Termination',
              recommendation: 'Request mutual termination rights or specific termination conditions.',
            },
          ],
          recommendations: [
            'Review the liability and indemnification clauses with legal counsel',
            'Consider negotiating a liability cap',
            'Clarify termination conditions',
            'Ensure force majeure clause is mutual',
          ],
          clauses: [
            {
              id: '123e4567-e89b-12d3-a456-426614174002',
              title: 'Liability and Indemnification',
              content: 'The Contractor shall indemnify and hold harmless the Client...',
              location: { startIndex: 8000, endIndex: 8500, pageNumber: 15 },
              riskLevel: 'high' as const,
              explanation: 'This clause places unlimited liability on the contractor, which could result in significant financial risk.',
            },
          ],
          generatedAt: new Date(),
        },
      };
      
      expect(() => DocumentSchema.parse(complexDocument)).not.toThrow();
    });
  });

  describe('User Validation Edge Cases', () => {
    it('should handle users with all optional preferences', () => {
      const userWithAllPrefs = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        profile: {
          name: 'Test User',
          userType: 'enterprise' as const,
          jurisdiction: 'CA',
          preferences: {
            language: 'fr',
            notifications: false,
            autoDelete: false,
          },
        },
        subscription: {
          plan: 'enterprise' as const,
          documentsRemaining: 1000,
          renewsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        },
        createdAt: new Date(),
      };
      
      expect(() => UserSchema.parse(userWithAllPrefs)).not.toThrow();
    });

    it('should reject users with invalid email formats', () => {
      const invalidEmails = [
        'invalid-email',
        '@example.com',
        'user@',
        'user..name@example.com',
        'user@example',
      ];

      invalidEmails.forEach(email => {
        const invalidUser = {
          id: '123e4567-e89b-12d3-a456-426614174000',
          email,
          profile: {
            name: 'Test User',
            userType: 'individual' as const,
            jurisdiction: 'US',
            preferences: {
              language: 'en',
              notifications: true,
              autoDelete: true,
            },
          },
          subscription: {
            plan: 'free' as const,
            documentsRemaining: 5,
            renewsAt: new Date(),
          },
          createdAt: new Date(),
        };
        
        expect(() => UserSchema.parse(invalidUser)).toThrow();
      });
    });

    it('should handle edge cases in user names', () => {
      const edgeCaseNames = [
        'A', // Single character
        'José María García-López', // Special characters
        '李小明', // Unicode characters
        'O\'Connor-Smith Jr.', // Apostrophes and hyphens
      ];

      edgeCaseNames.forEach(name => {
        const user = {
          id: '123e4567-e89b-12d3-a456-426614174000',
          email: 'test@example.com',
          profile: {
            name,
            userType: 'individual' as const,
            jurisdiction: 'US',
            preferences: {
              language: 'en',
              notifications: true,
              autoDelete: true,
            },
          },
          subscription: {
            plan: 'free' as const,
            documentsRemaining: 5,
            renewsAt: new Date(),
          },
          createdAt: new Date(),
        };
        
        expect(() => UserSchema.parse(user)).not.toThrow();
      });
    });
  });

  describe('File Upload Validation', () => {
    it('should handle maximum file size', () => {
      const maxSizeUpload = {
        filename: 'large-document.pdf',
        fileSize: 50 * 1024 * 1024, // Exactly 50MB
        mimeType: 'application/pdf' as const,
        jurisdiction: 'US',
      };
      
      expect(() => DocumentUploadSchema.parse(maxSizeUpload)).not.toThrow();
    });

    it('should reject files over size limit', () => {
      const oversizeUpload = {
        filename: 'too-large.pdf',
        fileSize: 50 * 1024 * 1024 + 1, // 50MB + 1 byte
        mimeType: 'application/pdf' as const,
        jurisdiction: 'US',
      };
      
      expect(() => DocumentUploadSchema.parse(oversizeUpload)).toThrow();
    });

    it('should handle all supported file types', () => {
      const supportedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
      ];

      supportedTypes.forEach(mimeType => {
        const upload = {
          filename: 'test-file',
          fileSize: 1024,
          mimeType: mimeType as any,
          jurisdiction: 'US',
        };
        
        expect(() => DocumentUploadSchema.parse(upload)).not.toThrow();
      });
    });
  });

  describe('Question Validation', () => {
    it('should handle questions at maximum length', () => {
      const maxQuestion = {
        documentId: '123e4567-e89b-12d3-a456-426614174000',
        question: 'x'.repeat(1000), // Maximum length
        conversationId: '123e4567-e89b-12d3-a456-426614174001',
      };
      
      expect(() => QuestionSchema.parse(maxQuestion)).not.toThrow();
    });

    it('should handle questions with special characters', () => {
      const specialCharQuestions = [
        'What does "force majeure" mean in this context?',
        'How does the 50% liability cap affect my risk exposure?',
        'Can you explain the termination clause (Section 12.1)?',
        'What are the implications of the indemnification clause?',
        '¿Qué significa esta cláusula en español?',
        'この契約条項の意味は何ですか？',
      ];

      specialCharQuestions.forEach(question => {
        const questionObj = {
          documentId: '123e4567-e89b-12d3-a456-426614174000',
          question,
        };
        
        expect(() => QuestionSchema.parse(questionObj)).not.toThrow();
      });
    });
  });

  describe('User Registration Edge Cases', () => {
    it('should handle international users', () => {
      const internationalUsers = [
        {
          email: 'user@example.co.uk',
          name: 'John Smith',
          userType: 'individual' as const,
          jurisdiction: 'GB',
        },
        {
          email: 'utilisateur@exemple.fr',
          name: 'Marie Dubois',
          userType: 'small_business' as const,
          jurisdiction: 'FR',
        },
        {
          email: 'usuario@ejemplo.es',
          name: 'Carlos García',
          userType: 'enterprise' as const,
          jurisdiction: 'ES',
        },
      ];

      internationalUsers.forEach(user => {
        expect(() => UserRegistrationSchema.parse(user)).not.toThrow();
      });
    });

    it('should apply correct defaults', () => {
      const minimalRegistration = {
        email: 'user@example.com',
        name: 'Test User',
        jurisdiction: 'US',
      };
      
      const parsed = UserRegistrationSchema.parse(minimalRegistration);
      expect(parsed.userType).toBe('individual');
    });
  });

  describe('Cross-field Validation', () => {
    it('should validate document analysis consistency', () => {
      // Test that high-risk documents have appropriate risk scores
      const highRiskAnalysis = {
        summary: 'This document contains several high-risk clauses.',
        riskScore: 'high' as const,
        keyTerms: [],
        risks: [
          {
            category: 'financial' as const,
            severity: 'high' as const,
            description: 'Unlimited liability exposure',
            affectedClause: 'Section 8',
            recommendation: 'Add liability cap',
          },
        ],
        recommendations: ['Seek legal counsel', 'Negotiate liability terms'],
        clauses: [],
        generatedAt: new Date(),
      };
      
      expect(() => DocumentAnalysisSchema.parse(highRiskAnalysis)).not.toThrow();
    });

    it('should handle empty arrays in analysis', () => {
      const minimalAnalysis = {
        summary: 'Simple document with no significant risks.',
        riskScore: 'low' as const,
        keyTerms: [],
        risks: [],
        recommendations: [],
        clauses: [],
        generatedAt: new Date(),
      };
      
      expect(() => DocumentAnalysisSchema.parse(minimalAnalysis)).not.toThrow();
    });
  });
});