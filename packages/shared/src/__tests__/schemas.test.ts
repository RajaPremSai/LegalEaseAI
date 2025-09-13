import {
  DocumentSchema,
  UserSchema,
  DocumentAnalysisSchema,
  DocumentUploadSchema,
  UserRegistrationSchema,
  QuestionSchema,
  DocumentAnalysisRequestSchema,
  KeyTermSchema,
  RiskSchema,
  ClauseSchema,
  TextLocationSchema,
  DocumentMetadataSchema,
  UserPreferencesSchema,
  UserProfileSchema,
  UserSubscriptionSchema,
} from '../schemas';

describe('Schema Validation Tests', () => {
  describe('TextLocationSchema', () => {
    it('should validate valid text location', () => {
      const validLocation = {
        startIndex: 0,
        endIndex: 100,
        pageNumber: 1,
      };
      
      expect(() => TextLocationSchema.parse(validLocation)).not.toThrow();
    });

    it('should validate text location without page number', () => {
      const validLocation = {
        startIndex: 0,
        endIndex: 100,
      };
      
      expect(() => TextLocationSchema.parse(validLocation)).not.toThrow();
    });

    it('should reject negative indices', () => {
      const invalidLocation = {
        startIndex: -1,
        endIndex: 100,
      };
      
      expect(() => TextLocationSchema.parse(invalidLocation)).toThrow();
    });

    it('should reject invalid page number', () => {
      const invalidLocation = {
        startIndex: 0,
        endIndex: 100,
        pageNumber: 0,
      };
      
      expect(() => TextLocationSchema.parse(invalidLocation)).toThrow();
    });
  });

  describe('DocumentMetadataSchema', () => {
    it('should validate valid document metadata', () => {
      const validMetadata = {
        pageCount: 5,
        wordCount: 1000,
        language: 'en',
        extractedText: 'This is the extracted text from the document.',
      };
      
      expect(() => DocumentMetadataSchema.parse(validMetadata)).not.toThrow();
    });

    it('should reject zero page count', () => {
      const invalidMetadata = {
        pageCount: 0,
        wordCount: 1000,
        language: 'en',
        extractedText: 'Text',
      };
      
      expect(() => DocumentMetadataSchema.parse(invalidMetadata)).toThrow();
    });

    it('should reject negative word count', () => {
      const invalidMetadata = {
        pageCount: 1,
        wordCount: -1,
        language: 'en',
        extractedText: 'Text',
      };
      
      expect(() => DocumentMetadataSchema.parse(invalidMetadata)).toThrow();
    });
  });

  describe('KeyTermSchema', () => {
    it('should validate valid key term', () => {
      const validKeyTerm = {
        term: 'Force Majeure',
        definition: 'An unforeseeable circumstance that prevents a party from fulfilling a contract.',
        importance: 'high' as const,
        location: {
          startIndex: 100,
          endIndex: 200,
          pageNumber: 2,
        },
      };
      
      expect(() => KeyTermSchema.parse(validKeyTerm)).not.toThrow();
    });

    it('should reject empty term', () => {
      const invalidKeyTerm = {
        term: '',
        definition: 'A definition',
        importance: 'high' as const,
        location: { startIndex: 0, endIndex: 10 },
      };
      
      expect(() => KeyTermSchema.parse(invalidKeyTerm)).toThrow();
    });

    it('should reject invalid importance level', () => {
      const invalidKeyTerm = {
        term: 'Term',
        definition: 'Definition',
        importance: 'critical' as any,
        location: { startIndex: 0, endIndex: 10 },
      };
      
      expect(() => KeyTermSchema.parse(invalidKeyTerm)).toThrow();
    });
  });

  describe('RiskSchema', () => {
    it('should validate valid risk', () => {
      const validRisk = {
        category: 'financial' as const,
        severity: 'high' as const,
        description: 'This clause may result in significant financial liability.',
        affectedClause: 'Section 5.2 - Liability',
        recommendation: 'Consider adding a liability cap or exclusion.',
      };
      
      expect(() => RiskSchema.parse(validRisk)).not.toThrow();
    });

    it('should reject invalid category', () => {
      const invalidRisk = {
        category: 'technical' as any,
        severity: 'high' as const,
        description: 'Description',
        affectedClause: 'Clause',
        recommendation: 'Recommendation',
      };
      
      expect(() => RiskSchema.parse(invalidRisk)).toThrow();
    });

    it('should reject empty description', () => {
      const invalidRisk = {
        category: 'legal' as const,
        severity: 'medium' as const,
        description: '',
        affectedClause: 'Clause',
        recommendation: 'Recommendation',
      };
      
      expect(() => RiskSchema.parse(invalidRisk)).toThrow();
    });
  });

  describe('ClauseSchema', () => {
    it('should validate valid clause', () => {
      const validClause = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Termination Clause',
        content: 'Either party may terminate this agreement with 30 days notice.',
        location: { startIndex: 500, endIndex: 600 },
        riskLevel: 'medium' as const,
        explanation: 'This clause allows for termination with reasonable notice.',
      };
      
      expect(() => ClauseSchema.parse(validClause)).not.toThrow();
    });

    it('should reject invalid UUID', () => {
      const invalidClause = {
        id: 'invalid-uuid',
        title: 'Title',
        content: 'Content',
        location: { startIndex: 0, endIndex: 10 },
        riskLevel: 'low' as const,
        explanation: 'Explanation',
      };
      
      expect(() => ClauseSchema.parse(invalidClause)).toThrow();
    });
  });

  describe('DocumentAnalysisSchema', () => {
    it('should validate valid document analysis', () => {
      const validAnalysis = {
        summary: 'This is a comprehensive summary of the legal document.',
        riskScore: 'medium' as const,
        keyTerms: [],
        risks: [],
        recommendations: ['Review section 3.1', 'Consider legal counsel'],
        clauses: [],
        generatedAt: new Date(),
      };
      
      expect(() => DocumentAnalysisSchema.parse(validAnalysis)).not.toThrow();
    });

    it('should reject empty summary', () => {
      const invalidAnalysis = {
        summary: '',
        riskScore: 'low' as const,
        keyTerms: [],
        risks: [],
        recommendations: [],
        clauses: [],
        generatedAt: new Date(),
      };
      
      expect(() => DocumentAnalysisSchema.parse(invalidAnalysis)).toThrow();
    });

    it('should reject invalid risk score', () => {
      const invalidAnalysis = {
        summary: 'Summary',
        riskScore: 'critical' as any,
        keyTerms: [],
        risks: [],
        recommendations: [],
        clauses: [],
        generatedAt: new Date(),
      };
      
      expect(() => DocumentAnalysisSchema.parse(invalidAnalysis)).toThrow();
    });
  });

  describe('DocumentSchema', () => {
    it('should validate valid document', () => {
      const validDocument = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: '123e4567-e89b-12d3-a456-426614174001',
        filename: 'contract.pdf',
        documentType: 'contract' as const,
        jurisdiction: 'US',
        uploadedAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        status: 'processing' as const,
        metadata: {
          pageCount: 5,
          wordCount: 1000,
          language: 'en',
          extractedText: 'Document text',
        },
      };
      
      expect(() => DocumentSchema.parse(validDocument)).not.toThrow();
    });

    it('should validate document with analysis', () => {
      const validDocument = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: '123e4567-e89b-12d3-a456-426614174001',
        filename: 'contract.pdf',
        documentType: 'contract' as const,
        jurisdiction: 'US',
        uploadedAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        status: 'analyzed' as const,
        metadata: {
          pageCount: 5,
          wordCount: 1000,
          language: 'en',
          extractedText: 'Document text',
        },
        analysis: {
          summary: 'Document summary',
          riskScore: 'low' as const,
          keyTerms: [],
          risks: [],
          recommendations: [],
          clauses: [],
          generatedAt: new Date(),
        },
      };
      
      expect(() => DocumentSchema.parse(validDocument)).not.toThrow();
    });

    it('should reject invalid document type', () => {
      const invalidDocument = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: '123e4567-e89b-12d3-a456-426614174001',
        filename: 'contract.pdf',
        documentType: 'invalid_type' as any,
        jurisdiction: 'US',
        uploadedAt: new Date(),
        expiresAt: new Date(),
        status: 'processing' as const,
        metadata: {
          pageCount: 5,
          wordCount: 1000,
          language: 'en',
          extractedText: 'Text',
        },
      };
      
      expect(() => DocumentSchema.parse(invalidDocument)).toThrow();
    });
  });

  describe('UserSchema', () => {
    it('should validate valid user', () => {
      const validUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'user@example.com',
        profile: {
          name: 'John Doe',
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
      
      expect(() => UserSchema.parse(validUser)).not.toThrow();
    });

    it('should reject invalid email', () => {
      const invalidUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'invalid-email',
        profile: {
          name: 'John Doe',
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

    it('should apply default preferences', () => {
      const userWithDefaults = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'user@example.com',
        profile: {
          name: 'John Doe',
          userType: 'individual' as const,
          jurisdiction: 'US',
          preferences: {},
        },
        subscription: {
          plan: 'free' as const,
          documentsRemaining: 5,
          renewsAt: new Date(),
        },
        createdAt: new Date(),
      };
      
      const parsed = UserSchema.parse(userWithDefaults);
      expect(parsed.profile.preferences.language).toBe('en');
      expect(parsed.profile.preferences.notifications).toBe(true);
      expect(parsed.profile.preferences.autoDelete).toBe(true);
    });
  });

  describe('API Request Schemas', () => {
    describe('DocumentUploadSchema', () => {
      it('should validate valid document upload', () => {
        const validUpload = {
          filename: 'contract.pdf',
          fileSize: 1024 * 1024, // 1MB
          mimeType: 'application/pdf' as const,
          jurisdiction: 'US',
        };
        
        expect(() => DocumentUploadSchema.parse(validUpload)).not.toThrow();
      });

      it('should reject file too large', () => {
        const invalidUpload = {
          filename: 'large-file.pdf',
          fileSize: 60 * 1024 * 1024, // 60MB
          mimeType: 'application/pdf' as const,
        };
        
        expect(() => DocumentUploadSchema.parse(invalidUpload)).toThrow();
      });

      it('should reject invalid mime type', () => {
        const invalidUpload = {
          filename: 'file.exe',
          fileSize: 1024,
          mimeType: 'application/x-executable' as any,
        };
        
        expect(() => DocumentUploadSchema.parse(invalidUpload)).toThrow();
      });
    });

    describe('UserRegistrationSchema', () => {
      it('should validate valid user registration', () => {
        const validRegistration = {
          email: 'newuser@example.com',
          name: 'Jane Smith',
          userType: 'small_business' as const,
          jurisdiction: 'CA',
        };
        
        expect(() => UserRegistrationSchema.parse(validRegistration)).not.toThrow();
      });

      it('should apply default user type', () => {
        const registration = {
          email: 'user@example.com',
          name: 'User',
          jurisdiction: 'US',
        };
        
        const parsed = UserRegistrationSchema.parse(registration);
        expect(parsed.userType).toBe('individual');
      });

      it('should reject invalid jurisdiction', () => {
        const invalidRegistration = {
          email: 'user@example.com',
          name: 'User',
          userType: 'individual' as const,
          jurisdiction: 'X', // Too short
        };
        
        expect(() => UserRegistrationSchema.parse(invalidRegistration)).toThrow();
      });
    });

    describe('QuestionSchema', () => {
      it('should validate valid question', () => {
        const validQuestion = {
          documentId: '123e4567-e89b-12d3-a456-426614174000',
          question: 'What does this clause mean?',
          conversationId: '123e4567-e89b-12d3-a456-426614174001',
        };
        
        expect(() => QuestionSchema.parse(validQuestion)).not.toThrow();
      });

      it('should validate question without conversation ID', () => {
        const validQuestion = {
          documentId: '123e4567-e89b-12d3-a456-426614174000',
          question: 'What are the key risks?',
        };
        
        expect(() => QuestionSchema.parse(validQuestion)).not.toThrow();
      });

      it('should reject empty question', () => {
        const invalidQuestion = {
          documentId: '123e4567-e89b-12d3-a456-426614174000',
          question: '',
        };
        
        expect(() => QuestionSchema.parse(invalidQuestion)).toThrow();
      });

      it('should reject question too long', () => {
        const invalidQuestion = {
          documentId: '123e4567-e89b-12d3-a456-426614174000',
          question: 'x'.repeat(1001), // Too long
        };
        
        expect(() => QuestionSchema.parse(invalidQuestion)).toThrow();
      });
    });

    describe('DocumentAnalysisRequestSchema', () => {
      it('should validate valid analysis request', () => {
        const validRequest = {
          documentId: '123e4567-e89b-12d3-a456-426614174000',
          analysisType: 'full' as const,
        };
        
        expect(() => DocumentAnalysisRequestSchema.parse(validRequest)).not.toThrow();
      });

      it('should apply default analysis type', () => {
        const request = {
          documentId: '123e4567-e89b-12d3-a456-426614174000',
        };
        
        const parsed = DocumentAnalysisRequestSchema.parse(request);
        expect(parsed.analysisType).toBe('full');
      });

      it('should reject invalid analysis type', () => {
        const invalidRequest = {
          documentId: '123e4567-e89b-12d3-a456-426614174000',
          analysisType: 'detailed' as any,
        };
        
        expect(() => DocumentAnalysisRequestSchema.parse(invalidRequest)).toThrow();
      });
    });
  });
});