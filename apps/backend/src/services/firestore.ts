import { Firestore, CollectionReference, DocumentReference, Query } from '@google-cloud/firestore';
import { getGoogleCloudService } from '../config/google-cloud';

export interface FirestoreConfig {
  collections: {
    users: string;
    documents: string;
    analyses: string;
    sessions: string;
  };
}

export interface UserDocument {
  id: string;
  email: string;
  profile: {
    name: string;
    userType: 'individual' | 'small_business' | 'enterprise';
    jurisdiction: string;
    preferences: Record<string, any>;
  };
  subscription: {
    plan: 'free' | 'premium' | 'enterprise';
    documentsRemaining: number;
    renewsAt: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentRecord {
  id: string;
  userId: string;
  filename: string;
  originalName: string;
  documentType: string;
  jurisdiction: string;
  uploadedAt: Date;
  expiresAt: Date;
  status: 'processing' | 'analyzed' | 'error';
  metadata: {
    pageCount: number;
    wordCount: number;
    language: string;
    fileSize: number;
    mimeType: string;
  };
  storageInfo: {
    bucketName: string;
    fileName: string;
  };
}

export interface AnalysisRecord {
  id: string;
  documentId: string;
  userId: string;
  summary: string;
  riskScore: 'low' | 'medium' | 'high';
  keyTerms: Array<{
    term: string;
    definition: string;
    importance: 'high' | 'medium' | 'low';
    location: { page: number; section: string };
  }>;
  risks: Array<{
    category: 'financial' | 'legal' | 'privacy' | 'operational';
    severity: 'high' | 'medium' | 'low';
    description: string;
    affectedClause: string;
    recommendation: string;
  }>;
  recommendations: string[];
  generatedAt: Date;
}

export class FirestoreService {
  private firestore: Firestore;
  private config: FirestoreConfig;

  constructor(config: FirestoreConfig) {
    this.firestore = getGoogleCloudService().getFirestore();
    this.config = config;
  }

  /**
   * Initialize Firestore with security rules
   */
  async initializeFirestore(): Promise<void> {
    try {
      // Create indexes for common queries
      await this.createIndexes();
      console.log('Firestore initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Firestore:', error);
      throw error;
    }
  }

  /**
   * Create necessary indexes for efficient queries
   */
  private async createIndexes(): Promise<void> {
    // Note: In production, indexes should be created via Firebase CLI or console
    // This is just for documentation purposes
    console.log('Firestore indexes should be created via Firebase CLI:');
    console.log('- documents: userId, uploadedAt (descending)');
    console.log('- documents: userId, status, uploadedAt (descending)');
    console.log('- analyses: userId, generatedAt (descending)');
  }

  // User operations
  async createUser(user: Omit<UserDocument, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const userRef = this.firestore.collection(this.config.collections.users).doc();
    const userData: UserDocument = {
      ...user,
      id: userRef.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await userRef.set(userData);
    return userRef.id;
  }

  async getUser(userId: string): Promise<UserDocument | null> {
    const userRef = this.firestore.collection(this.config.collections.users).doc(userId);
    const doc = await userRef.get();
    
    if (!doc.exists) {
      return null;
    }

    return doc.data() as UserDocument;
  }

  async updateUser(userId: string, updates: Partial<UserDocument>): Promise<void> {
    const userRef = this.firestore.collection(this.config.collections.users).doc(userId);
    await userRef.update({
      ...updates,
      updatedAt: new Date(),
    });
  }

  async getUserByEmail(email: string): Promise<UserDocument | null> {
    const query = this.firestore
      .collection(this.config.collections.users)
      .where('email', '==', email)
      .limit(1);

    const snapshot = await query.get();
    
    if (snapshot.empty) {
      return null;
    }

    return snapshot.docs[0].data() as UserDocument;
  }

  // Document operations
  async createDocument(document: Omit<DocumentRecord, 'id'>): Promise<string> {
    const docRef = this.firestore.collection(this.config.collections.documents).doc();
    const documentData: DocumentRecord = {
      ...document,
      id: docRef.id,
    };

    await docRef.set(documentData);
    return docRef.id;
  }

  async getDocument(documentId: string): Promise<DocumentRecord | null> {
    const docRef = this.firestore.collection(this.config.collections.documents).doc(documentId);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return null;
    }

    return doc.data() as DocumentRecord;
  }

  async updateDocument(documentId: string, updates: Partial<DocumentRecord>): Promise<void> {
    const docRef = this.firestore.collection(this.config.collections.documents).doc(documentId);
    await docRef.update(updates);
  }

  async getUserDocuments(userId: string, limit: number = 50): Promise<DocumentRecord[]> {
    const query = this.firestore
      .collection(this.config.collections.documents)
      .where('userId', '==', userId)
      .orderBy('uploadedAt', 'desc')
      .limit(limit);

    const snapshot = await query.get();
    return snapshot.docs.map(doc => doc.data() as DocumentRecord);
  }

  async deleteDocument(documentId: string): Promise<void> {
    const docRef = this.firestore.collection(this.config.collections.documents).doc(documentId);
    await docRef.delete();
  }

  // Analysis operations
  async createAnalysis(analysis: Omit<AnalysisRecord, 'id'>): Promise<string> {
    const analysisRef = this.firestore.collection(this.config.collections.analyses).doc();
    const analysisData: AnalysisRecord = {
      ...analysis,
      id: analysisRef.id,
    };

    await analysisRef.set(analysisData);
    return analysisRef.id;
  }

  async getAnalysis(analysisId: string): Promise<AnalysisRecord | null> {
    const analysisRef = this.firestore.collection(this.config.collections.analyses).doc(analysisId);
    const doc = await analysisRef.get();
    
    if (!doc.exists) {
      return null;
    }

    return doc.data() as AnalysisRecord;
  }

  async getAnalysisByDocumentId(documentId: string): Promise<AnalysisRecord | null> {
    const query = this.firestore
      .collection(this.config.collections.analyses)
      .where('documentId', '==', documentId)
      .limit(1);

    const snapshot = await query.get();
    
    if (snapshot.empty) {
      return null;
    }

    return snapshot.docs[0].data() as AnalysisRecord;
  }

  async getUserAnalyses(userId: string, limit: number = 50): Promise<AnalysisRecord[]> {
    const query = this.firestore
      .collection(this.config.collections.analyses)
      .where('userId', '==', userId)
      .orderBy('generatedAt', 'desc')
      .limit(limit);

    const snapshot = await query.get();
    return snapshot.docs.map(doc => doc.data() as AnalysisRecord);
  }

  // Cleanup operations
  async cleanupExpiredDocuments(): Promise<void> {
    const now = new Date();
    const query = this.firestore
      .collection(this.config.collections.documents)
      .where('expiresAt', '<', now);

    const snapshot = await query.get();
    const batch = this.firestore.batch();

    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    if (!snapshot.empty) {
      await batch.commit();
      console.log(`Cleaned up ${snapshot.size} expired documents from Firestore`);
    }
  }

  // Transaction support
  async runTransaction<T>(updateFunction: (transaction: FirebaseFirestore.Transaction) => Promise<T>): Promise<T> {
    return this.firestore.runTransaction(updateFunction);
  }

  // Batch operations
  createBatch(): FirebaseFirestore.WriteBatch {
    return this.firestore.batch();
  }

  // Array operations for Firestore
  arrayUnion(...elements: any[]): FirebaseFirestore.FieldValue {
    return this.firestore.FieldValue.arrayUnion(...elements);
  }

  arrayRemove(...elements: any[]): FirebaseFirestore.FieldValue {
    return this.firestore.FieldValue.arrayRemove(...elements);
  }

  // Direct database access for Q&A service
  get db(): Firestore {
    return this.firestore;
  }
}

// Default configuration
const defaultConfig: FirestoreConfig = {
  collections: {
    users: 'users',
    documents: 'documents',
    analyses: 'analyses',
    sessions: 'sessions'
  }
};

// Export default instance
export const firestoreService = new FirestoreService(defaultConfig);