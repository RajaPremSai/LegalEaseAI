import { PrivacyService } from './privacy';
import { firestoreService } from './firestore';
import { storageService } from './storage';

export class SchedulerService {
  private privacyService: PrivacyService;
  private intervals: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    this.privacyService = new PrivacyService(firestoreService, storageService);
  }

  /**
   * Start all scheduled jobs
   */
  start(): void {
    console.log('Starting scheduled jobs...');

    // Document cleanup job - runs every hour
    this.scheduleJob('documentCleanup', () => {
      this.runDocumentCleanup();
    }, 60 * 60 * 1000); // 1 hour

    // Export cleanup job - runs daily at 2 AM
    this.scheduleJob('exportCleanup', () => {
      this.runExportCleanup();
    }, 24 * 60 * 60 * 1000); // 24 hours

    console.log('Scheduled jobs started successfully');
  }

  /**
   * Stop all scheduled jobs
   */
  stop(): void {
    console.log('Stopping scheduled jobs...');
    
    this.intervals.forEach((interval, jobName) => {
      clearInterval(interval);
      console.log(`Stopped job: ${jobName}`);
    });
    
    this.intervals.clear();
    console.log('All scheduled jobs stopped');
  }

  /**
   * Schedule a recurring job
   */
  private scheduleJob(name: string, job: () => void, intervalMs: number): void {
    // Run immediately on startup
    job();
    
    // Then schedule recurring execution
    const interval = setInterval(() => {
      try {
        job();
      } catch (error) {
        console.error(`Error in scheduled job ${name}:`, error);
      }
    }, intervalMs);

    this.intervals.set(name, interval);
    console.log(`Scheduled job '${name}' to run every ${intervalMs / 1000} seconds`);
  }

  /**
   * Run document cleanup job
   */
  private async runDocumentCleanup(): Promise<void> {
    try {
      console.log('Running document cleanup job...');
      
      const results = await this.privacyService.cleanupExpiredDocuments();
      
      console.log('Document cleanup completed:', {
        documentsDeleted: results.documentsDeleted,
        analysesDeleted: results.analysesDeleted,
        storageFilesDeleted: results.storageFilesDeleted,
      });

      // Log cleanup metrics (in production, send to monitoring service)
      if (results.documentsDeleted > 0 || results.analysesDeleted > 0 || results.storageFilesDeleted > 0) {
        console.log(`Cleanup summary: ${results.documentsDeleted} documents, ${results.analysesDeleted} analyses, ${results.storageFilesDeleted} storage files deleted`);
      }
    } catch (error) {
      console.error('Document cleanup job failed:', error);
    }
  }

  /**
   * Run export cleanup job
   */
  private async runExportCleanup(): Promise<void> {
    try {
      console.log('Running export cleanup job...');
      
      const filesDeleted = await this.privacyService.cleanupExpiredExports();
      
      console.log(`Export cleanup completed: ${filesDeleted} expired export files deleted`);
    } catch (error) {
      console.error('Export cleanup job failed:', error);
    }
  }

  /**
   * Run a specific job manually (for testing/admin purposes)
   */
  async runJobManually(jobName: string): Promise<any> {
    switch (jobName) {
      case 'documentCleanup':
        return this.runDocumentCleanup();
      case 'exportCleanup':
        return this.runExportCleanup();
      default:
        throw new Error(`Unknown job: ${jobName}`);
    }
  }

  /**
   * Get job status
   */
  getJobStatus(): { [jobName: string]: { running: boolean; intervalMs: number } } {
    const status: { [jobName: string]: { running: boolean; intervalMs: number } } = {};
    
    this.intervals.forEach((interval, jobName) => {
      status[jobName] = {
        running: true,
        intervalMs: jobName === 'documentCleanup' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000,
      };
    });

    return status;
  }
}

// Export singleton instance
export const schedulerService = new SchedulerService();