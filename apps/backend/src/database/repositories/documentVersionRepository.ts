import { Pool } from 'pg';
import { DocumentVersion, DocumentComparison } from '@legal-ai/shared';

/**
 * Repository for managing document versions and comparisons
 */
export class DocumentVersionRepository {
  constructor(private db: Pool) {}

  /**
   * Create a new document version
   */
  async createVersion(version: Omit<DocumentVersion, 'id'>): Promise<DocumentVersion> {
    const query = `
      INSERT INTO document_versions (
        document_id, version_number, filename, uploaded_at, 
        metadata, analysis, parent_version_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const values = [
      version.documentId,
      version.versionNumber,
      version.filename,
      version.uploadedAt,
      JSON.stringify(version.metadata),
      version.analysis ? JSON.stringify(version.analysis) : null,
      version.parentVersionId || null,
    ];

    const result = await this.db.query(query, values);
    return this.mapRowToDocumentVersion(result.rows[0]);
  }

  /**
   * Get all versions for a document
   */
  async getVersionsByDocumentId(documentId: string): Promise<DocumentVersion[]> {
    const query = `
      SELECT * FROM document_versions 
      WHERE document_id = $1 
      ORDER BY version_number ASC
    `;

    const result = await this.db.query(query, [documentId]);
    return result.rows.map(row => this.mapRowToDocumentVersion(row));
  }

  /**
   * Get a specific version by ID
   */
  async getVersionById(versionId: string): Promise<DocumentVersion | null> {
    const query = `
      SELECT * FROM document_versions 
      WHERE id = $1
    `;

    const result = await this.db.query(query, [versionId]);
    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToDocumentVersion(result.rows[0]);
  }

  /**
   * Get the latest version for a document
   */
  async getLatestVersion(documentId: string): Promise<DocumentVersion | null> {
    const query = `
      SELECT * FROM document_versions 
      WHERE document_id = $1 
      ORDER BY version_number DESC 
      LIMIT 1
    `;

    const result = await this.db.query(query, [documentId]);
    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToDocumentVersion(result.rows[0]);
  }

  /**
   * Get the next version number for a document
   */
  async getNextVersionNumber(documentId: string): Promise<number> {
    const query = `
      SELECT COALESCE(MAX(version_number), 0) + 1 as next_version
      FROM document_versions 
      WHERE document_id = $1
    `;

    const result = await this.db.query(query, [documentId]);
    return result.rows[0].next_version;
  }

  /**
   * Save a document comparison
   */
  async saveComparison(comparison: DocumentComparison): Promise<void> {
    const query = `
      INSERT INTO document_comparisons (
        id, original_version_id, compared_version_id, compared_at,
        changes, impact_analysis
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `;

    const values = [
      comparison.id,
      comparison.originalVersionId,
      comparison.comparedVersionId,
      comparison.comparedAt,
      JSON.stringify(comparison.changes),
      JSON.stringify(comparison.impactAnalysis),
    ];

    await this.db.query(query, values);
  }

  /**
   * Get a comparison by ID
   */
  async getComparisonById(comparisonId: string): Promise<DocumentComparison | null> {
    const query = `
      SELECT * FROM document_comparisons 
      WHERE id = $1
    `;

    const result = await this.db.query(query, [comparisonId]);
    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToDocumentComparison(result.rows[0]);
  }

  /**
   * Get comparisons between two versions
   */
  async getComparison(
    originalVersionId: string,
    comparedVersionId: string
  ): Promise<DocumentComparison | null> {
    const query = `
      SELECT * FROM document_comparisons 
      WHERE original_version_id = $1 AND compared_version_id = $2
      ORDER BY compared_at DESC
      LIMIT 1
    `;

    const result = await this.db.query(query, [originalVersionId, comparedVersionId]);
    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToDocumentComparison(result.rows[0]);
  }

  /**
   * Get all comparisons for a document
   */
  async getComparisonsByDocumentId(documentId: string): Promise<DocumentComparison[]> {
    const query = `
      SELECT dc.* FROM document_comparisons dc
      JOIN document_versions dv1 ON dc.original_version_id = dv1.id
      JOIN document_versions dv2 ON dc.compared_version_id = dv2.id
      WHERE dv1.document_id = $1 OR dv2.document_id = $1
      ORDER BY dc.compared_at DESC
    `;

    const result = await this.db.query(query, [documentId]);
    return result.rows.map(row => this.mapRowToDocumentComparison(row));
  }

  /**
   * Delete old versions (for cleanup)
   */
  async deleteVersionsOlderThan(date: Date): Promise<number> {
    const query = `
      DELETE FROM document_versions 
      WHERE uploaded_at < $1
    `;

    const result = await this.db.query(query, [date]);
    return result.rowCount || 0;
  }

  /**
   * Delete comparisons older than specified date
   */
  async deleteComparisonsOlderThan(date: Date): Promise<number> {
    const query = `
      DELETE FROM document_comparisons 
      WHERE compared_at < $1
    `;

    const result = await this.db.query(query, [date]);
    return result.rowCount || 0;
  }

  /**
   * Map database row to DocumentVersion object
   */
  private mapRowToDocumentVersion(row: any): DocumentVersion {
    return {
      id: row.id,
      documentId: row.document_id,
      versionNumber: row.version_number,
      filename: row.filename,
      uploadedAt: new Date(row.uploaded_at),
      metadata: JSON.parse(row.metadata),
      analysis: row.analysis ? JSON.parse(row.analysis) : undefined,
      parentVersionId: row.parent_version_id,
    };
  }

  /**
   * Map database row to DocumentComparison object
   */
  private mapRowToDocumentComparison(row: any): DocumentComparison {
    return {
      id: row.id,
      originalVersionId: row.original_version_id,
      comparedVersionId: row.compared_version_id,
      comparedAt: new Date(row.compared_at),
      changes: JSON.parse(row.changes),
      impactAnalysis: JSON.parse(row.impact_analysis),
    };
  }
}

export default DocumentVersionRepository;