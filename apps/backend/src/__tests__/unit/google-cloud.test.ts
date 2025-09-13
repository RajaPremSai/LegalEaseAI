import { GoogleCloudService, initializeGoogleCloud } from '../../config/google-cloud';

describe('Google Cloud Service Unit Tests', () => {
  describe('Service Initialization', () => {
    it('should initialize Google Cloud service with valid config', () => {
      const config = {
        projectId: 'test-project',
        location: 'us-central1',
        processorId: 'test-processor',
      };

      const service = initializeGoogleCloud(config);
      expect(service).toBeDefined();
      expect(service.getConfig()).toEqual(config);
    });

    it('should return the same instance on subsequent calls', () => {
      const config = {
        projectId: 'test-project-2',
        location: 'us-central1',
        processorId: 'test-processor-2',
      };

      const service1 = initializeGoogleCloud(config);
      const service2 = initializeGoogleCloud(config);
      
      expect(service1).toBe(service2);
    });

    it('should provide access to all Google Cloud clients', () => {
      const config = {
        projectId: 'test-project',
        location: 'us-central1',
        processorId: 'test-processor',
      };

      const service = initializeGoogleCloud(config);
      
      expect(service.getDocumentAI()).toBeDefined();
      expect(service.getFirestore()).toBeDefined();
      expect(service.getStorage()).toBeDefined();
      expect(service.getTranslate()).toBeDefined();
    });
  });
});