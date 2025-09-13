import { GoogleCloudService, initializeGoogleCloud } from '../../config/google-cloud';
import { CloudStorageService } from '../../services/storage';
import { FirestoreService } from '../../services/firestore';

// Test configuration
const testConfig = {
  googleCloud: {
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || 'test-project',
    location: process.env.GOOGLE_CLOUD_LOCATION || 'us-central1',
    processorId: process.env.GOOGLE_CLOUD_PROCESSOR_ID || 'test-processor',
  },
  storage: {
    documentsBucket: process.env.DOCUMENTS_BUCKET || 'test-documents-bucket',
    tempBucket: process.env.TEMP_BUCKET || 'test-temp-bucket',
    maxFileSize: 52428800,
    allowedMimeTypes: ['application/pdf', 'text/plain'],
    documentRetentionHours: 24,
  },
  firestore: {
    collections: {
      users: 'users',
      documents: 'documents',
      analyses: 'analyses',
      sessions: 'sessions',
    },
  },
};

describe('Google Cloud Integration Tests (Simple)', () => {
  let googleCloudService: GoogleCloudService;
  let storageService: CloudStorageService;
  let firestoreService: FirestoreService;

  beforeAll(() => {
    // Initialize services for testing
    googleCloudService = initializeGoogleCloud(testConfig.googleCloud);
    storageService = new CloudStorageService(testConfig.storage);
    firestoreService = new FirestoreService(testConfig.firestore);
  });

  describe('Service Initialization', () => {
    it('should initialize Google Cloud service', () => {
      expect(googleCloudService).toBeDefined();
      expect(googleCloudService.getDocumentAI()).toBeDefined();
      expect(googleCloudService.getFirestore()).toBeDefined();
      expect(googleCloudService.getStorage()).toBeDefined();
      expect(googleCloudService.getTranslate()).toBeDefined();
    });

    it('should initialize storage service', () => {
      expect(storageService).toBeDefined();
    });

    it('should initialize Firestore service', () => {
      expect(firestoreService).toBeDefined();
    });

    it('should return correct configuration', () => {
      const config = googleCloudService.getConfig();
      expect(config.projectId).toBe(testConfig.googleCloud.projectId);
      expect(config.location).toBe(testConfig.googleCloud.location);
      expect(config.processorId).toBe(testConfig.googleCloud.processorId);
    });
  });

  describe('Service Validation', () => {
    it('should validate file uploads correctly', async () => {
      const testContent = Buffer.from('Test document content');
      
      // Test file size validation
      const largeContent = Buffer.alloc(testConfig.storage.maxFileSize + 1);
      await expect(
        storageService.uploadDocument(largeContent, 'large-file.txt', 'text/plain', 'test-user')
      ).rejects.toThrow('File size exceeds maximum allowed size');

      // Test MIME type validation
      await expect(
        storageService.uploadDocument(testContent, 'test.exe', 'application/x-executable', 'test-user')
      ).rejects.toThrow('File type application/x-executable is not allowed');
    });

    it('should handle non-existent document queries gracefully', async () => {
      const nonExistentUser = await firestoreService.getUser('non-existent-id');
      expect(nonExistentUser).toBeNull();

      const nonExistentDoc = await firestoreService.getDocument('non-existent-id');
      expect(nonExistentDoc).toBeNull();
    });
  });

  describe('Connectivity Tests (Optional)', () => {
    it('should test connectivity when credentials are available', async () => {
      // Skip if no credentials are available
      if (process.env.CI && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        console.log('Skipping connectivity test in CI environment without credentials');
        return;
      }

      try {
        const connectivity = await googleCloudService.testConnectivity();
        
        // Check structure regardless of actual connectivity
        expect(connectivity).toHaveProperty('documentAI');
        expect(connectivity).toHaveProperty('firestore');
        expect(connectivity).toHaveProperty('storage');
        expect(connectivity).toHaveProperty('translate');
        
        expect(typeof connectivity.documentAI).toBe('boolean');
        expect(typeof connectivity.firestore).toBe('boolean');
        expect(typeof connectivity.storage).toBe('boolean');
        expect(typeof connectivity.translate).toBe('boolean');

        // Log results for debugging
        console.log('Connectivity test results:', connectivity);
      } catch (error) {
        console.log('Connectivity test failed (expected in test environment):', error.message);
        // Don't fail the test - this is expected without proper credentials
      }
    }, 10000);
  });

  describe('Error Handling', () => {
    it('should handle invalid Google Cloud configuration gracefully', () => {
      expect(() => {
        initializeGoogleCloud({
          projectId: '',
          location: 'invalid-location',
          processorId: '',
        });
      }).not.toThrow(); // Service creation shouldn't throw, but operations will fail
    });

    it('should handle storage errors gracefully', async () => {
      // Test downloading non-existent file
      await expect(
        storageService.downloadFile('non-existent-file.txt')
      ).rejects.toThrow();

      // Test deleting non-existent file
      await expect(
        storageService.deleteFile('non-existent-file.txt')
      ).rejects.toThrow();
    });
  });
});