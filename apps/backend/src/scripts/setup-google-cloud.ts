#!/usr/bin/env ts-node

/**
 * Google Cloud Infrastructure Setup Script
 * 
 * This script initializes the Google Cloud infrastructure required for the
 * Legal Document AI Assistant application.
 * 
 * Usage:
 *   npm run setup:gcloud
 *   or
 *   ts-node src/scripts/setup-google-cloud.ts
 */

import { initializeGoogleCloud } from '../config/google-cloud';
import { CloudStorageService } from '../services/storage';
import { FirestoreService } from '../services/firestore';
import { 
  googleCloudConfig, 
  storageConfig, 
  firestoreConfig,
  isDevelopment 
} from '../config/environment';

interface SetupResult {
  success: boolean;
  message: string;
  details?: any;
}

class GoogleCloudSetup {
  private googleCloudService: any;
  private storageService: CloudStorageService | null = null;
  private firestoreService: FirestoreService | null = null;

  async run(): Promise<void> {
    console.log('🚀 Starting Google Cloud Infrastructure Setup...\n');

    const results: SetupResult[] = [];

    // Step 1: Initialize Google Cloud Service
    results.push(await this.initializeServices());

    // Step 2: Test connectivity
    results.push(await this.testConnectivity());

    // Step 3: Setup Cloud Storage
    results.push(await this.setupCloudStorage());

    // Step 4: Setup Firestore
    results.push(await this.setupFirestore());

    // Step 5: Verify setup
    results.push(await this.verifySetup());

    // Print results
    this.printResults(results);

    // Exit with appropriate code
    const hasFailures = results.some(result => !result.success);
    process.exit(hasFailures ? 1 : 0);
  }

  private async initializeServices(): Promise<SetupResult> {
    try {
      console.log('📋 Initializing Google Cloud services...');
      
      this.googleCloudService = initializeGoogleCloud(googleCloudConfig);
      this.storageService = new CloudStorageService(storageConfig);
      this.firestoreService = new FirestoreService(firestoreConfig);

      return {
        success: true,
        message: 'Google Cloud services initialized successfully',
        details: {
          projectId: googleCloudConfig.projectId,
          location: googleCloudConfig.location,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to initialize Google Cloud services',
        details: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async testConnectivity(): Promise<SetupResult> {
    try {
      console.log('🔍 Testing connectivity to Google Cloud services...');
      
      if (!this.googleCloudService) {
        throw new Error('Google Cloud service not initialized');
      }

      const connectivity = await this.googleCloudService.testConnectivity();
      
      const connectedServices = Object.entries(connectivity)
        .filter(([_, connected]) => connected)
        .map(([service, _]) => service);

      const failedServices = Object.entries(connectivity)
        .filter(([_, connected]) => !connected)
        .map(([service, _]) => service);

      if (failedServices.length > 0) {
        console.warn(`⚠️  Some services are not accessible: ${failedServices.join(', ')}`);
        
        if (isDevelopment()) {
          console.log('ℹ️  This is expected in development environment without proper credentials');
        }
      }

      return {
        success: connectedServices.length > 0 || isDevelopment(),
        message: `Connectivity test completed`,
        details: {
          connected: connectedServices,
          failed: failedServices,
          isDevelopment: isDevelopment(),
        },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Connectivity test failed',
        details: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async setupCloudStorage(): Promise<SetupResult> {
    try {
      console.log('🗄️  Setting up Cloud Storage buckets...');
      
      if (!this.storageService) {
        throw new Error('Storage service not initialized');
      }

      await this.storageService.initializeBuckets();

      return {
        success: true,
        message: 'Cloud Storage buckets configured successfully',
        details: {
          documentsBucket: storageConfig.documentsBucket,
          tempBucket: storageConfig.tempBucket,
          maxFileSize: `${Math.round(storageConfig.maxFileSize / 1024 / 1024)}MB`,
          retentionHours: storageConfig.documentRetentionHours,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // In development, bucket creation might fail due to permissions
      if (isDevelopment() && errorMessage.includes('permission')) {
        return {
          success: true,
          message: 'Cloud Storage setup skipped in development (permission issues expected)',
          details: { reason: 'Development environment', error: errorMessage },
        };
      }

      return {
        success: false,
        message: 'Failed to setup Cloud Storage buckets',
        details: errorMessage,
      };
    }
  }

  private async setupFirestore(): Promise<SetupResult> {
    try {
      console.log('🔥 Setting up Firestore database...');
      
      if (!this.firestoreService) {
        throw new Error('Firestore service not initialized');
      }

      await this.firestoreService.initializeFirestore();

      return {
        success: true,
        message: 'Firestore database configured successfully',
        details: {
          collections: firestoreConfig.collections,
          securityRules: 'firestore.rules',
        },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to setup Firestore database',
        details: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async verifySetup(): Promise<SetupResult> {
    try {
      console.log('✅ Verifying complete setup...');
      
      const checks = [];

      // Check if services are initialized
      if (this.googleCloudService) {
        checks.push('Google Cloud Service: ✓');
      } else {
        checks.push('Google Cloud Service: ✗');
      }

      if (this.storageService) {
        checks.push('Cloud Storage Service: ✓');
      } else {
        checks.push('Cloud Storage Service: ✗');
      }

      if (this.firestoreService) {
        checks.push('Firestore Service: ✓');
      } else {
        checks.push('Firestore Service: ✗');
      }

      // Check configuration
      const configChecks = [
        `Project ID: ${googleCloudConfig.projectId}`,
        `Location: ${googleCloudConfig.location}`,
        `Processor ID: ${googleCloudConfig.processorId ? '✓' : '✗'}`,
        `Documents Bucket: ${storageConfig.documentsBucket}`,
        `Temp Bucket: ${storageConfig.tempBucket}`,
      ];

      return {
        success: true,
        message: 'Setup verification completed',
        details: {
          services: checks,
          configuration: configChecks,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Setup verification failed',
        details: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private printResults(results: SetupResult[]): void {
    console.log('\n📊 Setup Results:');
    console.log('==================');

    results.forEach((result, index) => {
      const icon = result.success ? '✅' : '❌';
      console.log(`${icon} ${result.message}`);
      
      if (result.details) {
        if (typeof result.details === 'string') {
          console.log(`   Details: ${result.details}`);
        } else {
          console.log(`   Details:`, JSON.stringify(result.details, null, 2));
        }
      }
      console.log('');
    });

    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;

    console.log(`Summary: ${successCount}/${totalCount} steps completed successfully`);

    if (successCount === totalCount) {
      console.log('🎉 Google Cloud infrastructure setup completed successfully!');
      console.log('\nNext steps:');
      console.log('1. Deploy Firestore security rules: firebase deploy --only firestore:rules');
      console.log('2. Configure Document AI processor in Google Cloud Console');
      console.log('3. Set up IAM roles for service accounts');
      console.log('4. Run integration tests: npm test -- --testPathPattern=integration');
    } else {
      console.log('⚠️  Some setup steps failed. Please review the errors above.');
      
      if (isDevelopment()) {
        console.log('\nℹ️  In development environment, some failures are expected.');
        console.log('   Make sure you have:');
        console.log('   - Valid Google Cloud credentials');
        console.log('   - Required APIs enabled');
        console.log('   - Proper IAM permissions');
      }
    }
  }
}

// Run the setup if this script is executed directly
if (require.main === module) {
  const setup = new GoogleCloudSetup();
  setup.run().catch((error) => {
    console.error('❌ Setup failed with unexpected error:', error);
    process.exit(1);
  });
}

export { GoogleCloudSetup };