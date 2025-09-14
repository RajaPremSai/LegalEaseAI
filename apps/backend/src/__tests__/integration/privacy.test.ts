import request from 'supertest';
import express from 'express';
import privacyRouter from '../../routes/privacy';
import { PrivacyService } from '../../services/privacy';

// Mock services
jest.mock('../../services/privacy');
jest.mock('../../services/firestore');
jest.mock('../../services/storage');

const app = express();
app.use(express.json());

// Mock auth middleware to add user to request
app.use((req: any, res, next) => {
  req.user = {
    id: 'user-123',
    email: 'test@example.com',
    userType: 'individual',
  };
  next();
});

app.use('/privacy', privacyRouter);

// Mock privacy service
const mockPrivacyService = {
  recordConsent: jest.fn(),
  getUserConsent: jest.fn(),
  hasConsent: jest.fn(),
  requestDataExport: jest.fn(),
  getDataExportStatus: jest.fn(),
  requestDataDeletion: jest.fn(),
  getDataDeletionStatus: jest.fn(),
  cleanupExpiredDocuments: jest.fn(),
} as jest.Mocked<Partial<PrivacyService>>;

describe('Privacy Routes Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /privacy/consent', () => {
    it('should record user consent successfully', async () => {
      const consentData = {
        consentType: 'data_processing',
        granted: true,
        policyVersion: '1.0.0',
      };

      (mockPrivacyService.recordConsent as jest.Mock).mockResolvedValue('consent-123');

      const response = await request(app)
        .post('/privacy/consent')
        .send(consentData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.consentId).toBe('consent-123');
      expect(response.body.data.consentType).toBe(consentData.consentType);
      expect(response.body.data.granted).toBe(consentData.granted);
    });

    it('should return 400 for invalid consent type', async () => {
      const invalidData = {
        consentType: 'invalid_type',
        granted: true,
        policyVersion: '1.0.0',
      };

      const response = await request(app)
        .post('/privacy/consent')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should return 400 for missing policy version', async () => {
      const invalidData = {
        consentType: 'data_processing',
        granted: true,
      };

      const response = await request(app)
        .post('/privacy/consent')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /privacy/consent', () => {
    it('should get user consent history', async () => {
      const mockConsents = [
        {
          id: 'consent-1',
          userId: 'user-123',
          consentType: 'data_processing',
          granted: true,
          grantedAt: new Date(),
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          version: '1.0.0',
        },
      ];

      (mockPrivacyService.getUserConsent as jest.Mock).mockResolvedValue(mockConsents);

      const response = await request(app)
        .get('/privacy/consent')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.consents).toEqual(mockConsents);
    });
  });

  describe('GET /privacy/consent/:consentType', () => {
    it('should check specific consent type', async () => {
      (mockPrivacyService.hasConsent as jest.Mock).mockResolvedValue(true);

      const response = await request(app)
        .get('/privacy/consent/data_processing')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.consentType).toBe('data_processing');
      expect(response.body.data.granted).toBe(true);
    });

    it('should return 400 for invalid consent type', async () => {
      const response = await request(app)
        .get('/privacy/consent/invalid_type')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid consent type');
    });
  });

  describe('POST /privacy/data-export', () => {
    it('should create data export request successfully', async () => {
      (mockPrivacyService.requestDataExport as jest.Mock).mockResolvedValue('export-123');

      const response = await request(app)
        .post('/privacy/data-export')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.requestId).toBe('export-123');
      expect(response.body.data.status).toBe('pending');
    });

    it('should return 409 for existing export request', async () => {
      (mockPrivacyService.requestDataExport as jest.Mock).mockRejectedValue(
        new Error('Data export request already in progress')
      );

      const response = await request(app)
        .post('/privacy/data-export')
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Request already in progress');
    });
  });

  describe('GET /privacy/data-export/:requestId', () => {
    it('should get export request status', async () => {
      const mockExportRequest = {
        id: 'export-123',
        userId: 'user-123',
        status: 'completed',
        requestedAt: new Date(),
        completedAt: new Date(),
        downloadUrl: 'https://example.com/download',
        expiresAt: new Date(),
      };

      (mockPrivacyService.getDataExportStatus as jest.Mock).mockResolvedValue(mockExportRequest);

      const response = await request(app)
        .get('/privacy/data-export/export-123')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.requestId).toBe('export-123');
      expect(response.body.data.status).toBe('completed');
      expect(response.body.data.downloadUrl).toBe('https://example.com/download');
    });

    it('should return 404 for non-existent request', async () => {
      (mockPrivacyService.getDataExportStatus as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .get('/privacy/data-export/non-existent')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Request not found');
    });

    it('should return 403 for request belonging to different user', async () => {
      const mockExportRequest = {
        id: 'export-123',
        userId: 'different-user',
        status: 'completed',
        requestedAt: new Date(),
      };

      (mockPrivacyService.getDataExportStatus as jest.Mock).mockResolvedValue(mockExportRequest);

      const response = await request(app)
        .get('/privacy/data-export/export-123')
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Access denied');
    });
  });

  describe('POST /privacy/data-deletion', () => {
    it('should create data deletion request successfully', async () => {
      (mockPrivacyService.requestDataDeletion as jest.Mock).mockResolvedValue('deletion-123');

      const response = await request(app)
        .post('/privacy/data-deletion')
        .send({ deletionType: 'complete' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.requestId).toBe('deletion-123');
      expect(response.body.data.deletionType).toBe('complete');
      expect(response.body.data.status).toBe('pending');
    });

    it('should default to complete deletion type', async () => {
      (mockPrivacyService.requestDataDeletion as jest.Mock).mockResolvedValue('deletion-123');

      const response = await request(app)
        .post('/privacy/data-deletion')
        .send({})
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.deletionType).toBe('complete');
    });

    it('should return 409 for existing deletion request', async () => {
      (mockPrivacyService.requestDataDeletion as jest.Mock).mockRejectedValue(
        new Error('Data deletion request already in progress')
      );

      const response = await request(app)
        .post('/privacy/data-deletion')
        .send({ deletionType: 'partial' })
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Request already in progress');
    });
  });

  describe('GET /privacy/data-deletion/:requestId', () => {
    it('should get deletion request status', async () => {
      const mockDeletionRequest = {
        id: 'deletion-123',
        userId: 'user-123',
        status: 'completed',
        deletionType: 'complete',
        requestedAt: new Date(),
        completedAt: new Date(),
      };

      (mockPrivacyService.getDataDeletionStatus as jest.Mock).mockResolvedValue(mockDeletionRequest);

      const response = await request(app)
        .get('/privacy/data-deletion/deletion-123')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.requestId).toBe('deletion-123');
      expect(response.body.data.status).toBe('completed');
      expect(response.body.data.deletionType).toBe('complete');
    });

    it('should return 404 for non-existent request', async () => {
      (mockPrivacyService.getDataDeletionStatus as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .get('/privacy/data-deletion/non-existent')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Request not found');
    });

    it('should return 403 for request belonging to different user', async () => {
      const mockDeletionRequest = {
        id: 'deletion-123',
        userId: 'different-user',
        status: 'completed',
        deletionType: 'complete',
        requestedAt: new Date(),
      };

      (mockPrivacyService.getDataDeletionStatus as jest.Mock).mockResolvedValue(mockDeletionRequest);

      const response = await request(app)
        .get('/privacy/data-deletion/deletion-123')
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Access denied');
    });
  });

  describe('GET /privacy/policy', () => {
    it('should return privacy policy information', async () => {
      const response = await request(app)
        .get('/privacy/policy')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.version).toBeDefined();
      expect(response.body.data.effectiveDate).toBeDefined();
      expect(response.body.data.userRights).toBeDefined();
      expect(response.body.data.dataProcessingPurposes).toBeDefined();
    });
  });

  describe('POST /privacy/schedule-cleanup', () => {
    it('should perform cleanup successfully', async () => {
      const mockCleanupResults = {
        documentsDeleted: 5,
        analysesDeleted: 3,
        storageFilesDeleted: 5,
      };

      (mockPrivacyService.cleanupExpiredDocuments as jest.Mock).mockResolvedValue(mockCleanupResults);

      const response = await request(app)
        .post('/privacy/schedule-cleanup')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockCleanupResults);
    });

    it('should handle cleanup errors', async () => {
      (mockPrivacyService.cleanupExpiredDocuments as jest.Mock).mockRejectedValue(
        new Error('Cleanup failed')
      );

      const response = await request(app)
        .post('/privacy/schedule-cleanup')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Cleanup failed');
    });
  });
});