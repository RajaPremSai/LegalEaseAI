import { Pool } from 'pg';
import { 
  BulkProcessingJob, 
  BulkDocument, 
  CreateBulkJob,
  BulkProcessingSettings,
  BulkProcessingResults
} from '@legal-ai/shared';

export class BulkProcessingRepository {
  constructor(private pool: Pool) {}

  async createBulkJob(workspaceId: string, userId: string, jobData: CreateBulkJob): Promise<BulkProcessingJob> {
    const result = await this.pool.query(`
      INSERT INTO bulk_processing_jobs (workspace_id, user_id, name, description, settings)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [
      workspaceId,
      userId,
      jobData.name,
      jobData.description || null,
      JSON.stringify(jobData.settings || {})
    ]);

    return this.mapRowToBulkJob(result.rows[0]);
  }

  async findBulkJobById(id: string): Promise<BulkProcessingJob | null> {
    const result = await this.pool.query(`
      SELECT * FROM bulk_processing_jobs WHERE id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    const job = this.mapRowToBulkJob(result.rows[0]);
    job.documents = await this.getBulkDocuments(id);
    return job;
  }

  async findBulkJobsByWorkspace(workspaceId: string, limit: number = 50, offset: number = 0): Promise<BulkProcessingJob[]> {
    const result = await this.pool.query(`
      SELECT * FROM bulk_processing_jobs 
      WHERE workspace_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `, [workspaceId, limit, offset]);

    const jobs = result.rows.map(row => this.mapRowToBulkJob(row));
    
    // Load documents for each job
    for (const job of jobs) {
      job.documents = await this.getBulkDocuments(job.id);
    }

    return jobs;
  }

  async findBulkJobsByUser(userId: string, limit: number = 50, offset: number = 0): Promise<BulkProcessingJob[]> {
    const result = await this.pool.query(`
      SELECT * FROM bulk_processing_jobs 
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `, [userId, limit, offset]);

    const jobs = result.rows.map(row => this.mapRowToBulkJob(row));
    
    // Load documents for each job
    for (const job of jobs) {
      job.documents = await this.getBulkDocuments(job.id);
    }

    return jobs;
  }

  async updateBulkJobStatus(id: string, status: BulkProcessingJob['status'], error?: string): Promise<void> {
    const updateFields = ['status = $2'];
    const values = [id, status];
    let paramIndex = 3;

    if (status === 'processing' && !error) {
      updateFields.push(`started_at = NOW()`);
    } else if ((status === 'completed' || status === 'failed') && !error) {
      updateFields.push(`completed_at = NOW()`);
    }

    if (error) {
      updateFields.push(`error = $${paramIndex}`);
      values.push(error);
      paramIndex++;
    }

    await this.pool.query(`
      UPDATE bulk_processing_jobs 
      SET ${updateFields.join(', ')}
      WHERE id = $1
    `, values);
  }

  async updateBulkJobProgress(id: string, progress: BulkProcessingJob['progress']): Promise<void> {
    await this.pool.query(`
      UPDATE bulk_processing_jobs 
      SET progress = $2
      WHERE id = $1
    `, [id, JSON.stringify(progress)]);
  }

  async updateBulkJobResults(id: string, results: BulkProcessingResults): Promise<void> {
    await this.pool.query(`
      UPDATE bulk_processing_jobs 
      SET results = $2, completed_at = NOW()
      WHERE id = $1
    `, [id, JSON.stringify(results)]);
  }

  async addBulkDocument(jobId: string, document: Omit<BulkDocument, 'id' | 'status'>): Promise<BulkDocument> {
    const result = await this.pool.query(`
      INSERT INTO bulk_documents (job_id, filename, file_size)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [jobId, document.filename, document.size]);

    return this.mapRowToBulkDocument(result.rows[0]);
  }

  async updateBulkDocument(id: string, updates: Partial<BulkDocument>): Promise<void> {
    const setParts: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.status !== undefined) {
      setParts.push(`status = $${paramIndex}`);
      values.push(updates.status);
      paramIndex++;
    }

    if (updates.documentId !== undefined) {
      setParts.push(`document_id = $${paramIndex}`);
      values.push(updates.documentId);
      paramIndex++;
    }

    if (updates.error !== undefined) {
      setParts.push(`error = $${paramIndex}`);
      values.push(updates.error);
      paramIndex++;
    }

    if (setParts.length === 0) {
      return;
    }

    values.push(id);
    await this.pool.query(`
      UPDATE bulk_documents 
      SET ${setParts.join(', ')}
      WHERE id = $${paramIndex}
    `, values);
  }

  async getBulkDocuments(jobId: string): Promise<BulkDocument[]> {
    const result = await this.pool.query(`
      SELECT * FROM bulk_documents 
      WHERE job_id = $1
      ORDER BY created_at
    `, [jobId]);

    return result.rows.map(row => this.mapRowToBulkDocument(row));
  }

  async getPendingJobs(): Promise<BulkProcessingJob[]> {
    const result = await this.pool.query(`
      SELECT * FROM bulk_processing_jobs 
      WHERE status = 'pending'
      ORDER BY created_at
    `);

    const jobs = result.rows.map(row => this.mapRowToBulkJob(row));
    
    // Load documents for each job
    for (const job of jobs) {
      job.documents = await this.getBulkDocuments(job.id);
    }

    return jobs;
  }

  async cancelBulkJob(id: string): Promise<boolean> {
    const result = await this.pool.query(`
      UPDATE bulk_processing_jobs 
      SET status = 'cancelled', completed_at = NOW()
      WHERE id = $1 AND status IN ('pending', 'processing')
    `, [id]);

    return result.rowCount > 0;
  }

  async deleteBulkJob(id: string): Promise<boolean> {
    const result = await this.pool.query(`
      DELETE FROM bulk_processing_jobs WHERE id = $1
    `, [id]);

    return result.rowCount > 0;
  }

  async getJobStatistics(workspaceId: string, days: number = 30): Promise<any> {
    const result = await this.pool.query(`
      SELECT 
        COUNT(*) as total_jobs,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_jobs,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_jobs,
        COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing_jobs,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_jobs,
        AVG(CASE WHEN completed_at IS NOT NULL AND started_at IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (completed_at - started_at)) END) as avg_processing_time
      FROM bulk_processing_jobs 
      WHERE workspace_id = $1 
      AND created_at >= NOW() - INTERVAL '$2 days'
    `, [workspaceId, days]);

    const docResult = await this.pool.query(`
      SELECT 
        COUNT(*) as total_documents,
        COUNT(CASE WHEN bd.status = 'completed' THEN 1 END) as processed_documents,
        COUNT(CASE WHEN bd.status = 'failed' THEN 1 END) as failed_documents
      FROM bulk_documents bd
      JOIN bulk_processing_jobs bpj ON bd.job_id = bpj.id
      WHERE bpj.workspace_id = $1 
      AND bd.created_at >= NOW() - INTERVAL '$2 days'
    `, [workspaceId, days]);

    return {
      jobs: result.rows[0],
      documents: docResult.rows[0]
    };
  }

  private mapRowToBulkJob(row: any): BulkProcessingJob {
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      userId: row.user_id,
      name: row.name,
      description: row.description,
      documents: [], // Will be loaded separately
      status: row.status,
      progress: row.progress,
      settings: row.settings,
      results: row.results,
      createdAt: row.created_at,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      error: row.error
    };
  }

  private mapRowToBulkDocument(row: any): BulkDocument {
    return {
      id: row.id,
      filename: row.filename,
      size: row.file_size,
      status: row.status,
      documentId: row.document_id,
      error: row.error
    };
  }
}