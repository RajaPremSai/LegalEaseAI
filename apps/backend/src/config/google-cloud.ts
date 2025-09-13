import { DocumentProcessorServiceClient } from '@google-cloud/documentai';
import { Firestore } from '@google-cloud/firestore';
import { Storage } from '@google-cloud/storage';
import { TranslationServiceClient } from '@google-cloud/translate';

export interface GoogleCloudConfig {
  projectId: string;
  location: string;
  processorId: string;
  keyFilename?: string;
  credentials?: object;
}

export class GoogleCloudService {
  private config: GoogleCloudConfig;
  private documentAI: DocumentProcessorServiceClient;
  private firestore: Firestore;
  private storage: Storage;
  private translate: TranslationServiceClient;

  constructor(config: GoogleCloudConfig) {
    this.config = config;
    
    const clientOptions = {
      projectId: config.projectId,
      ...(config.keyFilename && { keyFilename: config.keyFilename }),
      ...(config.credentials && { credentials: config.credentials }),
    };

    // Initialize Google Cloud services
    this.documentAI = new DocumentProcessorServiceClient(clientOptions);
    this.firestore = new Firestore(clientOptions);
    this.storage = new Storage(clientOptions);
    this.translate = new TranslationServiceClient(clientOptions);
  }

  /**
   * Get Document AI client
   */
  getDocumentAI(): DocumentProcessorServiceClient {
    return this.documentAI;
  }

  /**
   * Get Firestore client
   */
  getFirestore(): Firestore {
    return this.firestore;
  }

  /**
   * Get Cloud Storage client
   */
  getStorage(): Storage {
    return this.storage;
  }

  /**
   * Get Translation client
   */
  getTranslate(): TranslationServiceClient {
    return this.translate;
  }

  /**
   * Get project configuration
   */
  getConfig(): GoogleCloudConfig {
    return { ...this.config };
  }

  /**
   * Test connectivity to all Google Cloud services
   */
  async testConnectivity(): Promise<{
    documentAI: boolean;
    firestore: boolean;
    storage: boolean;
    translate: boolean;
  }> {
    const results = {
      documentAI: false,
      firestore: false,
      storage: false,
      translate: false,
    };

    try {
      // Test Document AI
      await this.documentAI.getProcessor({
        name: `projects/${this.config.projectId}/locations/${this.config.location}/processors/${this.config.processorId}`,
      });
      results.documentAI = true;
    } catch (error) {
      console.error('Document AI connectivity test failed:', error);
    }

    try {
      // Test Firestore
      await this.firestore.listCollections();
      results.firestore = true;
    } catch (error) {
      console.error('Firestore connectivity test failed:', error);
    }

    try {
      // Test Cloud Storage
      await this.storage.getBuckets();
      results.storage = true;
    } catch (error) {
      console.error('Cloud Storage connectivity test failed:', error);
    }

    try {
      // Test Translation API
      await this.translate.getSupportedLanguages({
        parent: `projects/${this.config.projectId}`,
      });
      results.translate = true;
    } catch (error) {
      console.error('Translation API connectivity test failed:', error);
    }

    return results;
  }
}

// Singleton instance
let googleCloudService: GoogleCloudService | null = null;

export function initializeGoogleCloud(config: GoogleCloudConfig): GoogleCloudService {
  if (!googleCloudService) {
    googleCloudService = new GoogleCloudService(config);
  }
  return googleCloudService;
}

export function getGoogleCloudService(): GoogleCloudService {
  if (!googleCloudService) {
    throw new Error('Google Cloud service not initialized. Call initializeGoogleCloud first.');
  }
  return googleCloudService;
}