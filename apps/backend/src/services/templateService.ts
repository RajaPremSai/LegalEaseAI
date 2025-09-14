import { 
  DocumentTemplate, 
  TemplateSearch, 
  TemplateComparison, 
  TemplateCustomization,
  Document,
  MissingClause,
  TemplateDeviation
} from '@legal-ai/shared';
import { TemplateRepository } from '../database/repositories/templateRepository';
import { DocumentRepository } from '../database/repositories/document.repository';
import { AIAnalysisService } from './aiAnalysis';

export class TemplateService {
  constructor(
    private templateRepository: TemplateRepository,
    private documentRepository: DocumentRepository,
    private aiAnalysisService: AIAnalysisService
  ) {}

  async searchTemplates(searchParams: TemplateSearch): Promise<DocumentTemplate[]> {
    return this.templateRepository.findTemplates(searchParams);
  }

  async getTemplateById(id: string): Promise<DocumentTemplate | null> {
    return this.templateRepository.findTemplateById(id);
  }

  async getPopularTemplates(limit: number = 10): Promise<DocumentTemplate[]> {
    return this.templateRepository.getPopularTemplates(limit);
  }

  async customizeTemplate(customization: TemplateCustomization): Promise<string> {
    const template = await this.templateRepository.findTemplateById(customization.templateId);
    
    if (!template) {
      throw new Error('Template not found');
    }

    // Validate customization values against template options
    this.validateCustomizations(template, customization.customizations);

    // Apply customizations to template content
    let customizedContent = template.templateContent;
    
    for (const option of template.customizationOptions) {
      const value = customization.customizations[option.fieldName];
      
      if (value !== undefined) {
        // Replace placeholder in template content
        const placeholder = `{{${option.fieldName}}}`;
        const replacementValue = this.formatCustomizationValue(option.fieldType, value);
        customizedContent = customizedContent.replace(new RegExp(placeholder, 'g'), replacementValue);
      } else if (option.required) {
        throw new Error(`Required field ${option.fieldName} is missing`);
      } else if (option.defaultValue !== undefined) {
        // Use default value
        const placeholder = `{{${option.fieldName}}}`;
        const replacementValue = this.formatCustomizationValue(option.fieldType, option.defaultValue);
        customizedContent = customizedContent.replace(new RegExp(placeholder, 'g'), replacementValue);
      }
    }

    return customizedContent;
  }

  async compareWithTemplate(templateId: string, documentId: string, userId: string): Promise<TemplateComparison> {
    const template = await this.templateRepository.findTemplateById(templateId);
    const document = await this.documentRepository.findById(documentId);

    if (!template) {
      throw new Error('Template not found');
    }

    if (!document) {
      throw new Error('Document not found');
    }

    // Track usage
    await this.templateRepository.trackTemplateUsage(templateId, userId, 'compare');

    // Perform AI-powered comparison
    const comparisonResult = await this.performTemplateComparison(template, document);

    const comparison: TemplateComparison = {
      templateId,
      userDocumentId: documentId,
      comparisonResult,
      generatedAt: new Date()
    };

    // Save comparison result
    await this.templateRepository.saveTemplateComparison(comparison);

    return comparison;
  }

  private validateCustomizations(template: DocumentTemplate, customizations: Record<string, any>): void {
    for (const option of template.customizationOptions) {
      const value = customizations[option.fieldName];
      
      if (option.required && (value === undefined || value === null || value === '')) {
        throw new Error(`Required field ${option.fieldName} is missing`);
      }

      if (value !== undefined) {
        this.validateFieldValue(option, value);
      }
    }
  }

  private validateFieldValue(option: any, value: any): void {
    const validation = option.validation || {};

    switch (option.fieldType) {
      case 'text':
        if (typeof value !== 'string') {
          throw new Error(`Field ${option.fieldName} must be a string`);
        }
        if (validation.minLength && value.length < validation.minLength) {
          throw new Error(`Field ${option.fieldName} must be at least ${validation.minLength} characters`);
        }
        if (validation.maxLength && value.length > validation.maxLength) {
          throw new Error(`Field ${option.fieldName} must be at most ${validation.maxLength} characters`);
        }
        if (validation.pattern && !new RegExp(validation.pattern).test(value)) {
          throw new Error(`Field ${option.fieldName} does not match required pattern`);
        }
        break;

      case 'number':
        if (typeof value !== 'number') {
          throw new Error(`Field ${option.fieldName} must be a number`);
        }
        if (validation.min !== undefined && value < validation.min) {
          throw new Error(`Field ${option.fieldName} must be at least ${validation.min}`);
        }
        if (validation.max !== undefined && value > validation.max) {
          throw new Error(`Field ${option.fieldName} must be at most ${validation.max}`);
        }
        break;

      case 'select':
        if (option.options && !option.options.includes(value)) {
          throw new Error(`Field ${option.fieldName} must be one of: ${option.options.join(', ')}`);
        }
        break;

      case 'multiselect':
        if (!Array.isArray(value)) {
          throw new Error(`Field ${option.fieldName} must be an array`);
        }
        for (const item of value) {
          if (!option.options || !option.options.includes(item)) {
            throw new Error(`Field ${option.fieldName} contains invalid option: ${item}`);
          }
        }
        break;

      case 'boolean':
        if (typeof value !== 'boolean') {
          throw new Error(`Field ${option.fieldName} must be a boolean`);
        }
        break;

      case 'date':
        if (!(value instanceof Date) && typeof value !== 'string') {
          throw new Error(`Field ${option.fieldName} must be a valid date`);
        }
        break;
    }
  }

  private formatCustomizationValue(fieldType: string, value: any): string {
    switch (fieldType) {
      case 'date':
        if (value instanceof Date) {
          return value.toLocaleDateString();
        }
        return new Date(value).toLocaleDateString();
      
      case 'multiselect':
        if (Array.isArray(value)) {
          return value.join(', ');
        }
        return String(value);
      
      case 'boolean':
        return value ? 'Yes' : 'No';
      
      default:
        return String(value);
    }
  }

  private async performTemplateComparison(template: DocumentTemplate, document: Document): Promise<TemplateComparison['comparisonResult']> {
    // Use AI to analyze document against template
    const prompt = `
      Compare the following user document with the standard template and identify:
      1. Missing clauses that should be present
      2. Deviations from standard language
      3. Overall compliance percentage
      4. Risk factors introduced by deviations

      Template: ${template.templateContent}
      
      User Document: ${document.metadata.extractedText}
      
      Standard Clauses: ${JSON.stringify(template.standardClauses.map(c => ({
        title: c.title,
        content: c.content,
        category: c.category,
        isRequired: c.isRequired
      })))}

      Provide analysis in the following JSON format:
      {
        "overallCompliance": number (0-100),
        "missingClauses": [
          {
            "clauseId": "string",
            "title": "string", 
            "importance": "critical|recommended|optional",
            "description": "string",
            "suggestedContent": "string"
          }
        ],
        "deviations": [
          {
            "location": {"startIndex": number, "endIndex": number},
            "templateClause": "string",
            "userClause": "string", 
            "deviationType": "missing|modified|additional",
            "severity": "high|medium|low",
            "explanation": "string",
            "recommendation": "string"
          }
        ],
        "recommendations": ["string"],
        "riskAssessment": {
          "increasedrisk": boolean,
          "riskFactors": ["string"]
        }
      }
    `;

    try {
      const aiResponse = await this.aiAnalysisService.analyzeDocument(prompt);
      const analysis = JSON.parse(aiResponse);

      // Validate and sanitize the AI response
      return {
        overallCompliance: Math.max(0, Math.min(100, analysis.overallCompliance || 0)),
        missingClauses: this.sanitizeMissingClauses(analysis.missingClauses || []),
        deviations: this.sanitizeDeviations(analysis.deviations || []),
        recommendations: (analysis.recommendations || []).slice(0, 10), // Limit recommendations
        riskAssessment: {
          increasedrisk: Boolean(analysis.riskAssessment?.increasedrisk),
          riskFactors: (analysis.riskAssessment?.riskFactors || []).slice(0, 5)
        }
      };
    } catch (error) {
      console.error('Error in AI template comparison:', error);
      
      // Fallback to basic text comparison
      return this.performBasicTemplateComparison(template, document);
    }
  }

  private sanitizeMissingClauses(clauses: any[]): MissingClause[] {
    return clauses.map(clause => ({
      clauseId: String(clause.clauseId || ''),
      title: String(clause.title || '').substring(0, 200),
      importance: ['critical', 'recommended', 'optional'].includes(clause.importance) 
        ? clause.importance : 'recommended',
      description: String(clause.description || '').substring(0, 500),
      suggestedContent: String(clause.suggestedContent || '').substring(0, 1000)
    })).slice(0, 20); // Limit to 20 missing clauses
  }

  private sanitizeDeviations(deviations: any[]): TemplateDeviation[] {
    return deviations.map(deviation => ({
      location: {
        startIndex: Math.max(0, Number(deviation.location?.startIndex) || 0),
        endIndex: Math.max(0, Number(deviation.location?.endIndex) || 0)
      },
      templateClause: String(deviation.templateClause || '').substring(0, 500),
      userClause: String(deviation.userClause || '').substring(0, 500),
      deviationType: ['missing', 'modified', 'additional'].includes(deviation.deviationType)
        ? deviation.deviationType : 'modified',
      severity: ['high', 'medium', 'low'].includes(deviation.severity)
        ? deviation.severity : 'medium',
      explanation: String(deviation.explanation || '').substring(0, 500),
      recommendation: String(deviation.recommendation || '').substring(0, 500)
    })).slice(0, 50); // Limit to 50 deviations
  }

  private performBasicTemplateComparison(template: DocumentTemplate, document: Document): TemplateComparison['comparisonResult'] {
    // Basic fallback comparison using text similarity
    const templateText = template.templateContent.toLowerCase();
    const documentText = document.metadata.extractedText.toLowerCase();

    // Simple keyword matching for compliance estimation
    const templateWords = new Set(templateText.split(/\s+/));
    const documentWords = new Set(documentText.split(/\s+/));
    
    const commonWords = new Set([...templateWords].filter(word => documentWords.has(word)));
    const compliance = Math.round((commonWords.size / templateWords.size) * 100);

    // Check for missing required clauses
    const missingClauses: MissingClause[] = template.standardClauses
      .filter(clause => clause.isRequired)
      .filter(clause => !documentText.includes(clause.title.toLowerCase()))
      .map(clause => ({
        clauseId: clause.id,
        title: clause.title,
        importance: 'critical' as const,
        description: `Required clause "${clause.title}" appears to be missing from the document.`,
        suggestedContent: clause.content
      }));

    return {
      overallCompliance: compliance,
      missingClauses,
      deviations: [],
      recommendations: [
        'Consider reviewing the document with a legal professional',
        'Ensure all required clauses are properly included',
        'Verify that the document meets industry standards'
      ],
      riskAssessment: {
        increasedrisk: missingClauses.length > 0 || compliance < 70,
        riskFactors: missingClauses.length > 0 
          ? ['Missing required clauses', 'Low compliance with template standards']
          : []
      }
    };
  }

  async downloadTemplate(templateId: string, userId: string): Promise<DocumentTemplate> {
    const template = await this.templateRepository.findTemplateById(templateId);
    
    if (!template) {
      throw new Error('Template not found');
    }

    // Track download
    await this.templateRepository.trackTemplateUsage(templateId, userId, 'download');

    return template;
  }
}