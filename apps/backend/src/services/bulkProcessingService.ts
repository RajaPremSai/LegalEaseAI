import { 
  BulkProcessingJob, 
  BulkDocument, 
  CreateBulkJob,
  BulkProcessingResults,
  BulkDocumentResult,
  Document
} from '@legal-ai/shared';
import { BulkProcessingRepository } from '../database/repositories/bulkProcessingRepository';
import { WorkspaceRepository } from '../database/repositories/workspaceRepository';
import { DocumentRepository } from '../database/repositories/document.repository';
import { AIAnalysisService } from './aiAnalysis';
import { TemplateService } from './templateService';
import { UploadService } from './upload';

export class BulkProcessingService {
  constructor(
    private bulkProcessingRepository: BulkProcessingRepository,
    private workspaceRepository: WorkspaceRepository,
    private documentRepository: DocumentRepository,
    private aiAnalysisService: AIAnalysisService,
    private templateService: TemplateService,
    private uploadService: UploadService
  ) {}

  async createBulkJob(workspaceId: string, userId: string, jobData: CreateBulkJob): Promise<BulkProcessingJob> {
    // Check if user has permission to use bulk processing
    const members = await this.workspaceRepository.getWorkspaceMembers(workspaceId);
    const userMember = members.find(member => member.userId === userId);
    
    if (!userMember || !userMember.permissions.canUseBulkProcessing) {
      throw new Error('Insufficient permissions for bulk processing');
    }

    // Set default settings
    const defaultSettings = {
      analysisType: 'full' as const,
      outputFormat: 'individual' as const,
      notifyOnCompletion: true
    };

    const job = await this.bulkProcessingRepository.createBulkJob(workspaceId, userId, {
      ...jobData,
      settings: { ...defaultSettings, ...jobData.settings }
    });

    // Log activity
    await this.workspaceRepository.logActivity({
      workspaceId,
      userId,
      action: 'bulk_job_started',
      details: { 
        jobId: job.id,
        jobName: job.name,
        settings: job.settings
      }
    });

    return job;
  }

  async addDocumentsToJob(jobId: string, files: Express.Multer.File[]): Promise<BulkDocument[]> {
    const job = await this.bulkProcessingRepository.findBulkJobById(jobId);
    if (!job) {
      throw new Error('Bulk job not found');
    }

    if (job.status !== 'pending') {
      throw new Error('Cannot add documents to a job that is not pending');
    }

    const bulkDocuments: BulkDocument[] = [];

    for (const file of files) {
      const bulkDoc = await this.bulkProcessingRepository.addBulkDocument(jobId, {
        filename: file.originalname,
        size: file.size
      });
      bulkDocuments.push(bulkDoc);
    }

    // Update job progress
    await this.bulkProcessingRepository.updateBulkJobProgress(jobId, {
      total: job.progress.total + files.length,
      processed: job.progress.processed,
      successful: job.progress.successful,
      failed: job.progress.failed
    });

    return bulkDocuments;
  }

  async startBulkJob(jobId: string): Promise<void> {
    const job = await this.bulkProcessingRepository.findBulkJobById(jobId);
    if (!job) {
      throw new Error('Bulk job not found');
    }

    if (job.status !== 'pending') {
      throw new Error('Job is not in pending status');
    }

    if (job.documents.length === 0) {
      throw new Error('No documents to process');
    }

    // Update job status to processing
    await this.bulkProcessingRepository.updateBulkJobStatus(jobId, 'processing');

    // Process documents asynchronously
    this.processBulkJob(job).catch(error => {
      console.error(`Error processing bulk job ${jobId}:`, error);
      this.bulkProcessingRepository.updateBulkJobStatus(jobId, 'failed', error.message);
    });
  }

  async getBulkJob(jobId: string, userId: string): Promise<BulkProcessingJob | null> {
    const job = await this.bulkProcessingRepository.findBulkJobById(jobId);
    if (!job) {
      return null;
    }

    // Check if user has access to this job
    const members = await this.workspaceRepository.getWorkspaceMembers(job.workspaceId);
    const userMember = members.find(member => member.userId === userId);
    
    if (!userMember || userMember.status !== 'active') {
      return null;
    }

    return job;
  }

  async getUserBulkJobs(userId: string, limit: number = 50, offset: number = 0): Promise<BulkProcessingJob[]> {
    return this.bulkProcessingRepository.findBulkJobsByUser(userId, limit, offset);
  }

  async getWorkspaceBulkJobs(workspaceId: string, userId: string, limit: number = 50, offset: number = 0): Promise<BulkProcessingJob[]> {
    // Check if user has access to workspace
    const members = await this.workspaceRepository.getWorkspaceMembers(workspaceId);
    const userMember = members.find(member => member.userId === userId);
    
    if (!userMember || userMember.status !== 'active') {
      throw new Error('Access denied to workspace');
    }

    return this.bulkProcessingRepository.findBulkJobsByWorkspace(workspaceId, limit, offset);
  }

  async cancelBulkJob(jobId: string, userId: string): Promise<boolean> {
    const job = await this.bulkProcessingRepository.findBulkJobById(jobId);
    if (!job) {
      throw new Error('Bulk job not found');
    }

    // Check if user has permission to cancel job
    if (job.userId !== userId) {
      const members = await this.workspaceRepository.getWorkspaceMembers(job.workspaceId);
      const userMember = members.find(member => member.userId === userId);
      
      if (!userMember || !userMember.permissions.canManageWorkspace) {
        throw new Error('Insufficient permissions to cancel job');
      }
    }

    return this.bulkProcessingRepository.cancelBulkJob(jobId);
  }

  async deleteBulkJob(jobId: string, userId: string): Promise<boolean> {
    const job = await this.bulkProcessingRepository.findBulkJobById(jobId);
    if (!job) {
      throw new Error('Bulk job not found');
    }

    // Check if user has permission to delete job
    if (job.userId !== userId) {
      const members = await this.workspaceRepository.getWorkspaceMembers(job.workspaceId);
      const userMember = members.find(member => member.userId === userId);
      
      if (!userMember || !userMember.permissions.canManageWorkspace) {
        throw new Error('Insufficient permissions to delete job');
      }
    }

    // Can only delete completed, failed, or cancelled jobs
    if (!['completed', 'failed', 'cancelled'].includes(job.status)) {
      throw new Error('Can only delete completed, failed, or cancelled jobs');
    }

    return this.bulkProcessingRepository.deleteBulkJob(jobId);
  }

  async getJobStatistics(workspaceId: string, userId: string, days: number = 30): Promise<any> {
    // Check if user has access to workspace
    const members = await this.workspaceRepository.getWorkspaceMembers(workspaceId);
    const userMember = members.find(member => member.userId === userId);
    
    if (!userMember || userMember.status !== 'active') {
      throw new Error('Access denied to workspace');
    }

    return this.bulkProcessingRepository.getJobStatistics(workspaceId, days);
  }

  private async processBulkJob(job: BulkProcessingJob): Promise<void> {
    const results: BulkDocumentResult[] = [];
    let successful = 0;
    let failed = 0;

    for (let i = 0; i < job.documents.length; i++) {
      const bulkDoc = job.documents[i];
      const startTime = Date.now();

      try {
        // Update document status to processing
        await this.bulkProcessingRepository.updateBulkDocument(bulkDoc.id, {
          status: 'processing'
        });

        // Process the document (this would involve uploading and analyzing)
        const document = await this.processDocument(bulkDoc, job);
        
        if (document) {
          // Update bulk document with document ID
          await this.bulkProcessingRepository.updateBulkDocument(bulkDoc.id, {
            status: 'completed',
            documentId: document.id
          });

          const result: BulkDocumentResult = {
            documentId: document.id,
            filename: bulkDoc.filename,
            status: 'success',
            analysis: document.analysis,
            processingTime: Date.now() - startTime
          };

          // Add template comparison if enabled
          if (job.settings.templateComparison?.enabled && job.settings.templateComparison.templateId) {
            try {
              const comparison = await this.templateService.compareWithTemplate(
                job.settings.templateComparison.templateId,
                document.id,
                job.userId
              );
              result.templateComparison = comparison;
            } catch (error) {
              console.error('Template comparison failed:', error);
            }
          }

          results.push(result);
          successful++;
        } else {
          throw new Error('Document processing failed');
        }

      } catch (error) {
        console.error(`Error processing document ${bulkDoc.filename}:`, error);
        
        // Update document status to failed
        await this.bulkProcessingRepository.updateBulkDocument(bulkDoc.id, {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        results.push({
          documentId: '',
          filename: bulkDoc.filename,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          processingTime: Date.now() - startTime
        });
        failed++;
      }

      // Update progress
      await this.bulkProcessingRepository.updateBulkJobProgress(job.id, {
        total: job.documents.length,
        processed: i + 1,
        successful,
        failed
      });
    }

    // Generate consolidated report if requested
    let consolidatedReport: string | undefined;
    if (job.settings.outputFormat === 'consolidated' || job.settings.outputFormat === 'both') {
      consolidatedReport = this.generateConsolidatedReport(results, job);
    }

    // Calculate summary statistics
    const riskScores = results
      .filter(r => r.analysis?.riskScore)
      .map(r => this.getRiskScoreNumeric(r.analysis!.riskScore));
    
    const averageRiskScore = riskScores.length > 0 
      ? riskScores.reduce((sum, score) => sum + score, 0) / riskScores.length 
      : 0;

    const highRiskDocuments = results.filter(r => 
      r.analysis?.riskScore === 'high'
    ).length;

    const finalResults: BulkProcessingResults = {
      summary: {
        totalDocuments: job.documents.length,
        successfullyProcessed: successful,
        failed,
        averageRiskScore: Math.round(averageRiskScore),
        highRiskDocuments
      },
      documents: results,
      consolidatedReport
    };

    // Update job with results
    await this.bulkProcessingRepository.updateBulkJobResults(job.id, finalResults);
    await this.bulkProcessingRepository.updateBulkJobStatus(job.id, 'completed');

    // Log completion
    await this.workspaceRepository.logActivity({
      workspaceId: job.workspaceId,
      userId: job.userId,
      action: 'bulk_job_completed',
      details: { 
        jobId: job.id,
        jobName: job.name,
        summary: finalResults.summary
      }
    });

    // TODO: Send notification if enabled
    // if (job.settings.notifyOnCompletion) {
    //   await this.notificationService.sendBulkJobCompletion(job, finalResults);
    // }
  }

  private async processDocument(bulkDoc: BulkDocument, job: BulkProcessingJob): Promise<Document | null> {
    // This is a simplified version - in reality, you'd need to handle file upload
    // and processing similar to the regular document upload flow
    
    // For now, we'll simulate document processing
    // In a real implementation, you'd:
    // 1. Upload the file to storage
    // 2. Extract text using Document AI
    // 3. Analyze the document
    // 4. Store in database
    
    // Placeholder implementation
    return null;
  }

  private generateConsolidatedReport(results: BulkDocumentResult[], job: BulkProcessingJob): string {
    const successful = results.filter(r => r.status === 'success');
    const failed = results.filter(r => r.status === 'failed');
    const highRisk = successful.filter(r => r.analysis?.riskScore === 'high');
    const mediumRisk = successful.filter(r => r.analysis?.riskScore === 'medium');
    const lowRisk = successful.filter(r => r.analysis?.riskScore === 'low');

    return `
BULK PROCESSING REPORT
Job: ${job.name}
Generated: ${new Date().toLocaleString()}

SUMMARY:
- Total Documents: ${results.length}
- Successfully Processed: ${successful.length}
- Failed: ${failed.length}
- Processing Success Rate: ${((successful.length / results.length) * 100).toFixed(1)}%

RISK ANALYSIS:
- High Risk Documents: ${highRisk.length}
- Medium Risk Documents: ${mediumRisk.length}
- Low Risk Documents: ${lowRisk.length}

HIGH RISK DOCUMENTS:
${highRisk.map(doc => `- ${doc.filename}`).join('\n')}

FAILED DOCUMENTS:
${failed.map(doc => `- ${doc.filename}: ${doc.error}`).join('\n')}

RECOMMENDATIONS:
${highRisk.length > 0 ? '- Review high-risk documents immediately' : ''}
${failed.length > 0 ? '- Investigate failed document processing' : ''}
- Consider legal review for documents with identified risks
    `.trim();
  }

  private getRiskScoreNumeric(riskScore: 'low' | 'medium' | 'high'): number {
    switch (riskScore) {
      case 'low': return 25;
      case 'medium': return 50;
      case 'high': return 75;
      default: return 0;
    }
  }
}