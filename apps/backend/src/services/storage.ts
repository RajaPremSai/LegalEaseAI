import { Storage, Bucket, File } from '@google-cloud/storage';
import { getGoogleCloudService } from '../config/google-cloud';
import crypto from 'crypto';
import path from 'path';

export interface StorageConfig {
  documentsBucket: string;
  tempBucket: string;
  maxFileSize: number; // in bytes
  allowedMimeTypes: string[];
  documentRetentionHours: number;
}

export interface UploadResult {
  fileName: string;
  bucketName: string;
  publicUrl?: string;
  expiresAt: Date;
}

export class CloudStorageService {
  private storage: Storage;
  private config: StorageConfig;
  private documentsBucket: Bucket;
  private tempBucket: Bucket;

  constructor(config: StorageConfig) {
    this.storage = getGoogleCloudService().getStorage();
    this.config = config;
    this.documentsBucket = this.storage.bucket(config.documentsBucket);
    this.tempBucket = this.storage.bucket(config.tempBucket);
  }

  /**
   * Initialize storage buckets with proper IAM policies
   */
  async initializeBuckets(): Promise<void> {
    try {
      // Create documents bucket if it doesn't exist
      const [documentsExists] = await this.documentsBucket.exists();
      if (!documentsExists) {
        await this.storage.createBucket(this.config.documentsBucket, {
          location: 'US',
          storageClass: 'STANDARD',
          uniformBucketLevelAccess: true,
          lifecycle: {
            rule: [
              {
                action: { type: 'Delete' },
                condition: { age: Math.ceil(this.config.documentRetentionHours / 24) },
              },
            ],
          },
        });
        console.log(`Created documents bucket: ${this.config.documentsBucket}`);
      }

      // Create temp bucket if it doesn't exist
      const [tempExists] = await this.tempBucket.exists();
      if (!tempExists) {
        await this.storage.createBucket(this.config.tempBucket, {
          location: 'US',
          storageClass: 'STANDARD',
          uniformBucketLevelAccess: true,
          lifecycle: {
            rule: [
              {
                action: { type: 'Delete' },
                condition: { age: 1 }, // Delete after 1 day
              },
            ],
          },
        });
        console.log(`Created temp bucket: ${this.config.tempBucket}`);
      }

      // Set IAM policies for security
      await this.setSecurityPolicies();
    } catch (error) {
      console.error('Failed to initialize storage buckets:', error);
      throw error;
    }
  }

  /**
   * Set security policies for buckets
   */
  private async setSecurityPolicies(): Promise<void> {
    const restrictedPolicy = {
      bindings: [
        {
          role: 'roles/storage.objectViewer',
          members: ['serviceAccount:legal-ai-backend@your-project.iam.gserviceaccount.com'],
        },
        {
          role: 'roles/storage.objectCreator',
          members: ['serviceAccount:legal-ai-backend@your-project.iam.gserviceaccount.com'],
        },
      ],
    };

    try {
      await this.documentsBucket.iam.setPolicy(restrictedPolicy);
      await this.tempBucket.iam.setPolicy(restrictedPolicy);
      console.log('Security policies applied to storage buckets');
    } catch (error) {
      console.error('Failed to set security policies:', error);
      throw error;
    }
  }

  /**
   * Upload a file to the documents bucket
   */
  async uploadDocument(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    userId: string
  ): Promise<UploadResult> {
    // Validate file
    this.validateFile(buffer, mimeType);

    // Generate secure filename
    const fileExtension = path.extname(originalName);
    const timestamp = Date.now();
    const randomId = crypto.randomBytes(16).toString('hex');
    const fileName = `${userId}/${timestamp}-${randomId}${fileExtension}`;

    // Calculate expiration time
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + this.config.documentRetentionHours);

    try {
      const file = this.documentsBucket.file(fileName);
      
      // Upload with metadata
      await file.save(buffer, {
        metadata: {
          contentType: mimeType,
          metadata: {
            originalName,
            userId,
            uploadedAt: new Date().toISOString(),
            expiresAt: expiresAt.toISOString(),
          },
        },
        resumable: false,
      });

      console.log(`Document uploaded: ${fileName}`);

      return {
        fileName,
        bucketName: this.config.documentsBucket,
        expiresAt,
      };
    } catch (error) {
      console.error('Failed to upload document:', error);
      throw new Error('Document upload failed');
    }
  }

  /**
   * Upload a temporary file
   */
  async uploadTemp(buffer: Buffer, fileName: string, mimeType: string): Promise<UploadResult> {
    const tempFileName = `temp/${Date.now()}-${crypto.randomBytes(8).toString('hex')}-${fileName}`;
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour expiration

    try {
      const file = this.tempBucket.file(tempFileName);
      
      await file.save(buffer, {
        metadata: {
          contentType: mimeType,
          metadata: {
            uploadedAt: new Date().toISOString(),
            expiresAt: expiresAt.toISOString(),
          },
        },
        resumable: false,
      });

      return {
        fileName: tempFileName,
        bucketName: this.config.tempBucket,
        expiresAt,
      };
    } catch (error) {
      console.error('Failed to upload temp file:', error);
      throw new Error('Temp file upload failed');
    }
  }

  /**
   * Download a file from storage
   */
  async downloadFile(fileName: string, bucketName?: string): Promise<Buffer> {
    const bucket = bucketName ? this.storage.bucket(bucketName) : this.documentsBucket;
    const file = bucket.file(fileName);

    try {
      const [buffer] = await file.download();
      return buffer;
    } catch (error) {
      console.error('Failed to download file:', error);
      throw new Error('File download failed');
    }
  }

  /**
   * Delete a file from storage
   */
  async deleteFile(fileName: string, bucketName?: string): Promise<void> {
    const bucket = bucketName ? this.storage.bucket(bucketName) : this.documentsBucket;
    const file = bucket.file(fileName);

    try {
      await file.delete();
      console.log(`File deleted: ${fileName}`);
    } catch (error) {
      console.error('Failed to delete file:', error);
      throw new Error('File deletion failed');
    }
  }

  /**
   * Generate a signed URL for secure file access
   */
  async generateSignedUrl(fileName: string, expirationMinutes: number = 60): Promise<string> {
    const file = this.documentsBucket.file(fileName);
    
    const options = {
      version: 'v4' as const,
      action: 'read' as const,
      expires: Date.now() + expirationMinutes * 60 * 1000,
    };

    try {
      const [url] = await file.getSignedUrl(options);
      return url;
    } catch (error) {
      console.error('Failed to generate signed URL:', error);
      throw new Error('Signed URL generation failed');
    }
  }

  /**
   * Validate uploaded file
   */
  private validateFile(buffer: Buffer, mimeType: string): void {
    if (buffer.length > this.config.maxFileSize) {
      throw new Error(`File size exceeds maximum allowed size of ${this.config.maxFileSize} bytes`);
    }

    if (!this.config.allowedMimeTypes.includes(mimeType)) {
      throw new Error(`File type ${mimeType} is not allowed`);
    }
  }

  /**
   * Clean up expired files
   */
  async cleanupExpiredFiles(): Promise<void> {
    const now = new Date();
    
    try {
      const [files] = await this.documentsBucket.getFiles();
      
      for (const file of files) {
        const [metadata] = await file.getMetadata();
        const expiresAt = metadata.metadata?.expiresAt;
        
        if (expiresAt && typeof expiresAt === 'string' && new Date(expiresAt) < now) {
          await file.delete();
          console.log(`Cleaned up expired file: ${file.name}`);
        }
      }
    } catch (error) {
      console.error('Failed to cleanup expired files:', error);
    }
  }
}