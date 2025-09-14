import { Pool } from 'pg';
import { 
  DocumentTemplate, 
  TemplateAnnotation, 
  StandardClause, 
  ClauseAlternative, 
  CustomizationOption,
  TemplateComparison,
  TemplateSearch 
} from '@legal-ai/shared';

export class TemplateRepository {
  constructor(private pool: Pool) {}

  async findTemplates(searchParams: TemplateSearch): Promise<DocumentTemplate[]> {
    let query = `
      SELECT 
        id, name, description, category, industry, jurisdiction,
        template_content, version, created_at, updated_at, is_active,
        download_count, rating, review_count
      FROM document_templates 
      WHERE is_active = true
    `;
    
    const params: any[] = [];
    let paramIndex = 1;

    if (searchParams.category) {
      query += ` AND category = $${paramIndex}`;
      params.push(searchParams.category);
      paramIndex++;
    }

    if (searchParams.industry) {
      query += ` AND $${paramIndex} = ANY(industry)`;
      params.push(searchParams.industry);
      paramIndex++;
    }

    if (searchParams.jurisdiction) {
      query += ` AND $${paramIndex} = ANY(jurisdiction)`;
      params.push(searchParams.jurisdiction);
      paramIndex++;
    }

    if (searchParams.query) {
      query += ` AND (name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
      params.push(`%${searchParams.query}%`);
      paramIndex++;
    }

    query += ` ORDER BY rating DESC, download_count DESC`;
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(searchParams.limit || 20, searchParams.offset || 0);

    const result = await this.pool.query(query, params);
    
    return result.rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      industry: row.industry,
      jurisdiction: row.jurisdiction,
      templateContent: row.template_content,
      annotations: [], // Will be loaded separately if needed
      standardClauses: [], // Will be loaded separately if needed
      customizationOptions: [], // Will be loaded separately if needed
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      isActive: row.is_active,
      usage: {
        downloadCount: row.download_count,
        rating: parseFloat(row.rating),
        reviewCount: row.review_count
      }
    }));
  }

  async findTemplateById(id: string): Promise<DocumentTemplate | null> {
    const templateQuery = `
      SELECT 
        id, name, description, category, industry, jurisdiction,
        template_content, version, created_at, updated_at, is_active,
        download_count, rating, review_count
      FROM document_templates 
      WHERE id = $1 AND is_active = true
    `;

    const templateResult = await this.pool.query(templateQuery, [id]);
    
    if (templateResult.rows.length === 0) {
      return null;
    }

    const template = templateResult.rows[0];

    // Load annotations
    const annotations = await this.getTemplateAnnotations(id);
    
    // Load standard clauses with alternatives
    const standardClauses = await this.getStandardClauses(id);
    
    // Load customization options
    const customizationOptions = await this.getCustomizationOptions(id);

    return {
      id: template.id,
      name: template.name,
      description: template.description,
      category: template.category,
      industry: template.industry,
      jurisdiction: template.jurisdiction,
      templateContent: template.template_content,
      annotations,
      standardClauses,
      customizationOptions,
      version: template.version,
      createdAt: template.created_at,
      updatedAt: template.updated_at,
      isActive: template.is_active,
      usage: {
        downloadCount: template.download_count,
        rating: parseFloat(template.rating),
        reviewCount: template.review_count
      }
    };
  }

  async getTemplateAnnotations(templateId: string): Promise<TemplateAnnotation[]> {
    const query = `
      SELECT 
        id, start_index, end_index, page_number,
        annotation_type, title, content, importance
      FROM template_annotations 
      WHERE template_id = $1
      ORDER BY start_index
    `;

    const result = await this.pool.query(query, [templateId]);
    
    return result.rows.map(row => ({
      id: row.id,
      location: {
        startIndex: row.start_index,
        endIndex: row.end_index,
        pageNumber: row.page_number
      },
      type: row.annotation_type,
      title: row.title,
      content: row.content,
      importance: row.importance
    }));
  }

  async getStandardClauses(templateId: string): Promise<StandardClause[]> {
    const clausesQuery = `
      SELECT 
        id, title, content, category, is_required,
        explanation, risk_level
      FROM standard_clauses 
      WHERE template_id = $1
      ORDER BY title
    `;

    const clausesResult = await this.pool.query(clausesQuery, [templateId]);
    
    const clauses: StandardClause[] = [];
    
    for (const clause of clausesResult.rows) {
      const alternatives = await this.getClauseAlternatives(clause.id);
      
      clauses.push({
        id: clause.id,
        title: clause.title,
        content: clause.content,
        category: clause.category,
        isRequired: clause.is_required,
        alternatives,
        explanation: clause.explanation,
        riskLevel: clause.risk_level
      });
    }

    return clauses;
  }

  async getClauseAlternatives(clauseId: string): Promise<ClauseAlternative[]> {
    const query = `
      SELECT 
        id, title, content, description, favorability, use_case
      FROM clause_alternatives 
      WHERE clause_id = $1
      ORDER BY favorability DESC
    `;

    const result = await this.pool.query(query, [clauseId]);
    
    return result.rows.map(row => ({
      id: row.id,
      title: row.title,
      content: row.content,
      description: row.description,
      favorability: row.favorability,
      useCase: row.use_case
    }));
  }

  async getCustomizationOptions(templateId: string): Promise<CustomizationOption[]> {
    const query = `
      SELECT 
        id, field_name, field_type, label, description,
        required, default_value, options, validation
      FROM customization_options 
      WHERE template_id = $1
      ORDER BY field_name
    `;

    const result = await this.pool.query(query, [templateId]);
    
    return result.rows.map(row => ({
      id: row.id,
      fieldName: row.field_name,
      fieldType: row.field_type,
      label: row.label,
      description: row.description,
      required: row.required,
      defaultValue: row.default_value,
      options: row.options,
      validation: row.validation
    }));
  }

  async createTemplate(template: Omit<DocumentTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usage'>): Promise<string> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Insert template
      const templateQuery = `
        INSERT INTO document_templates 
        (name, description, category, industry, jurisdiction, template_content, version, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `;

      const templateResult = await client.query(templateQuery, [
        template.name,
        template.description,
        template.category,
        template.industry,
        template.jurisdiction,
        template.templateContent,
        template.version,
        template.isActive
      ]);

      const templateId = templateResult.rows[0].id;

      // Insert annotations
      for (const annotation of template.annotations) {
        await client.query(`
          INSERT INTO template_annotations 
          (template_id, start_index, end_index, page_number, annotation_type, title, content, importance)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          templateId,
          annotation.location.startIndex,
          annotation.location.endIndex,
          annotation.location.pageNumber,
          annotation.type,
          annotation.title,
          annotation.content,
          annotation.importance
        ]);
      }

      // Insert standard clauses and alternatives
      for (const clause of template.standardClauses) {
        const clauseResult = await client.query(`
          INSERT INTO standard_clauses 
          (template_id, title, content, category, is_required, explanation, risk_level)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id
        `, [
          templateId,
          clause.title,
          clause.content,
          clause.category,
          clause.isRequired,
          clause.explanation,
          clause.riskLevel
        ]);

        const clauseId = clauseResult.rows[0].id;

        for (const alternative of clause.alternatives) {
          await client.query(`
            INSERT INTO clause_alternatives 
            (clause_id, title, content, description, favorability, use_case)
            VALUES ($1, $2, $3, $4, $5, $6)
          `, [
            clauseId,
            alternative.title,
            alternative.content,
            alternative.description,
            alternative.favorability,
            alternative.useCase
          ]);
        }
      }

      // Insert customization options
      for (const option of template.customizationOptions) {
        await client.query(`
          INSERT INTO customization_options 
          (template_id, field_name, field_type, label, description, required, default_value, options, validation)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          templateId,
          option.fieldName,
          option.fieldType,
          option.label,
          option.description,
          option.required,
          option.defaultValue,
          option.options,
          option.validation
        ]);
      }

      await client.query('COMMIT');
      return templateId;

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async saveTemplateComparison(comparison: Omit<TemplateComparison, 'generatedAt'>): Promise<string> {
    const query = `
      INSERT INTO template_comparisons 
      (template_id, user_document_id, overall_compliance, comparison_result)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `;

    const result = await this.pool.query(query, [
      comparison.templateId,
      comparison.userDocumentId,
      comparison.comparisonResult.overallCompliance,
      JSON.stringify(comparison.comparisonResult)
    ]);

    return result.rows[0].id;
  }

  async trackTemplateUsage(templateId: string, userId: string, action: string): Promise<void> {
    await this.pool.query(`
      INSERT INTO template_usage (template_id, user_id, action)
      VALUES ($1, $2, $3)
    `, [templateId, userId, action]);

    // Update download count if action is download
    if (action === 'download') {
      await this.pool.query(`
        UPDATE document_templates 
        SET download_count = download_count + 1
        WHERE id = $1
      `, [templateId]);
    }
  }

  async getPopularTemplates(limit: number = 10): Promise<DocumentTemplate[]> {
    const query = `
      SELECT 
        id, name, description, category, industry, jurisdiction,
        template_content, version, created_at, updated_at, is_active,
        download_count, rating, review_count
      FROM document_templates 
      WHERE is_active = true
      ORDER BY download_count DESC, rating DESC
      LIMIT $1
    `;

    const result = await this.pool.query(query, [limit]);
    
    return result.rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      industry: row.industry,
      jurisdiction: row.jurisdiction,
      templateContent: row.template_content,
      annotations: [],
      standardClauses: [],
      customizationOptions: [],
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      isActive: row.is_active,
      usage: {
        downloadCount: row.download_count,
        rating: parseFloat(row.rating),
        reviewCount: row.review_count
      }
    }));
  }
}