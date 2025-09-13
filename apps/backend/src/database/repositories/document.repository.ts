import { Document, DocumentMetadata, DocumentAnalysis } from '@legal-ai/shared';
import { BaseRepository } from './base.repository';

export interface CreateDocumentData {
  userId: string;
  filename: string;
  documentType: Document['documentType'];
  jurisdiction?: string;
  expiresAt: Date;
  metadata: DocumentMetadata;
}

export interface UpdateDocumentData {
  status?: Document['status'];
  analysis?: DocumentAnalysis;
}

export class DocumentRepository extends BaseRepository {
  async create(documentData: CreateDocumentData): Promise<Document> {
    return await this.transaction(async (client) => {
      // Create document
      const documentResult = await client.query(
        `INSERT INTO documents (user_id, filename, document_type, jurisdiction, expires_at, status)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, user_id, filename, document_type, jurisdiction, status, uploaded_at, expires_at, created_at, updated_at`,
        [
          documentData.userId,
          documentData.filename,
          documentData.documentType,
          documentData.jurisdiction,
          documentData.expiresAt,
          'processing',
        ]
      );

      const document = documentResult.rows[0];

      // Create document metadata
      await client.query(
        `INSERT INTO document_metadata (document_id, page_count, word_count, language, extracted_text)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          document.id,
          documentData.metadata.pageCount,
          documentData.metadata.wordCount,
          documentData.metadata.language,
          documentData.metadata.extractedText,
        ]
      );

      return await this.findById(document.id);
    });
  }

  async findById(id: string): Promise<Document | null> {
    const result = await this.query(
      `SELECT 
        d.id, d.user_id, d.filename, d.document_type, d.jurisdiction, d.status,
        d.uploaded_at, d.expires_at, d.created_at, d.updated_at,
        dm.page_count, dm.word_count, dm.language, dm.extracted_text,
        da.summary, da.risk_score, da.generated_at
       FROM documents d
       JOIN document_metadata dm ON d.id = dm.document_id
       LEFT JOIN document_analysis da ON d.id = da.document_id
       WHERE d.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return await this.mapRowToDocument(row);
  }

  async findByUserId(userId: string, limit: number = 50, offset: number = 0): Promise<Document[]> {
    const result = await this.query(
      `SELECT 
        d.id, d.user_id, d.filename, d.document_type, d.jurisdiction, d.status,
        d.uploaded_at, d.expires_at, d.created_at, d.updated_at,
        dm.page_count, dm.word_count, dm.language, dm.extracted_text,
        da.summary, da.risk_score, da.generated_at
       FROM documents d
       JOIN document_metadata dm ON d.id = dm.document_id
       LEFT JOIN document_analysis da ON d.id = da.document_id
       WHERE d.user_id = $1
       ORDER BY d.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    const documents = await Promise.all(
      result.rows.map(row => this.mapRowToDocument(row))
    );

    return documents;
  }

  async update(id: string, updateData: UpdateDocumentData): Promise<Document | null> {
    return await this.transaction(async (client) => {
      // Update document status if provided
      if (updateData.status) {
        await client.query(
          'UPDATE documents SET status = $1, updated_at = NOW() WHERE id = $2',
          [updateData.status, id]
        );
      }

      // Create or update analysis if provided
      if (updateData.analysis) {
        const analysis = updateData.analysis;

        // Insert or update document analysis
        await client.query(
          `INSERT INTO document_analysis (document_id, summary, risk_score, generated_at)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (document_id) 
           DO UPDATE SET summary = $2, risk_score = $3, generated_at = $4`,
          [id, analysis.summary, analysis.riskScore, analysis.generatedAt]
        );

        // Delete existing related data
        await client.query('DELETE FROM key_terms WHERE document_id = $1', [id]);
        await client.query('DELETE FROM risks WHERE document_id = $1', [id]);
        await client.query('DELETE FROM clauses WHERE document_id = $1', [id]);
        await client.query('DELETE FROM recommendations WHERE document_id = $1', [id]);

        // Insert key terms
        for (const keyTerm of analysis.keyTerms) {
          await client.query(
            `INSERT INTO key_terms (document_id, term, definition, importance, start_index, end_index, page_number)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              id,
              keyTerm.term,
              keyTerm.definition,
              keyTerm.importance,
              keyTerm.location.startIndex,
              keyTerm.location.endIndex,
              keyTerm.location.pageNumber,
            ]
          );
        }

        // Insert risks
        for (const risk of analysis.risks) {
          await client.query(
            `INSERT INTO risks (document_id, category, severity, description, affected_clause, recommendation)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [id, risk.category, risk.severity, risk.description, risk.affectedClause, risk.recommendation]
          );
        }

        // Insert clauses
        for (const clause of analysis.clauses) {
          await client.query(
            `INSERT INTO clauses (id, document_id, title, content, start_index, end_index, page_number, risk_level, explanation)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              clause.id,
              id,
              clause.title,
              clause.content,
              clause.location.startIndex,
              clause.location.endIndex,
              clause.location.pageNumber,
              clause.riskLevel,
              clause.explanation,
            ]
          );
        }

        // Insert recommendations
        for (let i = 0; i < analysis.recommendations.length; i++) {
          await client.query(
            'INSERT INTO recommendations (document_id, recommendation, priority) VALUES ($1, $2, $3)',
            [id, analysis.recommendations[i], i + 1]
          );
        }
      }

      return await this.findById(id);
    });
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.query('DELETE FROM documents WHERE id = $1', [id]);
    return result.rowCount > 0;
  }

  async findExpiredDocuments(): Promise<string[]> {
    const result = await this.query(
      'SELECT id FROM documents WHERE expires_at < NOW()',
      []
    );
    return result.rows.map((row: any) => row.id);
  }

  async deleteExpiredDocuments(): Promise<number> {
    const result = await this.query(
      'DELETE FROM documents WHERE expires_at < NOW()',
      []
    );
    return result.rowCount;
  }

  private async mapRowToDocument(row: any): Promise<Document> {
    const document: Document = {
      id: row.id,
      userId: row.user_id,
      filename: row.filename,
      documentType: row.document_type,
      jurisdiction: row.jurisdiction,
      uploadedAt: row.uploaded_at,
      expiresAt: row.expires_at,
      status: row.status,
      metadata: {
        pageCount: row.page_count,
        wordCount: row.word_count,
        language: row.language,
        extractedText: row.extracted_text,
      },
    };

    // Add analysis if it exists
    if (row.summary) {
      // Fetch related analysis data
      const [keyTermsResult, risksResult, clausesResult, recommendationsResult] = await Promise.all([
        this.query('SELECT * FROM key_terms WHERE document_id = $1 ORDER BY start_index', [row.id]),
        this.query('SELECT * FROM risks WHERE document_id = $1', [row.id]),
        this.query('SELECT * FROM clauses WHERE document_id = $1 ORDER BY start_index', [row.id]),
        this.query('SELECT * FROM recommendations WHERE document_id = $1 ORDER BY priority', [row.id]),
      ]);

      document.analysis = {
        summary: row.summary,
        riskScore: row.risk_score,
        keyTerms: keyTermsResult.rows.map((kt: any) => ({
          term: kt.term,
          definition: kt.definition,
          importance: kt.importance,
          location: {
            startIndex: kt.start_index,
            endIndex: kt.end_index,
            pageNumber: kt.page_number,
          },
        })),
        risks: risksResult.rows.map((r: any) => ({
          category: r.category,
          severity: r.severity,
          description: r.description,
          affectedClause: r.affected_clause,
          recommendation: r.recommendation,
        })),
        clauses: clausesResult.rows.map((c: any) => ({
          id: c.id,
          title: c.title,
          content: c.content,
          location: {
            startIndex: c.start_index,
            endIndex: c.end_index,
            pageNumber: c.page_number,
          },
          riskLevel: c.risk_level,
          explanation: c.explanation,
        })),
        recommendations: recommendationsResult.rows.map((r: any) => r.recommendation),
        generatedAt: row.generated_at,
      };
    }

    return document;
  }
}