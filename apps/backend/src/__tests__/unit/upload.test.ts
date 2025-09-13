import { UploadService } from '../../services/upload';
import { Storage } from '@google-cloud/storage';
import crypto from 'crypto';

// Mock Google Cloud Storage
jest.mock('@google-cloud/storage');
const MockedStorage = Storage as jest.MockedClass<typeof Storage>;

// Mock environment config
jest.mock('../../config/environment', () => ({
  storageConfig: {
    tempBucket: 'test-temp-bucket',
    maxFileSize: 50 * 1024 * 1024, // 50MB
    allowedMimeTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ],
    documentRetentionHours: 24,
  },
  googleCloudConfig: {
    projectId: 'test-project',
    keyFilename: 'test-key.json',
  },
}));

describe('UploadService', () => {
  let uploadService: UploadService;
  let mockBucket: any;
  let mockFile: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock bucket and file operations
    mockFile = {
      save: jest.fn().mockResolvedValue(undefined),
      setMetadata: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
      getSignedUrl: jest.fn().mockResolvedValue(['https://example.com/signed-url']),
      download: jest.fn().mockResolvedValue([Buffer.from('test content')]),
    };

    mockBucket = {
      file: jest.fn().mockReturnValue(mockFile),
    };

    MockedStorage.prototype.bucket = jest.fn().mockReturnValue(mockBucket);

    uploadService = new UploadService();
  });

  describe('File Validation', () => {
    it('should accept valid PDF file', async () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'document',
        originalname: 'test.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        size: 1024 * 1024, // 1MB
        buffer: Buffer.from('PDF content'),
        destination: '',
        filename: '',
        path: '',
        stream: {} as any,
      };

      const result = await uploadService.uploadFile(mockFile, 'user-123');
      expect(result).toBeDefined();
      expect(result.originalName).toBe('test.pdf');
      expect(result.mimeType).toBe('application/pdf');
    });

    it('should accept valid DOCX file', async () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'document',
        originalname: 'test.docx',
        encoding: '7bit',
        mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        size: 1024 * 1024, // 1MB
        buffer: Buffer.from('DOCX content'),
        destination: '',
        filename: '',
        path: '',
        stream: {} as any,
      };

      const result = await uploadService.uploadFile(mockFile, 'user-123');
      expect(result).toBeDefined();
      expect(result.originalName).toBe('test.docx');
    });

    it('should reject file that exceeds size limit', async () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'document',
        originalname: 'large.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        size: 60 * 1024 * 1024, // 60MB (exceeds 50MB limit)
        buffer: Buffer.alloc(60 * 1024 * 1024),
        destination: '',
        filename: '',
        path: '',
        stream: {} as any,
      };

      await expect(uploadService.uploadFile(mockFile, 'user-123'))
        .rejects.toThrow('File size exceeds maximum limit');
    });

    it('should reject unsupported file type', async () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'document',
        originalname: 'test.exe',
        encoding: '7bit',
        mimetype: 'application/x-executable',
        size: 1024,
        buffer: Buffer.from('executable content'),
        destination: '',
        filename: '',
        path: '',
        stream: {} as any,
      };

      await expect(uploadService.uploadFile(mockFile, 'user-123'))
        .rejects.toThrow('File type application/x-executable is not supported');
    });

    it('should reject file with invalid extension', async () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'document',
        originalname: 'test.exe',
        encoding: '7bit',
        mimetype: 'application/pdf', // MIME type is valid but extension is not
        size: 1024,
        buffer: Buffer.from('content'),
        destination: '',
        filename: '',
        path: '',
        stream: {} as any,
      };

      await expect(uploadService.uploadFile(mockFile, 'user-123'))
        .rejects.toThrow('File extension .exe is not allowed');
    });
  });

  describe('Malware Scanning', () => {
    it('should detect PE executable signature', async () => {
      const maliciousBuffer = Buffer.concat([
        Buffer.from('4D5A', 'hex'), // PE signature
        Buffer.from('rest of file content'),
      ]);

      const mockFile: Express.Multer.File = {
        fieldname: 'document',
        originalname: 'malicious.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        size: maliciousBuffer.length,
        buffer: maliciousBuffer,
        destination: '',
        filename: '',
        path: '',
        stream: {} as any,
      };

      await expect(uploadService.uploadFile(mockFile, 'user-123'))
        .rejects.toThrow('File appears to contain malicious content');
    });

    it('should detect suspicious JavaScript patterns', async () => {
      const suspiciousBuffer = Buffer.from('Some content with eval() function call');

      const mockFile: Express.Multer.File = {
        fieldname: 'document',
        originalname: 'suspicious.txt',
        encoding: '7bit',
        mimetype: 'text/plain',
        size: suspiciousBuffer.length,
        buffer: suspiciousBuffer,
        destination: '',
        filename: '',
        path: '',
        stream: {} as any,
      };

      await expect(uploadService.uploadFile(mockFile, 'user-123'))
        .rejects.toThrow('File contains suspicious content patterns');
    });

    it('should allow clean files', async () => {
      const cleanBuffer = Buffer.from('This is a clean document with normal content.');

      const mockFile: Express.Multer.File = {
        fieldname: 'document',
        originalname: 'clean.txt',
        encoding: '7bit',
        mimetype: 'text/plain',
        size: cleanBuffer.length,
        buffer: cleanBuffer,
        destination: '',
        filename: '',
        path: '',
        stream: {} as any,
      };

      const result = await uploadService.uploadFile(mockFile, 'user-123');
      expect(result).toBeDefined();
      expect(result.originalName).toBe('clean.txt');
    });
  });

  describe('File Upload', () => {
    it('should generate unique filename and checksum', async () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'document',
        originalname: 'test.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        size: 1024,
        buffer: Buffer.from('test content'),
        destination: '',
        filename: '',
        path: '',
        stream: {} as any,
      };

      const result = await uploadService.uploadFile(mockFile, 'user-123');

      expect(result.id).toBeDefined();
      expect(result.filename).toMatch(/^[0-9a-f-]+\.pdf$/);
      expect(result.checksum).toBeDefined();
      expect(result.checksum).toHaveLength(64); // SHA-256 hex string
      expect(result.path).toBe(`uploads/user-123/${result.filename}`);
    });

    it('should call Google Cloud Storage with correct parameters', async () => {
      const testBuffer = Buffer.from('test content');
      const mockFile: Express.Multer.File = {
        fieldname: 'document',
        originalname: 'test.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        size: testBuffer.length,
        buffer: testBuffer,
        destination: '',
        filename: '',
        path: '',
        stream: {} as any,
      };

      await uploadService.uploadFile(mockFile, 'user-123');

      expect(mockBucket.file).toHaveBeenCalledWith(expect.stringMatching(/^uploads\/user-123\/[0-9a-f-]+\.pdf$/));
      expect(mockFile.save).toHaveBeenCalledWith(testBuffer, expect.objectContaining({
        metadata: expect.objectContaining({
          contentType: 'application/pdf',
          metadata: expect.objectContaining({
            originalName: 'test.pdf',
            userId: 'user-123',
          }),
        }),
        validation: 'crc32c',
      }));
      expect(mockFile.setMetadata).toHaveBeenCalled();
    });

    it('should handle upload errors gracefully', async () => {
      mockFile.save.mockRejectedValue(new Error('Storage error'));

      const mockFile: Express.Multer.File = {
        fieldname: 'document',
        originalname: 'test.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        size: 1024,
        buffer: Buffer.from('test content'),
        destination: '',
        filename: '',
        path: '',
        stream: {} as any,
      };

      await expect(uploadService.uploadFile(mockFile, 'user-123'))
        .rejects.toThrow('Upload failed: Storage error');
    });
  });

  describe('File Operations', () => {
    it('should delete file successfully', async () => {
      await uploadService.deleteFile('uploads/user-123/test-file.pdf');
      expect(mockBucket.file).toHaveBeenCalledWith('uploads/user-123/test-file.pdf');
      expect(mockFile.delete).toHaveBeenCalled();
    });

    it('should handle delete errors gracefully', async () => {
      mockFile.delete.mockRejectedValue(new Error('Delete error'));
      
      // Should not throw error
      await expect(uploadService.deleteFile('uploads/user-123/test-file.pdf'))
        .resolves.toBeUndefined();
    });

    it('should generate signed URL', async () => {
      const url = await uploadService.getFileUrl('uploads/user-123/test-file.pdf', 3600);
      
      expect(mockBucket.file).toHaveBeenCalledWith('uploads/user-123/test-file.pdf');
      expect(mockFile.getSignedUrl).toHaveBeenCalledWith({
        action: 'read',
        expires: expect.any(Number),
      });
      expect(url).toBe('https://example.com/signed-url');
    });

    it('should verify file integrity', async () => {
      const testContent = 'test content';
      const expectedChecksum = crypto.createHash('sha256').update(testContent).digest('hex');
      
      mockFile.download.mockResolvedValue([Buffer.from(testContent)]);

      const isValid = await uploadService.verifyFileIntegrity(
        'uploads/user-123/test-file.pdf',
        expectedChecksum
      );

      expect(isValid).toBe(true);
      expect(mockBucket.file).toHaveBeenCalledWith('uploads/user-123/test-file.pdf');
      expect(mockFile.download).toHaveBeenCalled();
    });

    it('should return false for invalid checksum', async () => {
      mockFile.download.mockResolvedValue([Buffer.from('different content')]);

      const isValid = await uploadService.verifyFileIntegrity(
        'uploads/user-123/test-file.pdf',
        'invalid-checksum'
      );

      expect(isValid).toBe(false);
    });

    it('should handle verification errors', async () => {
      mockFile.download.mockRejectedValue(new Error('Download error'));

      const isValid = await uploadService.verifyFileIntegrity(
        'uploads/user-123/test-file.pdf',
        'some-checksum'
      );

      expect(isValid).toBe(false);
    });
  });

  describe('Checksum Generation', () => {
    it('should generate consistent SHA-256 checksums', () => {
      const content1 = Buffer.from('test content');
      const content2 = Buffer.from('test content');
      const content3 = Buffer.from('different content');

      // Use reflection to access private method for testing
      const generateChecksum = (uploadService as any).generateChecksum.bind(uploadService);

      const checksum1 = generateChecksum(content1);
      const checksum2 = generateChecksum(content2);
      const checksum3 = generateChecksum(content3);

      expect(checksum1).toBe(checksum2);
      expect(checksum1).not.toBe(checksum3);
      expect(checksum1).toHaveLength(64); // SHA-256 hex string length
    });
  });
});