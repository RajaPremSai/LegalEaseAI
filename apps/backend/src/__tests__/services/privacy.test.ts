import { PrivacyService, ConsentRecord } from '../../services/privacy';
import { FirestoreService, UserDocument, DocumentRecord } from '../../services/firestore';
import { StorageService } from '../../services/storage';

// Mock dependencies
jest.mock('../../services/firestore');
jest.mock('../../services/storage');

const mockFirestoreService = {
  db: {
    collection: jest.fn(),
  },
  getUser: jest.fn(),
  getDocument: jest.fn(),
  updateUser: jest.fn(),
  updateDocument: jest.fn(),
  getUserDocuments: jest.fn(),
  getUserAnalyses: jest.fn(),
  createBatch: jest.fn(),
  cleanupExpiredDocuments: jest.fn(),
} as jest.Mocked<FirestoreService>;

const mockStorageService = {
  deleteFile: jest.fn(),
  uploadFile: jest.fn(),
  generateSignedUrl: jest.fn(),
} as jest.Mocked<StorageService>;

describe('PrivacyService', () => {
  let privacyService: PrivacyService;
  
  beforeEach(() => {
    jest.clearAllMocks();
    privacyService = new PrivacyService(mockFirestoreService, mockStorageService);
  });

  describe('Consent Management', () => {
    it('should record user consent successfully', async () => {
      const userId = 'user-123';
      const consentType = 'data_processing';
      const granted = true;
      const metadata = {
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        policyVersion: '1.0.0',
      };

      const mockDocRef = {
        id: 'consent-123',
        set: jest.fn(),
      };

      mockFirestoreService.db.collection.mockReturnValue({
        doc: jest.fn().mockReturnValue(mockDocRef),
      } as any);

      const consentId = await privacyService.recordConsent(userId, consentType, granted, metadata);

      expect(mockDocRef.set).toHaveBeenCalledWith({
        id: mockDocRef.id,
        userId,
        consentType,
        granted,
        grantedAt: expect.any(Date),
        revokedAt: undefined,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        version: metadata.policyVersion,
      });

      expect(mockFirestoreService.updateUser).toHaveBeenCalledWith(userId, {
        'profile.preferences.consent_data_processing': granted,
        'profile.preferences.lastConsentUpdate': expect.any(Date),
      });

      expect(consentId).toBe(mockDocRef.id);
    });

    it('should record consent revocation', async () => {
      const userId = 'user-123';
      const consentType = 'analytics';
      const granted = false;
      const metadata = {
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        policyVersion: '1.0.0',
      };

      const mockDocRef = {
        id: 'consent-123',
        set: jest.fn(),
      };

      mockFirestoreService.db.collection.mockReturnValue({
        doc: jest.fn().mockReturnValue(mockDocRef),
      } as any);

      await privacyService.recordConsent(userId, consentType, granted, metadata);

      expect(mockDocRef.set).toHaveBeenCalledWith(
        expect.objectContaining({
          granted: false,
          revokedAt: expect.any(Date),
        })
      );
    });

    it('should get user consent history', async () => {
      const userId = 'user-123';
      const mockConsents: ConsentRecord[] = [
        {
          id: 'consent-1',
          userId,
          consentType: 'data_processing',
          granted: true,
          grantedAt: new Date(),
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          version: '1.0.0',
        },
      ];

      const mockSnapshot = {
        docs: mockConsents.map(consent => ({
          data: () => consent,
        })),
      };

      mockFirestoreService.db.collection.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue(mockSnapshot),
      } as any);

      const result = await privacyService.getUserConsent(userId);

      expect(result).toEqual(mockConsents);
    });

    it('should check if user has specific consent', async () => {
      const userId = 'user-123';
      const mockUser: UserDocument = {
        id: userId,
        email: 'test@example.com',
        profile: {
          name: 'Test User',
          userType: 'individual',
          jurisdiction: 'US',
          preferences: {
            consent_data_processing: true,
            consent_analytics: false,
          },
        },
        subscription: {
          plan: 'free',
          documentsRemaining: 5,
          renewsAt: new Date(),
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockFirestoreService.getUser.mockResolvedValue(mockUser);

      const hasDataProcessingConsent = await privacyService.hasConsent(userId, 'data_processing');
      const hasAnalyticsConsent = await privacyService.hasConsent(userId, 'analytics');

      expect(hasDataProcessingConsent).toBe(true);
      expect(hasAnalyticsConsent).toBe(false);
    });
  });

  describe('Document Deletion Scheduling', () => {
    it('should schedule document deletion', async () => {
      const documentId = 'doc-123';
      const uploadedAt = new Date();
      const mockDocument: DocumentRecord = {
        id: documentId,
        userId: 'user-123',
        filename: 'test.pdf',
        originalName: 'test.pdf',
        documentType: 'contract',
        jurisdiction: 'US',
        uploadedAt,
        expiresAt: new Date(),
        status: 'analyzed',
        metadata: {
          pageCount: 5,
          wordCount: 1000,
          language: 'en',
          fileSize: 1024,
          mimeType: 'application/pdf',
        },
        storageInfo: {
          bucketName: 'documents',
          fileName: 'doc-123.pdf',
        },
      };

      mockFirestoreService.getDocument.mockResolvedValue(mockDocument);

      await privacyService.scheduleDocumentDeletion(documentId);

      expect(mockFirestoreService.updateDocument).toHaveBeenCalledWith(documentId, {
        expiresAt: expect.any(Date),
      });
    });

    it('should throw error for non-existent document', async () => {
      const documentId = 'non-existent';
      
      mockFirestoreService.getDocument.mockResolvedValue(null);

      await expect(privacyService.scheduleDocumentDeletion(documentId)).rejects.toThrow('Document not found');
    });
  });

  describe('Expired Documents Cleanup', () => {
    it('should cleanup expired documents successfully', async () => {
      const mockExpiredDocs = [
        {
          id: 'doc-1',
          data: () => ({
            id: 'doc-1',
            storageInfo: {
              bucketName: 'documents',
              fileName: 'doc-1.pdf',
            },
          }),
          ref: { delete: jest.fn() },
        },
      ];

      const mockAnalyses = [
        { ref: { delete: jest.fn() } },
      ];

      const mockBatch = {
        delete: jest.fn(),
        commit: jest.fn(),
      };

      mockFirestoreService.db.collection.mockImplementation((collectionName) => {
        if (collectionName === 'documents') {
          return {
            where: jest.fn().mockReturnThis(),
            get: jest.fn().mockResolvedValue({ docs: mockExpiredDocs, size: 1 }),
          };
        } else if (collectionName === 'analyses') {
          return {
            where: jest.fn().mockReturnThis(),
            get: jest.fn().mockResolvedValue({ docs: mockAnalyses }),
          };
        }
        return {} as any;
      });

      mockFirestoreService.createBatch.mockReturnValue(mockBatch as any);
      mockStorageService.deleteFile.mockResolvedValue(undefined);

      const result = await privacyService.cleanupExpiredDocuments();

      expect(mockStorageService.deleteFile).toHaveBeenCalledWith('documents', 'doc-1.pdf');
      expect(mockBatch.delete).toHaveBeenCalledTimes(2); // 1 analysis + 1 document
      expect(mockBatch.commit).toHaveBeenCalled();
      expect(result.documentsDeleted).toBe(1);
      expect(result.analysesDeleted).toBe(1);
      expect(result.storageFilesDeleted).toBe(1);
    });
  });

  describe('Data Export', () => {
    it('should create data export request', async () => {
      const userId = 'user-123';
      const mockUser: UserDocument = {
        id: userId,
        email: 'test@example.com',
        profile: {
          name: 'Test User',
          userType: 'individual',
          jurisdiction: 'US',
          preferences: {},
        },
        subscription: {
          plan: 'free',
          documentsRemaining: 5,
          renewsAt: new Date(),
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockRequestRef = {
        id: 'export-123',
        set: jest.fn(),
      };

      mockFirestoreService.getUser.mockResolvedValue(mockUser);
      
      mockFirestoreService.db.collection.mockImplementation((collectionName) => {
        if (collectionName === 'data_export_requests') {
          return {
            where: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            get: jest.fn().mockResolvedValue({ empty: true }),
            doc: jest.fn().mockReturnValue(mockRequestRef),
          };
        }
        return {} as any;
      });

      const requestId = await privacyService.requestDataExport(userId);

      expect(mockRequestRef.set).toHaveBeenCalledWith({
        id: mockRequestRef.id,
        userId,
        requestedAt: expect.any(Date),
        status: 'pending',
      });

      expect(requestId).toBe(mockRequestRef.id);
    });

    it('should throw error for existing export request', async () => {
      const userId = 'user-123';
      const mockUser: UserDocument = {
        id: userId,
        email: 'test@example.com',
        profile: {
          name: 'Test User',
          userType: 'individual',
          jurisdiction: 'US',
          preferences: {},
        },
        subscription: {
          plan: 'free',
          documentsRemaining: 5,
          renewsAt: new Date(),
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockFirestoreService.getUser.mockResolvedValue(mockUser);
      
      mockFirestoreService.db.collection.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({ empty: false }),
      } as any);

      await expect(privacyService.requestDataExport(userId)).rejects.toThrow('Data export request already in progress');
    });
  });

  describe('Data Deletion', () => {
    it('should create data deletion request', async () => {
      const userId = 'user-123';
      const mockUser: UserDocument = {
        id: userId,
        email: 'test@example.com',
        profile: {
          name: 'Test User',
          userType: 'individual',
          jurisdiction: 'US',
          preferences: {},
        },
        subscription: {
          plan: 'free',
          documentsRemaining: 5,
          renewsAt: new Date(),
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockRequestRef = {
        id: 'deletion-123',
        set: jest.fn(),
      };

      mockFirestoreService.getUser.mockResolvedValue(mockUser);
      
      mockFirestoreService.db.collection.mockImplementation((collectionName) => {
        if (collectionName === 'data_deletion_requests') {
          return {
            where: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            get: jest.fn().mockResolvedValue({ empty: true }),
            doc: jest.fn().mockReturnValue(mockRequestRef),
          };
        }
        return {} as any;
      });

      const requestId = await privacyService.requestDataDeletion(userId, 'complete');

      expect(mockRequestRef.set).toHaveBeenCalledWith({
        id: mockRequestRef.id,
        userId,
        requestedAt: expect.any(Date),
        status: 'pending',
        deletionType: 'complete',
      });

      expect(requestId).toBe(mockRequestRef.id);
    });

    it('should throw error for existing deletion request', async () => {
      const userId = 'user-123';
      const mockUser: UserDocument = {
        id: userId,
        email: 'test@example.com',
        profile: {
          name: 'Test User',
          userType: 'individual',
          jurisdiction: 'US',
          preferences: {},
        },
        subscription: {
          plan: 'free',
          documentsRemaining: 5,
          renewsAt: new Date(),
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockFirestoreService.getUser.mockResolvedValue(mockUser);
      
      mockFirestoreService.db.collection.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({ empty: false }),
      } as any);

      await expect(privacyService.requestDataDeletion(userId)).rejects.toThrow('Data deletion request already in progress');
    });
  });

  describe('Request Status Retrieval', () => {
    it('should get data export status', async () => {
      const requestId = 'export-123';
      const mockExportRequest = {
        id: requestId,
        userId: 'user-123',
        requestedAt: new Date(),
        status: 'completed',
        completedAt: new Date(),
        downloadUrl: 'https://example.com/download',
        expiresAt: new Date(),
      };

      mockFirestoreService.db.collection.mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({
            exists: true,
            data: () => mockExportRequest,
          }),
        }),
      } as any);

      const result = await privacyService.getDataExportStatus(requestId);

      expect(result).toEqual(mockExportRequest);
    });

    it('should return null for non-existent export request', async () => {
      const requestId = 'non-existent';

      mockFirestoreService.db.collection.mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({
            exists: false,
          }),
        }),
      } as any);

      const result = await privacyService.getDataExportStatus(requestId);

      expect(result).toBeNull();
    });

    it('should get data deletion status', async () => {
      const requestId = 'deletion-123';
      const mockDeletionRequest = {
        id: requestId,
        userId: 'user-123',
        requestedAt: new Date(),
        status: 'completed',
        completedAt: new Date(),
        deletionType: 'complete',
      };

      mockFirestoreService.db.collection.mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({
            exists: true,
            data: () => mockDeletionRequest,
          }),
        }),
      } as any);

      const result = await privacyService.getDataDeletionStatus(requestId);

      expect(result).toEqual(mockDeletionRequest);
    });
  });
});