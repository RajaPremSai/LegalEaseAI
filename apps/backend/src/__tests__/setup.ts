/**
 * Jest setup file for backend tests
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-purposes-only';
process.env.GOOGLE_CLOUD_PROJECT_ID = 'test-project';
process.env.GOOGLE_CLOUD_LOCATION = 'us-central1';
process.env.GOOGLE_CLOUD_PROCESSOR_ID = 'test-processor';
process.env.DOCUMENTS_BUCKET = 'test-documents-bucket';
process.env.TEMP_BUCKET = 'test-temp-bucket';

// Mock console methods to reduce noise in tests
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleLog = console.log;

beforeAll(() => {
  // Suppress console output during tests unless explicitly needed
  console.error = jest.fn();
  console.warn = jest.fn();
  console.log = jest.fn();
});

afterAll(() => {
  // Restore console methods
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
  console.log = originalConsoleLog;
});

// Global test utilities
global.testUtils = {
  createMockUser: () => ({
    id: 'test-user-123',
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
    createdAt: new Date(),
    updatedAt: new Date(),
  }),

  createMockDocument: (userId: string = 'test-user-123') => ({
    userId,
    filename: 'test-document.pdf',
    originalName: 'Test Document.pdf',
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
  }),

  createMockBuffer: (content: string = 'Test document content') => {
    return Buffer.from(content);
  },

  delay: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
};

// Extend Jest matchers if needed
declare global {
  namespace jest {
    interface Matchers<R> {
      // Add custom matchers here if needed
    }
  }

  var testUtils: {
    createMockUser: () => any;
    createMockDocument: (userId?: string) => any;
    createMockBuffer: (content?: string) => Buffer;
    delay: (ms: number) => Promise<void>;
  };
}