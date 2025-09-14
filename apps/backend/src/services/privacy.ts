import { FirestoreService, UserDocument, DocumentRecord, AnalysisRecord } from './firestore';
import { StorageService } from './storage';
import { storageConfig } from '../config/environment';

export interface ConsentRecord {
  id: string;
  userId: string;
  consentType: 'data_processing' | 'analytics' | 'marketing' | 'cookies';
  granted: boolean;
  grantedAt: Date;
  revokedAt?: Date;
  ipAddress: string;
  userAgent: string;
  version: string; // Privacy policy version
}

export interface DataExportRequest {
  id: string;
  userId: string;
  requestedAt: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  completedAt?: Date;
  downloadUrl?: string;
  expiresAt?: Date;
}

export interface DataDeletionRequest {
  id: string;
  userId: string;
  requestedAt: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  completedAt?: Date;
  deletionType: 'partial' | 'complete';
  retainedData?: string[]; // List of data types retained for legal reasons
}

export class PrivacyService {
  private firestoreService: FirestoreService;
  private storageService: StorageService;

  constructor(firestoreService: FirestoreService, storageService: StorageService) {
    this.firestoreService = firestoreService;
    this.storageService = storageService;
  }

  /**
   * Record user consent for data processing
   */
  async recordConsent(
    userId: string,
    consentType: ConsentRecord['consentType'],
    granted: boolean,
    metadata: {
      ipAddress: string;
      userAgent: string;
      policyVersion: string;
    }
  ): Promise<string> {
    const consentRecord: Omit<ConsentRecord, 'id'> = {
      userId,
      consentType,
      granted,
      grantedAt: new Date(),
      revokedAt: granted ? undefined : new Date(),
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      version: metadata.policyVersion,
    };

    // Store consent record in Firestore
    const consentRef = this.firestoreService.db
      .collection('consent_records')
      .doc();

    await consentRef.set({
      ...consentRecord,
      id: consentRef.id,
    });

    // Update user preferences
    await this.firestoreService.updateUser(userId, {
      [`profile.preferences.consent_${consentType}`]: granted,
      'profile.preferences.lastConsentUpdate': new Date(),
    });

    return consentRef.id;
  }

  /**
   * Get user consent history
   */
  async getUserConsent(userId: string): Promise<ConsentRecord[]> {
    const snapshot = await this.firestoreService.db
      .collection('consent_records')
      .where('userId', '==', userId)
      .orderBy('grantedAt', 'desc')
      .get();

    return snapshot.docs.map(doc => doc.data() as ConsentRecord);
  }

  /**
   * Check if user has granted specific consent
   */
  async hasConsent(userId: string, consentType: ConsentRecord['consentType']): Promise<boolean> {
    const user = await this.firestoreService.getUser(userId);
    if (!user) {
      return false;
    }

    return user.profile.preferences?.[`consent_${consentType}`] === true;
  }

  /**
   * Schedule automatic document deletion after 24 hours
   */
  async scheduleDocumentDeletion(documentId: string): Promise<void> {
    const document = await this.firestoreService.getDocument(documentId);
    if (!document) {
      throw new Error('Document not found');
    }

    // Calculate expiration time (24 hours from upload)
    const expirationTime = new Date(document.uploadedAt.getTime() + storageConfig.documentRetentionHours * 60 * 60 * 1000);

    // Update document with expiration time
    await this.firestoreService.updateDocument(documentId, {
      expiresAt: expirationTime,
    });

    console.log(`Document ${documentId} scheduled for deletion at ${expirationTime.toISOString()}`);
  }

  /**
   * Clean up expired documents (called by scheduled job)
   */
  async cleanupExpiredDocuments(): Promise<{
    documentsDeleted: number;
    analysesDeleted: number;
    storageFilesDeleted: number;
  }> {
    const now = new Date();
    let documentsDeleted = 0;
    let analysesDeleted = 0;
    let storageFilesDeleted = 0;

    try {
      // Find expired documents
      const expiredDocsSnapshot = await this.firestoreService.db
        .collection('documents')
        .where('expiresAt', '<', now)
        .get();

      console.log(`Found ${expiredDocsSnapshot.size} expired documents to delete`);

      // Process each expired document
      for (const docSnapshot of expiredDocsSnapshot.docs) {
        const document = docSnapshot.data() as DocumentRecord;

        try {
          // Delete from Cloud Storage
          if (document.storageInfo) {
            await this.storageService.deleteFile(
              document.storageInfo.bucketName,
              document.storageInfo.fileName
            );
            storageFilesDeleted++;
          }

          // Delete associated analyses
          const analysesSnapshot = await this.firestoreService.db
            .collection('analyses')
            .where('documentId', '==', document.id)
            .get();

          const batch = this.firestoreService.createBatch();
          
          analysesSnapshot.docs.forEach(analysisDoc => {
            batch.delete(analysisDoc.ref);
            analysesDeleted++;
          });

          // Delete document record
          batch.delete(docSnapshot.ref);
          documentsDeleted++;

          await batch.commit();

          console.log(`Deleted expired document: ${document.id}`);
        } catch (error) {
          console.error(`Failed to delete document ${document.id}:`, error);
        }
      }

      // Also clean up Firestore expired documents using the existing method
      await this.firestoreService.cleanupExpiredDocuments();

      return {
        documentsDeleted,
        analysesDeleted,
        storageFilesDeleted,
      };
    } catch (error) {
      console.error('Error during expired documents cleanup:', error);
      throw error;
    }
  }

  /**
   * Create data export request (GDPR Article 20)
   */
  async requestDataExport(userId: string): Promise<string> {
    // Check if user exists
    const user = await this.firestoreService.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Check for existing pending requests
    const existingRequestSnapshot = await this.firestoreService.db
      .collection('data_export_requests')
      .where('userId', '==', userId)
      .where('status', 'in', ['pending', 'processing'])
      .limit(1)
      .get();

    if (!existingRequestSnapshot.empty) {
      throw new Error('Data export request already in progress');
    }

    // Create export request
    const requestRef = this.firestoreService.db
      .collection('data_export_requests')
      .doc();

    const exportRequest: DataExportRequest = {
      id: requestRef.id,
      userId,
      requestedAt: new Date(),
      status: 'pending',
    };

    await requestRef.set(exportRequest);

    // Process export asynchronously
    this.processDataExport(requestRef.id).catch(error => {
      console.error(`Failed to process data export ${requestRef.id}:`, error);
    });

    return requestRef.id;
  }

  /**
   * Process data export request
   */
  private async processDataExport(requestId: string): Promise<void> {
    const requestRef = this.firestoreService.db
      .collection('data_export_requests')
      .doc(requestId);

    try {
      // Update status to processing
      await requestRef.update({ status: 'processing' });

      const requestDoc = await requestRef.get();
      const request = requestDoc.data() as DataExportRequest;

      // Collect all user data
      const userData = await this.collectUserData(request.userId);

      // Create export file (JSON format)
      const exportData = {
        exportedAt: new Date().toISOString(),
        userId: request.userId,
        data: userData,
      };

      // Upload to temporary storage with expiration
      const fileName = `data-export-${request.userId}-${Date.now()}.json`;
      const uploadResult = await this.storageService.uploadFile(
        storageConfig.tempBucket,
        fileName,
        Buffer.from(JSON.stringify(exportData, null, 2)),
        'application/json'
      );

      // Generate signed URL for download (valid for 7 days)
      const downloadUrl = await this.storageService.generateSignedUrl(
        storageConfig.tempBucket,
        fileName,
        7 * 24 * 60 * 60 * 1000 // 7 days
      );

      // Update request with completion details
      await requestRef.update({
        status: 'completed',
        completedAt: new Date(),
        downloadUrl,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      });

      console.log(`Data export completed for user ${request.userId}`);
    } catch (error) {
      console.error(`Data export failed for request ${requestId}:`, error);
      await requestRef.update({
        status: 'failed',
        completedAt: new Date(),
      });
    }
  }

  /**
   * Collect all user data for export
   */
  private async collectUserData(userId: string): Promise<any> {
    const [user, documents, analyses, consents] = await Promise.all([
      this.firestoreService.getUser(userId),
      this.firestoreService.getUserDocuments(userId, 1000), // Get all documents
      this.firestoreService.getUserAnalyses(userId, 1000), // Get all analyses
      this.getUserConsent(userId),
    ]);

    return {
      profile: user?.profile,
      subscription: user?.subscription,
      createdAt: user?.createdAt,
      updatedAt: user?.updatedAt,
      documents: documents.map(doc => ({
        id: doc.id,
        filename: doc.filename,
        documentType: doc.documentType,
        jurisdiction: doc.jurisdiction,
        uploadedAt: doc.uploadedAt,
        status: doc.status,
        metadata: doc.metadata,
      })),
      analyses: analyses.map(analysis => ({
        id: analysis.id,
        documentId: analysis.documentId,
        summary: analysis.summary,
        riskScore: analysis.riskScore,
        keyTerms: analysis.keyTerms,
        risks: analysis.risks,
        recommendations: analysis.recommendations,
        generatedAt: analysis.generatedAt,
      })),
      consents: consents,
    };
  }

  /**
   * Create data deletion request (GDPR Article 17)
   */
  async requestDataDeletion(
    userId: string,
    deletionType: 'partial' | 'complete' = 'complete'
  ): Promise<string> {
    // Check if user exists
    const user = await this.firestoreService.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Check for existing pending requests
    const existingRequestSnapshot = await this.firestoreService.db
      .collection('data_deletion_requests')
      .where('userId', '==', userId)
      .where('status', 'in', ['pending', 'processing'])
      .limit(1)
      .get();

    if (!existingRequestSnapshot.empty) {
      throw new Error('Data deletion request already in progress');
    }

    // Create deletion request
    const requestRef = this.firestoreService.db
      .collection('data_deletion_requests')
      .doc();

    const deletionRequest: DataDeletionRequest = {
      id: requestRef.id,
      userId,
      requestedAt: new Date(),
      status: 'pending',
      deletionType,
    };

    await requestRef.set(deletionRequest);

    // Process deletion asynchronously
    this.processDataDeletion(requestRef.id).catch(error => {
      console.error(`Failed to process data deletion ${requestRef.id}:`, error);
    });

    return requestRef.id;
  }

  /**
   * Process data deletion request
   */
  private async processDataDeletion(requestId: string): Promise<void> {
    const requestRef = this.firestoreService.db
      .collection('data_deletion_requests')
      .doc(requestId);

    try {
      // Update status to processing
      await requestRef.update({ status: 'processing' });

      const requestDoc = await requestRef.get();
      const request = requestDoc.data() as DataDeletionRequest;

      const retainedData: string[] = [];

      if (request.deletionType === 'complete') {
        // Delete all user data
        await this.deleteAllUserData(request.userId);
      } else {
        // Partial deletion - keep some data for legal compliance
        await this.deleteUserDataPartial(request.userId);
        retainedData.push('audit_logs', 'consent_records', 'billing_records');
      }

      // Update request with completion details
      await requestRef.update({
        status: 'completed',
        completedAt: new Date(),
        retainedData: retainedData.length > 0 ? retainedData : undefined,
      });

      console.log(`Data deletion completed for user ${request.userId}`);
    } catch (error) {
      console.error(`Data deletion failed for request ${requestId}:`, error);
      await requestRef.update({
        status: 'failed',
        completedAt: new Date(),
      });
    }
  }

  /**
   * Delete all user data (complete deletion)
   */
  private async deleteAllUserData(userId: string): Promise<void> {
    const batch = this.firestoreService.createBatch();

    // Get all user documents
    const documents = await this.firestoreService.getUserDocuments(userId, 1000);

    // Delete documents from storage and Firestore
    for (const document of documents) {
      if (document.storageInfo) {
        await this.storageService.deleteFile(
          document.storageInfo.bucketName,
          document.storageInfo.fileName
        );
      }

      // Delete document record
      const docRef = this.firestoreService.db.collection('documents').doc(document.id);
      batch.delete(docRef);
    }

    // Delete analyses
    const analysesSnapshot = await this.firestoreService.db
      .collection('analyses')
      .where('userId', '==', userId)
      .get();

    analysesSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    // Delete user profile
    const userRef = this.firestoreService.db.collection('users').doc(userId);
    batch.delete(userRef);

    // Commit all deletions
    await batch.commit();
  }

  /**
   * Delete user data partially (retain some for legal compliance)
   */
  private async deleteUserDataPartial(userId: string): Promise<void> {
    const batch = this.firestoreService.createBatch();

    // Delete documents and analyses (same as complete deletion)
    const documents = await this.firestoreService.getUserDocuments(userId, 1000);

    for (const document of documents) {
      if (document.storageInfo) {
        await this.storageService.deleteFile(
          document.storageInfo.bucketName,
          document.storageInfo.fileName
        );
      }

      const docRef = this.firestoreService.db.collection('documents').doc(document.id);
      batch.delete(docRef);
    }

    const analysesSnapshot = await this.firestoreService.db
      .collection('analyses')
      .where('userId', '==', userId)
      .get();

    analysesSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    // Anonymize user profile instead of deleting
    const userRef = this.firestoreService.db.collection('users').doc(userId);
    batch.update(userRef, {
      email: `deleted-user-${userId}@example.com`,
      'profile.name': 'Deleted User',
      'profile.preferences': {},
      deletedAt: new Date(),
    });

    await batch.commit();
  }

  /**
   * Get data export request status
   */
  async getDataExportStatus(requestId: string): Promise<DataExportRequest | null> {
    const requestDoc = await this.firestoreService.db
      .collection('data_export_requests')
      .doc(requestId)
      .get();

    if (!requestDoc.exists) {
      return null;
    }

    return requestDoc.data() as DataExportRequest;
  }

  /**
   * Get data deletion request status
   */
  async getDataDeletionStatus(requestId: string): Promise<DataDeletionRequest | null> {
    const requestDoc = await this.firestoreService.db
      .collection('data_deletion_requests')
      .doc(requestId)
      .get();

    if (!requestDoc.exists) {
      return null;
    }

    return requestDoc.data() as DataDeletionRequest;
  }

  /**
   * Clean up expired export files
   */
  async cleanupExpiredExports(): Promise<number> {
    const now = new Date();
    let filesDeleted = 0;

    try {
      const expiredExportsSnapshot = await this.firestoreService.db
        .collection('data_export_requests')
        .where('status', '==', 'completed')
        .where('expiresAt', '<', now)
        .get();

      for (const exportDoc of expiredExportsSnapshot.docs) {
        const exportRequest = exportDoc.data() as DataExportRequest;

        if (exportRequest.downloadUrl) {
          // Extract filename from URL and delete from storage
          const fileName = exportRequest.downloadUrl.split('/').pop()?.split('?')[0];
          if (fileName) {
            try {
              await this.storageService.deleteFile(storageConfig.tempBucket, fileName);
              filesDeleted++;
            } catch (error) {
              console.error(`Failed to delete export file ${fileName}:`, error);
            }
          }
        }

        // Update request to mark as expired
        await exportDoc.ref.update({
          downloadUrl: null,
          expiresAt: null,
        });
      }

      return filesDeleted;
    } catch (error) {
      console.error('Error during expired exports cleanup:', error);
      throw error;
    }
  }
}