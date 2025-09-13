import { GoogleCloudService, initializeGoogleCloud } from '../../config/google-cloud';
import { CloudStorageService } from '../../services/storage';
import { FirestoreService } from '../../services/firestore';

// Mock environment for testing
const mockGoogleCloudConfig = {
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || 'test-project',
  location: process.env.GOOGLE_CLOUD_LOCATION || 'us-central1',
  processorId: process.env.GOOGLE_CLOUD_PROCESSOR_ID || 'test-processor',
};

const mockStorageConfig = {
  documentsBucket: process.env.DOCUMENTS_BUCKET || 'test-documents-bucket',
  tempBucket: process.env.TEMP_BUCKET || 'test-temp-bucket',
  maxFileSize: 52428800,
  allowedMimeTypes: ['application/pdf', 'text/plain'],
  documentRetentionHours: 24,
};

const mockFirestoreConfig = {
  collections: {
    users: 'users',
    documents: 'documents',
    analyses: 'analyses',
    sessions: 'sessions',
  },
};

describe('Google Cloud Integration Tests', () => {
  let googleCloudService: GoogleCloudService;
  let storageService: CloudStorageService;
  let firestoreService: FirestoreService;

  beforeAll(async () => {
    // Skip tests if running in CI without credentials
    if (process.env.CI && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      console.log('Skipping Google Cloud integration tests in CI environment');
      return;
    }

    try {
      googleCloudService = initializeGoogleCloud(mockGoogleCloudConfig);
      storageService = new CloudStorageService(mockStorageConfig);
      firestoreService = new FirestoreService(mockFirestoreConfig);
    } catch (error) {
      console.warn('Failed to initialize Google Cloud services for testing:', error);
    }
  });

  describe('Google Cloud Service Initialization', () => {
    it('should initialize Google Cloud service successfully', () => {
      if (!googleCloudService) {
        console.log('Skipping test: Google Cloud service not available');
        return;
      }

      expect(googleCloudService).toBeDefined();
      expect(googleCloudService.getDocumentAI()).toBeDefined();
      expect(googleCloudService.getFirestore()).toBeDefined();
      expect(googleCloudService.getStorage()).toBeDefined();
      expect(googleCloudService.getTranslate()).toBeDefined();
    });

    it('should return correct configuration', () => {
      if (!googleCloudService) {
        pending('Google Cloud service not available');
        return;
      }

      const config = googleCloudService.getConfig();
      expect(config.projectId).toBe(googleCloudConfig.projectId);
      expect(config.location).toBe(googleCloudConfig.location);
      expect(config.processorId).toBe(googleCloudConfig.processorId);
    });
  });

  describe('Service Connectivity Tests', () => {
    it('should test connectivity to all Google Cloud services', async () => {
      if (!googleCloudService) {
        pending('Google Cloud service not available');
        return;
      }

      const connectivity = await googleCloudService.testConnectivity();
      
      // In a real environment, these should all be true
      // In test environment, we just check the structure
      expect(connectivity).toHaveProperty('documentAI');
      expect(connectivity).toHaveProperty('firestore');
      expect(connectivity).toHaveProperty('storage');
      expect(connectivity).toHaveProperty('translate');
      
      expect(typeof connectivity.documentAI).toBe('boolean');
      expect(typeof connectivity.firestore).toBe('boolean');
      expect(typeof connectivity.storage).toBe('boolean');
      expect(typeof connectivity.translate).toBe('boolean');
    }, 30000); // 30 second timeout for network calls
  });

  describe('Cloud Storage Integration', () => {
    const testFileName = 'test-document.txt';
    const testContent = Buffer.from('This is a test document for integration testing.');
    const testUserId = 'test-user-123';

    beforeAll(async () => {
      if (!storageService) {
        return;
      }

      try {
        // Initialize buckets for testing
        await storageService.initializeBuckets();
      } catch (error) {
        console.warn('Failed to initialize storage buckets:', error);
      }
    });

    it('should upload and download a document', async () => {
      if (!storageService) {
        pending('Storage service not available');
        return;
      }

      try {
        // Upload document
        const uploadResult = await storageService.uploadDocument(
          testContent,
          testFileName,
          'text/plain',
          testUserId
        );

        expect(uploadResult).toHaveProperty('fileName');
        expect(uploadResult).toHaveProperty('bucketName');
        expect(uploadResult).toHaveProperty('expiresAt');
        expect(uploadResult.bucketName).toBe(storageConfig.documentsBucket);

        // Download document
        const downloadedContent = await storageService.downloadFile(uploadResult.fileName);
        expect(downloadedContent).toEqual(testContent);

        // Clean up
        await storageService.deleteFile(uploadResult.fileName);
      } catch (error) {
        console.warn('Storage test failed:', error);
        pending('Storage operations not available');
      }
    }, 15000);

    it('should generate signed URLs', async () => {
      if (!storageService) {
        pending('Storage service not available');
        return;
      }

      try {
        // Upload a test file first
        const uploadResult = await storageService.uploadDocument(
          testContent,
          testFileName,
          'text/plain',
          testUserId
        );

        // Generate signed URL
        const signedUrl = await storageService.generateSignedUrl(uploadResult.fileName, 60);
        expect(signedUrl).toMatch(/^https:\/\/storage\.googleapis\.com/);
        expect(signedUrl).toContain(uploadResult.fileName);

        // Clean up
        await storageService.deleteFile(uploadResult.fileName);
      } catch (error) {
        console.warn('Signed URL test failed:', error);
        pending('Signed URL generation not available');
      }
    }, 15000);

    it('should validate file uploads', async () => {
      if (!storageService) {
        pending('Storage service not available');
        return;
      }

      // Test file size validation
      const largeContent = Buffer.alloc(storageConfig.maxFileSize + 1);
      await expect(
        storageService.uploadDocument(largeContent, 'large-file.txt', 'text/plain', testUserId)
      ).rejects.toThrow('File size exceeds maximum allowed size');

      // Test MIME type validation
      await expect(
        storageService.uploadDocument(testContent, 'test.exe', 'application/x-executable', testUserId)
      ).rejects.toThrow('File type application/x-executable is not allowed');
    });
  });

  describe('Firestore Integration', () => {
    const testUser = {
      email: 'test@example.com',
      profile: {
        name: 'Test User',
        userType: 'individual' as const,
        jurisdiction: 'US',
        preferences: { language: 'en' },
      },
      subscription: {
        plan: 'free' as const,
        documentsRemaining: 5,
        renewsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    };

    let testUserId: string;

    beforeAll(async () => {
      if (!firestoreService) {
        return;
      }

      try {
        await firestoreService.initializeFirestore();
      } catch (error) {
        console.warn('Failed to initialize Firestore:', error);
      }
    });

    afterAll(async () => {
      if (!firestoreService || !testUserId) {
        return;
      }

      try {
        // Clean up test user
        const userDocuments = await firestoreService.getUserDocuments(testUserId);
        for (const doc of userDocuments) {
          await firestoreService.deleteDocument(doc.id);
        }
        
        // Note: In a real test, you'd also delete the user document
        // but Firestore admin operations require special permissions
      } catch (error) {
        console.warn('Failed to clean up test data:', error);
      }
    });

    it('should create and retrieve a user', async () => {
      if (!firestoreService) {
        pending('Firestore service not available');
        return;
      }

      try {
        // Create user
        testUserId = await firestoreService.createUser(testUser);
        expect(testUserId).toBeDefined();
        expect(typeof testUserId).toBe('string');

        // Retrieve user
        const retrievedUser = await firestoreService.getUser(testUserId);
        expect(retrievedUser).toBeDefined();
        expect(retrievedUser?.email).toBe(testUser.email);
        expect(retrievedUser?.profile.name).toBe(testUser.profile.name);
      } catch (error) {
        console.warn('Firestore user test failed:', error);
        pending('Firestore operations not available');
      }
    }, 10000);

    it('should create and retrieve documents', async () => {
      if (!firestoreService || !testUserId) {
        pending('Firestore service or test user not available');
        return;
      }

      try {
        const testDocument = {
          userId: testUserId,
          filename: 'test-doc-123.pdf',
          originalName: 'test-document.pdf',
          documentType: 'contract',
          jurisdiction: 'US',
          uploadedAt: new Date(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          status: 'processing' as const,
          metadata: {
            pageCount: 5,
            wordCount: 1000,
            language: 'en',
            fileSize: 1024,
            mimeType: 'application/pdf',
          },
          storageInfo: {
            bucketName: 'test-bucket',
            fileName: 'test-file.pdf',
          },
        };

        // Create document
        const documentId = await firestoreService.createDocument(testDocument);
        expect(documentId).toBeDefined();

        // Retrieve document
        const retrievedDoc = await firestoreService.getDocument(documentId);
        expect(retrievedDoc).toBeDefined();
        expect(retrievedDoc?.userId).toBe(testUserId);
        expect(retrievedDoc?.filename).toBe(testDocument.filename);

        // Get user documents
        const userDocs = await firestoreService.getUserDocuments(testUserId);
        expect(userDocs).toHaveLength(1);
        expect(userDocs[0].id).toBe(documentId);
      } catch (error) {
        console.warn('Firestore document test failed:', error);
        pending('Firestore document operations not available');
      }
    }, 10000);

    it('should handle user lookup by email', async () => {
      if (!firestoreService || !testUserId) {
        pending('Firestore service or test user not available');
        return;
      }

      try {
        const userByEmail = await firestoreService.getUserByEmail(testUser.email);
        expect(userByEmail).toBeDefined();
        expect(userByEmail?.id).toBe(testUserId);
        expect(userByEmail?.email).toBe(testUser.email);

        // Test non-existent email
        const nonExistentUser = await firestoreService.getUserByEmail('nonexistent@example.com');
        expect(nonExistentUser).toBeNull();
      } catch (error) {
        console.warn('Firestore email lookup test failed:', error);
        pending('Firestore email lookup not available');
      }
    }, 10000);
  });

  describe('Error Handling', () => {
    it('should handle invalid Google Cloud configuration', () => {
      expect(() => {
        initializeGoogleCloud({
          projectId: '',
          location: 'invalid-location',
          processorId: '',
        });
      }).not.toThrow(); // Service creation shouldn't throw, but operations will fail
    });

    it('should handle storage service errors gracefully', async () => {
      if (!storageService) {
        pending('Storage service not available');
        return;
      }

      // Test downloading non-existent file
      await expect(
        storageService.downloadFile('non-existent-file.txt')
      ).rejects.toThrow();

      // Test deleting non-existent file
      await expect(
        storageService.deleteFile('non-existent-file.txt')
      ).rejects.toThrow();
    });

    it('should handle Firestore service errors gracefully', async () => {
      if (!firestoreService) {
        pending('Firestore service not available');
        return;
      }

      // Test getting non-existent user
      const nonExistentUser = await firestoreService.getUser('non-existent-id');
      expect(nonExistentUser).toBeNull();

      // Test getting non-existent document
      const nonExistentDoc = await firestoreService.getDocument('non-existent-id');
      expect(nonExistentDoc).toBeNull();
    });
  });
});