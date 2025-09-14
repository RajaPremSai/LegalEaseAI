import multer from 'multer';
import { Request, Response, NextFunction } from 'express';
import { Storage } from '@google-cloud/storage';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import path from 'path';
import { storageConfig, googleCloudConfig } from '../config/environment';
import { z } from 'zod';

// Local schema definition to avoid import issues
const DocumentUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  fileSize: z.number().max(50 * 1024 * 1024), // 50MB max
  mimeType: z.enum(['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']),
  jurisdiction: z.string().min(2).max(10).optional(),
});

// Initialize Google Cloud Storage
const storage = new Storage({
  projectId: googleCloudConfig.projectId,
  keyFilename: googleCloudConfig.keyFilename,
});

// File type validation
const ALLOWED_MIME_TYPES = storageConfig.allowedMimeTypes;
const MAX_FILE_SIZE = storageConfig.maxFileSize;

// Malware scanning patterns (basic implementation)
const MALWARE_SIGNATURES = [
  // Common malware file signatures
  Buffer.from('4D5A', 'hex'), // PE executable
  Buffer.from('7F454C46', 'hex'), // ELF executable
  Buffer.from('CAFEBABE', 'hex'), // Java class file
  Buffer.from('504B0304', 'hex'), // ZIP file (could contain malware)
];

export interface UploadedFile {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  bucket: string;
  path: string;
  checksum: string;
  uploadedAt: Date;
}

export class UploadService {
  private bucket = storage.bucket(storageConfig.tempBucket);

  /**
   * Validates file type and size
   */
  private validateFile(file: Express.Multer.File): void {
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`File size exceeds maximum limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
    }

    // Check MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new Error(`File type ${file.mimetype} is not supported. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`);
    }

    // Check file extension
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExtensions = ['.pdf', '.doc', '.docx', '.txt'];
    if (!allowedExtensions.includes(ext)) {
      throw new Error(`File extension ${ext} is not allowed`);
    }
  }

  /**
   * Basic malware scanning using file signatures
   */
  private scanForMalware(buffer: Buffer): void {
    const fileHeader = buffer.slice(0, 16);
    
    for (const signature of MALWARE_SIGNATURES) {
      if (fileHeader.includes(signature)) {
        throw new Error('File appears to contain malicious content');
      }
    }

    // Check for suspicious patterns
    const suspiciousPatterns = [
      /eval\s*\(/gi,
      /document\.write\s*\(/gi,
      /javascript:/gi,
      /<script/gi,
    ];

    const fileContent = buffer.toString('utf8', 0, Math.min(buffer.length, 1024));
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(fileContent)) {
        throw new Error('File contains suspicious content patterns');
      }
    }
  }

  /**
   * Generates file checksum for integrity verification
   */
  private generateChecksum(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Uploads file to Google Cloud Storage
   */
  async uploadFile(file: Express.Multer.File, userId: string): Promise<UploadedFile> {
    try {
      // Validate file
      this.validateFile(file);

      // Scan for malware
      this.scanForMalware(file.buffer);

      // Generate unique filename
      const fileId = uuidv4();
      const ext = path.extname(file.originalname);
      const filename = `${fileId}${ext}`;
      const filePath = `uploads/${userId}/${filename}`;

      // Generate checksum
      const checksum = this.generateChecksum(file.buffer);

      // Upload to Google Cloud Storage
      const cloudFile = this.bucket.file(filePath);
      
      await cloudFile.save(file.buffer, {
        metadata: {
          contentType: file.mimetype,
          metadata: {
            originalName: file.originalname,
            userId,
            uploadedAt: new Date().toISOString(),
            checksum,
          },
        },
        validation: 'crc32c',
      });

      // Set file to expire after configured retention period
      const expirationDate = new Date();
      expirationDate.setHours(expirationDate.getHours() + storageConfig.documentRetentionHours);

      await cloudFile.setMetadata({
        customTime: expirationDate.toISOString(),
      });

      return {
        id: fileId,
        filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        bucket: storageConfig.tempBucket,
        path: filePath,
        checksum,
        uploadedAt: new Date(),
      };
    } catch (error) {
      throw new Error(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Deletes file from storage
   */
  async deleteFile(filePath: string): Promise<void> {
    try {
      await this.bucket.file(filePath).delete();
    } catch (error) {
      console.error(`Failed to delete file ${filePath}:`, error);
      // Don't throw error for cleanup operations
    }
  }

  /**
   * Gets file download URL
   */
  async getFileUrl(filePath: string, expiresIn: number = 3600): Promise<string> {
    const [url] = await this.bucket.file(filePath).getSignedUrl({
      action: 'read',
      expires: Date.now() + expiresIn * 1000,
    });
    return url;
  }

  /**
   * Verifies file integrity
   */
  async verifyFileIntegrity(filePath: string, expectedChecksum: string): Promise<boolean> {
    try {
      const [buffer] = await this.bucket.file(filePath).download();
      const actualChecksum = this.generateChecksum(buffer);
      return actualChecksum === expectedChecksum;
    } catch (error) {
      return false;
    }
  }

  /**
   * Verifies if file exists in storage
   */
  async verifyFileExists(filePath: string): Promise<boolean> {
    try {
      const [exists] = await this.bucket.file(filePath).exists();
      return exists;
    } catch (error) {
      return false;
    }
  }

  /**
   * Gets file metadata
   */
  async getFileMetadata(filePath: string): Promise<any> {
    try {
      const [metadata] = await this.bucket.file(filePath).getMetadata();
      return metadata;
    } catch (error) {
      throw new Error(`Failed to get file metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Multer configuration for memory storage
export const multerConfig = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1, // Only allow single file upload
  },
  fileFilter: (req, file, cb) => {
    try {
      // Basic validation
      if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        return cb(new Error(`File type ${file.mimetype} is not supported`));
      }
      cb(null, true);
    } catch (error) {
      cb(error as Error);
    }
  },
});

// Upload progress tracking middleware
export const uploadProgressMiddleware = (req: Request, res: Response, next: NextFunction) => {
  let uploadedBytes = 0;
  const contentLength = parseInt(req.headers['content-length'] || '0', 10);

  req.on('data', (chunk) => {
    uploadedBytes += chunk.length;
    const progress = Math.round((uploadedBytes / contentLength) * 100);
    
    // Emit progress event (can be used with WebSocket for real-time updates)
    req.app.emit('upload-progress', {
      sessionId: req.headers['x-session-id'],
      progress,
      uploadedBytes,
      totalBytes: contentLength,
    });
  });

  next();
};

// Error handling middleware for upload errors
export const uploadErrorHandler = (error: Error, req: Request, res: Response, next: NextFunction) => {
  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(413).json({
          error: 'File too large',
          message: `File size exceeds maximum limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
        });
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({
          error: 'Too many files',
          message: 'Only one file can be uploaded at a time',
        });
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({
          error: 'Unexpected file field',
          message: 'File must be uploaded in the "document" field',
        });
      default:
        return res.status(400).json({
          error: 'Upload error',
          message: error.message,
        });
    }
  }

  if (error.message.includes('File type') || error.message.includes('malicious')) {
    return res.status(400).json({
      error: 'Invalid file',
      message: error.message,
    });
  }

  next(error);
};

export const uploadService = new UploadService();