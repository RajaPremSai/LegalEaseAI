/**
 * Load Testing Suite for Concurrent Users
 * Tests system performance under various load conditions
 */

import request from 'supertest';
import { app } from '../../index';
import { performance } from 'perf_hooks';
import cluster from 'cluster';
import { Worker } from 'worker_threads';

describe('Load Testing E2E Tests', () => {
  const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3001';
  
  // Test configuration
  const loadTestConfig = {
    lightLoad: { users: 10, duration: 30000 }, // 10 users for 30 seconds
    mediumLoad: { users: 50, duration: 60000 }, // 50 users for 1 minute
    heavyLoad: { users: 100, duration: 120000 }, // 100 users for 2 minutes
    spikeLoad: { users: 200, duration: 30000 }, // 200 users for 30 seconds (spike test)
  };

  // Mock document for testing
  const mockDocument = {
    filename: 'test-contract.pdf',
    content: `
      RENTAL AGREEMENT
      This lease agreement is between John Doe (Landlord) and Jane Smith (Tenant).
      Monthly rent: $2,000 due on the 1st of each month.
      Security deposit: $4,000 required upon signing.
      Lease term: 12 months starting January 1, 2024.
      Pet policy: No pets allowed without written consent.
      Maintenance: Tenant responsible for minor repairs under $100.
    `.repeat(10) // Make it larger to simulate real documents
  };

  // Helper function to simulate user behavior
  const simulateUserSession = async (userId: number): Promise<{
    success: boolean;
    responseTime: number;
    errors: string[];
  }> => {
    const errors: string[] = [];
    const startTime = performance.now();
    
    try {
      // Step 1: User authentication
      const authResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: `testuser${userId}@example.com`,
          password: 'testpassword123'
        })
        .timeout(10000);

      if (authResponse.status !== 200) {
        errors.push(`Auth failed: ${authResponse.status}`);
      }

      const token = authResponse.body.token;

      // Step 2: Document upload
      const uploadResponse = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('document', Buffer.from(mockDocument.content), mockDocument.filename)
        .timeout(30000);

      if (uploadResponse.status !== 200) {
        errors.push(`Upload failed: ${uploadResponse.status}`);
      }

      const documentId = uploadResponse.body.documentId;

      // Step 3: Wait for processing and get analysis
      let analysisComplete = false;
      let attempts = 0;
      const maxAttempts = 20;

      while (!analysisComplete && attempts < maxAttempts) {
        const statusResponse = await request(app)
          .get(`/api/documents/${documentId}/status`)
          .set('Authorization', `Bearer ${token}`)
          .timeout(5000);

        if (statusResponse.body.status === 'analyzed') {
          analysisComplete = true;
        } else if (statusResponse.body.status === 'error') {
          errors.push('Document analysis failed');
          break;
        }

        attempts++;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      if (!analysisComplete) {
        errors.push('Analysis timeout');
      }

      // Step 4: Get analysis results
      const analysisResponse = await request(app)
        .get(`/api/documents/${documentId}/analysis`)
        .set('Authorization', `Bearer ${token}`)
        .timeout(10000);

      if (analysisResponse.status !== 200) {
        errors.push(`Analysis retrieval failed: ${analysisResponse.status}`);
      }

      // Step 5: Ask a question
      const qaResponse = await request(app)
        .post(`/api/documents/${documentId}/qa`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          question: 'What is the monthly rent amount?'
        })
        .timeout(15000);

      if (qaResponse.status !== 200) {
        errors.push(`Q&A failed: ${qaResponse.status}`);
      }

      // Step 6: Get risk assessment
      const riskResponse = await request(app)
        .get(`/api/documents/${documentId}/risks`)
        .set('Authorization', `Bearer ${token}`)
        .timeout(10000);

      if (riskResponse.status !== 200) {
        errors.push(`Risk assessment failed: ${riskResponse.status}`);
      }

      const endTime = performance.now();
      return {
        success: errors.length === 0,
        responseTime: endTime - startTime,
        errors
      };

    } catch (error) {
      const endTime = performance.now();
      return {
        success: false,
        responseTime: endTime - startTime,
        errors: [`Exception: ${error.message}`]
      };
    }
  };

  // Helper function to run concurrent load test
  const runLoadTest = async (config: { users: number; duration: number }) => {
    const results: Array<{
      success: boolean;
      responseTime: number;
      errors: string[];
    }> = [];

    const startTime = Date.now();
    const promises: Promise<any>[] = [];

    // Start concurrent user sessions
    for (let i = 0; i < config.users; i++) {
      const userPromise = (async () => {
        while (Date.now() - startTime < config.duration) {
          const result = await simulateUserSession(i);
          results.push(result);
          
          // Wait a bit before next request to simulate real user behavior
          await new Promise(resolve => setTimeout(resolve, Math.random() * 5000 + 1000));
        }
      })();
      
      promises.push(userPromise);
    }

    // Wait for all users to complete
    await Promise.all(promises);

    // Calculate metrics
    const successfulRequests = results.filter(r => r.success).length;
    const failedRequests = results.length - successfulRequests;
    const successRate = (successfulRequests / results.length) * 100;
    
    const responseTimes = results.map(r => r.responseTime);
    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const minResponseTime = Math.min(...responseTimes);
    const maxResponseTime = Math.max(...responseTimes);
    
    // Calculate percentiles
    const sortedTimes = responseTimes.sort((a, b) => a - b);
    const p50 = sortedTimes[Math.floor(sortedTimes.length * 0.5)];
    const p90 = sortedTimes[Math.floor(sortedTimes.length * 0.9)];
    const p95 = sortedTimes[Math.floor(sortedTimes.length * 0.95)];
    const p99 = sortedTimes[Math.floor(sortedTimes.length * 0.99)];

    // Collect error summary
    const errorCounts: { [key: string]: number } = {};
    results.forEach(result => {
      result.errors.forEach(error => {
        errorCounts[error] = (errorCounts[error] || 0) + 1;
      });
    });

    return {
      totalRequests: results.length,
      successfulRequests,
      failedRequests,
      successRate,
      avgResponseTime,
      minResponseTime,
      maxResponseTime,
      percentiles: { p50, p90, p95, p99 },
      errorCounts,
      throughput: results.length / (config.duration / 1000) // requests per second
    };
  };

  describe('Light Load Testing', () => {
    test('should handle 10 concurrent users with acceptable performance', async () => {
      const results = await runLoadTest(loadTestConfig.lightLoad);

      expect(results.successRate).toBeGreaterThan(95); // 95% success rate
      expect(results.avgResponseTime).toBeLessThan(5000); // Average response under 5 seconds
      expect(results.percentiles.p95).toBeLessThan(10000); // 95th percentile under 10 seconds
      expect(results.throughput).toBeGreaterThan(0.5); // At least 0.5 requests per second
    }, 60000);
  });

  describe('Medium Load Testing', () => {
    test('should handle 50 concurrent users with degraded but acceptable performance', async () => {
      const results = await runLoadTest(loadTestConfig.mediumLoad);

      expect(results.successRate).toBeGreaterThan(90); // 90% success rate
      expect(results.avgResponseTime).toBeLessThan(10000); // Average response under 10 seconds
      expect(results.percentiles.p95).toBeLessThan(20000); // 95th percentile under 20 seconds
      expect(results.throughput).toBeGreaterThan(1.0); // At least 1 request per second
    }, 120000);
  });

  describe('Heavy Load Testing', () => {
    test('should handle 100 concurrent users without system failure', async () => {
      const results = await runLoadTest(loadTestConfig.heavyLoad);

      expect(results.successRate).toBeGreaterThan(80); // 80% success rate minimum
      expect(results.avgResponseTime).toBeLessThan(15000); // Average response under 15 seconds
      expect(results.percentiles.p99).toBeLessThan(30000); // 99th percentile under 30 seconds
      expect(results.throughput).toBeGreaterThan(1.5); // At least 1.5 requests per second
      
      // Check that no critical errors occurred
      const criticalErrors = Object.keys(results.errorCounts).filter(error => 
        error.includes('500') || error.includes('timeout') || error.includes('connection')
      );
      expect(criticalErrors.length).toBeLessThan(3); // No more than 3 types of critical errors
    }, 180000);
  });

  describe('Spike Load Testing', () => {
    test('should handle sudden spike of 200 concurrent users', async () => {
      const results = await runLoadTest(loadTestConfig.spikeLoad);

      // More lenient requirements for spike testing
      expect(results.successRate).toBeGreaterThan(70); // 70% success rate minimum
      expect(results.avgResponseTime).toBeLessThan(20000); // Average response under 20 seconds
      
      // System should recover and not crash
      expect(results.totalRequests).toBeGreaterThan(0);
      
      // Check for rate limiting responses (which are expected)
      const rateLimitErrors = results.errorCounts['429'] || 0;
      expect(rateLimitErrors).toBeLessThan(results.totalRequests * 0.5); // Less than 50% rate limited
    }, 60000);
  });

  describe('Database Performance Under Load', () => {
    test('should maintain database performance under concurrent access', async () => {
      const dbTestPromises = [];
      
      // Simulate 50 concurrent database operations
      for (let i = 0; i < 50; i++) {
        const promise = (async () => {
          const startTime = performance.now();
          
          const response = await request(app)
            .get('/api/health/database')
            .timeout(5000);
          
          const endTime = performance.now();
          
          return {
            success: response.status === 200,
            responseTime: endTime - startTime,
            connectionCount: response.body.activeConnections
          };
        })();
        
        dbTestPromises.push(promise);
      }

      const dbResults = await Promise.all(dbTestPromises);
      
      const successfulDbQueries = dbResults.filter(r => r.success).length;
      const avgDbResponseTime = dbResults.reduce((sum, r) => sum + r.responseTime, 0) / dbResults.length;
      
      expect(successfulDbQueries / dbResults.length).toBeGreaterThan(0.95); // 95% success rate
      expect(avgDbResponseTime).toBeLessThan(1000); // Average DB response under 1 second
    });
  });

  describe('Memory and Resource Usage', () => {
    test('should not exceed memory limits under load', async () => {
      const initialMemory = process.memoryUsage();
      
      // Run a medium load test
      await runLoadTest({ users: 30, duration: 30000 });
      
      const finalMemory = process.memoryUsage();
      
      // Memory usage should not increase by more than 200MB
      const memoryIncrease = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;
      expect(memoryIncrease).toBeLessThan(200);
      
      // Force garbage collection and check for memory leaks
      if (global.gc) {
        global.gc();
        const afterGcMemory = process.memoryUsage();
        const memoryAfterGc = (afterGcMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;
        expect(memoryAfterGc).toBeLessThan(100); // Should be much lower after GC
      }
    }, 60000);
  });

  describe('API Rate Limiting', () => {
    test('should properly enforce rate limits', async () => {
      const rateLimitPromises = [];
      
      // Make 100 rapid requests from the same IP
      for (let i = 0; i < 100; i++) {
        const promise = request(app)
          .get('/api/health')
          .timeout(5000);
        
        rateLimitPromises.push(promise);
      }

      const responses = await Promise.allSettled(rateLimitPromises);
      
      const successfulResponses = responses.filter(r => 
        r.status === 'fulfilled' && r.value.status === 200
      ).length;
      
      const rateLimitedResponses = responses.filter(r => 
        r.status === 'fulfilled' && r.value.status === 429
      ).length;

      // Should have some rate limited responses
      expect(rateLimitedResponses).toBeGreaterThan(0);
      
      // But not all requests should be blocked
      expect(successfulResponses).toBeGreaterThan(10);
    });
  });

  describe('Error Recovery and Circuit Breaker', () => {
    test('should implement circuit breaker for external services', async () => {
      // Mock external service failures
      const originalFetch = global.fetch;
      let failureCount = 0;
      
      global.fetch = jest.fn().mockImplementation((...args) => {
        failureCount++;
        if (failureCount <= 10) {
          return Promise.reject(new Error('Service unavailable'));
        }
        return originalFetch(...args);
      });

      const testPromises = [];
      
      // Make requests that will trigger circuit breaker
      for (let i = 0; i < 20; i++) {
        const promise = request(app)
          .post('/api/documents/analyze')
          .send({ content: 'test document' })
          .timeout(5000);
        
        testPromises.push(promise);
      }

      const results = await Promise.allSettled(testPromises);
      
      // Should have some circuit breaker responses (503 Service Unavailable)
      const circuitBreakerResponses = results.filter(r => 
        r.status === 'fulfilled' && r.value.status === 503
      ).length;

      expect(circuitBreakerResponses).toBeGreaterThan(0);
      
      global.fetch = originalFetch;
    });
  });

  describe('Graceful Degradation', () => {
    test('should degrade gracefully when AI services are overloaded', async () => {
      // Simulate AI service overload by making many concurrent AI requests
      const aiTestPromises = [];
      
      for (let i = 0; i < 20; i++) {
        const promise = request(app)
          .post('/api/ai/analyze')
          .send({
            documentContent: mockDocument.content,
            analysisType: 'full'
          })
          .timeout(30000);
        
        aiTestPromises.push(promise);
      }

      const aiResults = await Promise.allSettled(aiTestPromises);
      
      const successfulAiRequests = aiResults.filter(r => 
        r.status === 'fulfilled' && r.value.status === 200
      ).length;
      
      const queuedRequests = aiResults.filter(r => 
        r.status === 'fulfilled' && r.value.status === 202 // Accepted but queued
      ).length;

      // Should handle at least some requests successfully or queue them
      expect(successfulAiRequests + queuedRequests).toBeGreaterThan(10);
    });
  });
});