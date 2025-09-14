import { TemplateService } from '../../services/templateService';
import { TemplateRepository } from '../../database/repositories/templateRepository';
import { DocumentRepository } from '../../database/repositories/document.repository';
import { AIAnalysisService } from '../../services/aiAnalysis';
import { DocumentTemplate, Document, TemplateCustomization } from '@legal-ai/shared';

// Mock dependencies
jest.mock('../../database/repositories/templateRepository');
jest.mock('../../database/repositories/document.repository');
jest.mock('../../services/aiAnalysis');

const mockTemplateRepository = new TemplateRepository({} as any) as jest.Mocked<TemplateRepository>;
const mockDocumentRepository = new DocumentRepository({} as any) as jest.Mocked<DocumentRepository>;
const mockAIAnalysisService = new AIAnalysisService() as jest.Mocked<AIAnalysisService>;

describe('TemplateService', () => {
  let templateService: TemplateService;

  beforeEach(() => {
    jest.clearAllMocks();
    templateService = new TemplateService(
      mockTemplateRepository,
      mockDocumentRepository,
      mockAIAnalysisService
    );
  });

  describe('searchTemplates', () => {
    it('should return templates matching search criteria', async () => {
      const mockTemplates: DocumentTemplate[] = [
        {
          id: '1',
          name: 'Service Agreement',
          description: 'Standard service agreement',
          category: 'contract',
          industry: ['Technology'],
          jurisdiction: ['US'],
          templateContent: 'Template content...',
          annotations: [],
          standardClauses: [],
          customizationOptions: [],
          version: '1.0',
          createdAt: new Date(),
          updatedAt: new Date(),
          isActive: true,
          usage: { downloadCount: 10, rating: 4.5, reviewCount: 5 }
        }
      ];

      mockTemplateRepository.findTemplates.mockResolvedValue(mockTemplates);

      const searchParams = { category: 'contract' as const, limit: 20, offset: 0 };
      const result = await templateService.searchTemplates(searchParams);

      expect(result).toEqual(mockTemplates);
      expect(mockTemplateRepository.findTemplates).toHaveBeenCalledWith(searchParams);
    });
  });

  describe('getTemplateById', () => {
    it('should return template by ID', async () => {
      const mockTemplate: DocumentTemplate = {
        id: '1',
        name: 'Service Agreement',
        description: 'Standard service agreement',
        category: 'contract',
        industry: ['Technology'],
        jurisdiction: ['US'],
        templateContent: 'Template content with {{field1}} and {{field2}}',
        annotations: [],
        standardClauses: [],
        customizationOptions: [
          {
            id: '1',
            fieldName: 'field1',
            fieldType: 'text',
            label: 'Field 1',
            description: 'First field',
            required: true
          }
        ],
        version: '1.0',
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
        usage: { downloadCount: 10, rating: 4.5, reviewCount: 5 }
      };

      mockTemplateRepository.findTemplateById.mockResolvedValue(mockTemplate);

      const result = await templateService.getTemplateById('1');

      expect(result).toEqual(mockTemplate);
      expect(mockTemplateRepository.findTemplateById).toHaveBeenCalledWith('1');
    });

    it('should return null if template not found', async () => {
      mockTemplateRepository.findTemplateById.mockResolvedValue(null);

      const result = await templateService.getTemplateById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('customizeTemplate', () => {
    const mockTemplate: DocumentTemplate = {
      id: '1',
      name: 'Service Agreement',
      description: 'Standard service agreement',
      category: 'contract',
      industry: ['Technology'],
      jurisdiction: ['US'],
      templateContent: 'Agreement between {{client_name}} and {{provider_name}} for {{service_type}}.',
      annotations: [],
      standardClauses: [],
      customizationOptions: [
        {
          id: '1',
          fieldName: 'client_name',
          fieldType: 'text',
          label: 'Client Name',
          description: 'Name of the client',
          required: true,
          validation: { minLength: 2, maxLength: 100 }
        },
        {
          id: '2',
          fieldName: 'provider_name',
          fieldType: 'text',
          label: 'Provider Name',
          description: 'Name of the service provider',
          required: true
        },
        {
          id: '3',
          fieldName: 'service_type',
          fieldType: 'select',
          label: 'Service Type',
          description: 'Type of service',
          required: false,
          options: ['Consulting', 'Development', 'Support'],
          defaultValue: 'Consulting',
          validation: {}
        }
      ],
      version: '1.0',
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
      usage: { downloadCount: 10, rating: 4.5, reviewCount: 5 }
    };

    beforeEach(() => {
      mockTemplateRepository.findTemplateById.mockResolvedValue(mockTemplate);
    });

    it('should customize template with provided values', async () => {
      const customization: TemplateCustomization = {
        templateId: '1',
        customizations: {
          client_name: 'Acme Corp',
          provider_name: 'Tech Solutions Inc',
          service_type: 'Development'
        }
      };

      const result = await templateService.customizeTemplate(customization);

      expect(result).toBe('Agreement between Acme Corp and Tech Solutions Inc for Development.');
    });

    it('should use default values for optional fields', async () => {
      const customization: TemplateCustomization = {
        templateId: '1',
        customizations: {
          client_name: 'Acme Corp',
          provider_name: 'Tech Solutions Inc'
          // service_type not provided, should use default
        }
      };

      const result = await templateService.customizeTemplate(customization);

      expect(result).toBe('Agreement between Acme Corp and Tech Solutions Inc for Consulting.');
    });

    it('should throw error for missing required fields', async () => {
      const customization: TemplateCustomization = {
        templateId: '1',
        customizations: {
          client_name: 'Acme Corp'
          // provider_name is required but missing
        }
      };

      await expect(templateService.customizeTemplate(customization))
        .rejects.toThrow('Required field provider_name is missing');
    });

    it('should validate field values according to validation rules', async () => {
      const customization: TemplateCustomization = {
        templateId: '1',
        customizations: {
          client_name: 'A', // Too short (minLength: 2)
          provider_name: 'Tech Solutions Inc'
        }
      };

      await expect(templateService.customizeTemplate(customization))
        .rejects.toThrow('Field client_name must be at least 2 characters');
    });

    it('should validate select field options', async () => {
      const customization: TemplateCustomization = {
        templateId: '1',
        customizations: {
          client_name: 'Acme Corp',
          provider_name: 'Tech Solutions Inc',
          service_type: 'InvalidOption'
        }
      };

      await expect(templateService.customizeTemplate(customization))
        .rejects.toThrow('Field service_type must be one of: Consulting, Development, Support');
    });

    it('should throw error if template not found', async () => {
      mockTemplateRepository.findTemplateById.mockResolvedValue(null);

      const customization: TemplateCustomization = {
        templateId: 'nonexistent',
        customizations: {}
      };

      await expect(templateService.customizeTemplate(customization))
        .rejects.toThrow('Template not found');
    });
  });

  describe('compareWithTemplate', () => {
    const mockTemplate: DocumentTemplate = {
      id: '1',
      name: 'Service Agreement',
      description: 'Standard service agreement',
      category: 'contract',
      industry: ['Technology'],
      jurisdiction: ['US'],
      templateContent: 'Standard template content...',
      annotations: [],
      standardClauses: [
        {
          id: '1',
          title: 'Liability Clause',
          content: 'Standard liability clause',
          category: 'liability',
          isRequired: true,
          alternatives: [],
          explanation: 'Limits liability',
          riskLevel: 'medium'
        }
      ],
      customizationOptions: [],
      version: '1.0',
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
      usage: { downloadCount: 10, rating: 4.5, reviewCount: 5 }
    };

    const mockDocument: Document = {
      id: 'doc1',
      userId: 'user1',
      filename: 'contract.pdf',
      documentType: 'contract',
      jurisdiction: 'US',
      uploadedAt: new Date(),
      expiresAt: new Date(),
      status: 'analyzed',
      metadata: {
        pageCount: 5,
        wordCount: 1000,
        language: 'en',
        extractedText: 'User document content...'
      }
    };

    beforeEach(() => {
      mockTemplateRepository.findTemplateById.mockResolvedValue(mockTemplate);
      mockDocumentRepository.findById.mockResolvedValue(mockDocument);
      mockTemplateRepository.trackTemplateUsage.mockResolvedValue();
      mockTemplateRepository.saveTemplateComparison.mockResolvedValue('comparison1');
    });

    it('should perform AI-powered template comparison', async () => {
      const mockAIResponse = JSON.stringify({
        overallCompliance: 85,
        missingClauses: [],
        deviations: [],
        recommendations: ['Review with legal counsel'],
        riskAssessment: {
          increasedrisk: false,
          riskFactors: []
        }
      });

      mockAIAnalysisService.analyzeDocument.mockResolvedValue(mockAIResponse);

      const result = await templateService.compareWithTemplate('1', 'doc1', 'user1');

      expect(result.comparisonResult.overallCompliance).toBe(85);
      expect(mockTemplateRepository.trackTemplateUsage).toHaveBeenCalledWith('1', 'user1', 'compare');
      expect(mockTemplateRepository.saveTemplateComparison).toHaveBeenCalled();
    });

    it('should fallback to basic comparison if AI fails', async () => {
      mockAIAnalysisService.analyzeDocument.mockRejectedValue(new Error('AI service unavailable'));

      const result = await templateService.compareWithTemplate('1', 'doc1', 'user1');

      expect(result.comparisonResult.overallCompliance).toBeGreaterThanOrEqual(0);
      expect(result.comparisonResult.overallCompliance).toBeLessThanOrEqual(100);
      expect(result.comparisonResult.recommendations).toContain('Consider reviewing the document with a legal professional');
    });

    it('should throw error if template not found', async () => {
      mockTemplateRepository.findTemplateById.mockResolvedValue(null);

      await expect(templateService.compareWithTemplate('nonexistent', 'doc1', 'user1'))
        .rejects.toThrow('Template not found');
    });

    it('should throw error if document not found', async () => {
      mockDocumentRepository.findById.mockResolvedValue(null);

      await expect(templateService.compareWithTemplate('1', 'nonexistent', 'user1'))
        .rejects.toThrow('Document not found');
    });
  });

  describe('downloadTemplate', () => {
    it('should track download and return template', async () => {
      const mockTemplate: DocumentTemplate = {
        id: '1',
        name: 'Service Agreement',
        description: 'Standard service agreement',
        category: 'contract',
        industry: ['Technology'],
        jurisdiction: ['US'],
        templateContent: 'Template content...',
        annotations: [],
        standardClauses: [],
        customizationOptions: [],
        version: '1.0',
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
        usage: { downloadCount: 10, rating: 4.5, reviewCount: 5 }
      };

      mockTemplateRepository.findTemplateById.mockResolvedValue(mockTemplate);
      mockTemplateRepository.trackTemplateUsage.mockResolvedValue();

      const result = await templateService.downloadTemplate('1', 'user1');

      expect(result).toEqual(mockTemplate);
      expect(mockTemplateRepository.trackTemplateUsage).toHaveBeenCalledWith('1', 'user1', 'download');
    });

    it('should throw error if template not found', async () => {
      mockTemplateRepository.findTemplateById.mockResolvedValue(null);

      await expect(templateService.downloadTemplate('nonexistent', 'user1'))
        .rejects.toThrow('Template not found');
    });
  });
});