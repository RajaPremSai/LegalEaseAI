import request from 'supertest';
import express from 'express';
import {
  compressionMiddleware,
  timingMiddleware,
  cacheMiddleware,
  deduplicationMiddleware,
  performanceCollector,
  responseCache,
} from '../middleware/performance';
import aiOptimizationService from '../services/aiOptimization';

describe('Backend Performance Optimizations', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    responseCache.clear();
    performanceCollector.reset();
  });

  describe('Compression Middleware', () => {
    beforeEach(() => {
      app.use(compressionMiddleware);
      app.get('/test', (req, res) => {
        res.json({ message: 'A'.repeat(2000) }); // Large response
      });
    });

    it('should compress large responses', async () => {
      const response = await request(app)
        .get('/test')
        .set('Accept-Encoding', 'gzip');

      expect(response.headers['content-encoding']).toBe('gzip');
    });

    it('should not compress small responses', async () => {
      app.get('/small', (req, res) => {
        res.json({ message: 'small' });
      });

      const response = await request(app)
        .get('/small')
        .set('Accept-Encoding', 'gzip');

      expect(response.headers['content-encoding']).toBeUndefined();
    });
  });

  describe('Timing Middleware', () => {
    beforeEach(() => {
      app.use(timingMiddleware);
      app.get('/test', (req, res) => {
        setTimeout(() => res.json({ message: 'delayed' }), 10);
      });
    });

    it('should add response time header', async () => {
      const response = await request(app).get('/test');
      
      expect(response.headers['x-response-time']).toBeDefined();
      expect(response.headers['x-response-time']).toMatch(/\d+\.\d+ms/);
    });
  });

  describe('Cache Middleware', () => {
    beforeEach(() => {
      app.use(cacheMiddleware(1000)); // 1 second TTL
      app.get('/test', (req, res) => {
        res.json({ timestamp: Date.now() });
      });
    });

    it('should cache GET responses', async () => {
      const response1 = await request(app).get('/test');
      const response2 = await request(app).get('/test');

      expect(response1.body.timestamp).toBe(response2.body.timestamp);
      expect(response2.headers.etag).toBeDefined();
    });

    it('should return 304 for matching ETags', async () => {
      const response1 = await request(app).get('/test');
      const etag = response1.headers.etag;

      const response2 = await request(app)
        .get('/test')
        .set('If-None-Match', etag);

      expect(response2.status).toBe(304);
    });

    it('should not cache non-GET requests', async () => {
      app.post('/test', (req, res) => {
        res.json({ timestamp: Date.now() });
      });

      const response1 = await request(app).post('/test');
      const response2 = await request(app).post('/test');

      expect(response1.body.timestamp).not.toBe(response2.body.timestamp);
    });
  });

  describe('Deduplication Middleware', () => {
    let requestCount = 0;

    beforeEach(() => {
      requestCount = 0;
      app.use(deduplicationMiddleware);
      app.get('/test', (req, res) => {
        requestCount++;
        setTimeout(() => res.json({ count: requestCount }), 50);
      });
    });

    it('should deduplicate concurrent identical requests', async () => {
      const promises = Array(5).fill(null).map(() => request(app).get('/test'));
      const responses = await Promise.all(promises);

      // All responses should have the same count (only one actual request processed)
      const counts = responses.map(r => r.body.count);
      expect(new Set(counts).size).toBe(1);
      expect(requestCount).toBe(1);
    });
  });

  describe('Performance Metrics Collection', () => {
    it('should collect request metrics', async () => {
      app.use((req, res, next) => {
        const startTime = process.hrtime.bigint();
        res.on('finish', () => {
          const endTime = process.hrtime.bigint();
          const responseTime = Number(endTime - startTime) / 1000000;
          performanceCollector.recordRequest(responseTime, res.statusCode >= 400);
        });
        next();
      });

      app.get('/test', (req, res) => res.json({ message: 'test' }));

      await request(app).get('/test');
      
      const metrics = performanceCollector.getMetrics();
      expect(metrics.requestCount).toBe(1);
      expect(metrics.averageResponseTime).toBeGreaterThan(0);
    });

    it('should track error rates', async () => {
      app.use((req, res, next) => {
        res.on('finish', () => {
          performanceCollector.recordRequest(10, res.statusCode >= 400);
        });
        next();
      });

      app.get('/success', (req, res) => res.json({ message: 'success' }));
      app.get('/error', (req, res) => res.status(500).json({ error: 'error' }));

      await request(app).get('/success');
      await request(app).get('/error');

      const metrics = performanceCollector.getMetrics();
      expect(metrics.requestCount).toBe(2);
      expect(metrics.errorRate).toBe(50);
    });
  });

  describe('AI Optimization Service', () => {
    beforeEach(() => {
      aiOptimizationService.clearCache();
    });

    it('should cache AI responses', async () => {
      // Mock the AI service call
      const originalCallModel = (aiOptimizationService as any).callModel;
      let callCount = 0;
      
      (aiOptimizationService as any).callModel = jest.fn().mockImplementation(async (prompt: string) => {
        callCount++;
        return {
          content: `Response for: ${prompt}`,
          confidence: 0.9,
          tokens: 100,
          responseTime: 50,
        };
      });

      const prompt = 'Test prompt';
      
      // First call
      const response1 = await aiOptimizationService.generateResponse(prompt);
      
      // Second call (should be cached)
      const response2 = await aiOptimizationService.generateResponse(prompt);

      expect(response1.content).toBe(response2.content);
      expect(callCount).toBe(1); // Only one actual AI call

      // Restore original method
      (aiOptimizationService as any).callModel = originalCallModel;
    });

    it('should handle document chunking', async () => {
      const longDocument = 'A'.repeat(10000); // Long document
      
      // Mock the chunk processing
      const originalGenerateAnalysisForChunk = (aiOptimizationService as any).generateAnalysisForChunk;
      (aiOptimizationService as any).generateAnalysisForChunk = jest.fn().mockResolvedValue({
        content: 'Chunk analysis',
        confidence: 0.8,
        tokens: 50,
        responseTime: 25,
      });

      const result = await aiOptimizationService.analyzeDocumentOptimized(longDocument, 'summary');

      expect(result.content).toContain('Chunk analysis');
      expect((aiOptimizationService as any).generateAnalysisForChunk).toHaveBeenCalled();

      // Restore original method
      (aiOptimizationService as any).generateAnalysisForChunk = originalGenerateAnalysisForChunk;
    });

    it('should provide performance metrics', () => {
      const metrics = aiOptimizationService.getMetrics();
      
      expect(metrics).toHaveProperty('cacheSize');
      expect(metrics).toHaveProperty('queueLength');
      expect(metrics).toHaveProperty('processingBatch');
    });
  });

  describe('Memory Management', () => {
    it('should cleanup expired cache entries', (done) => {
      const shortTTL = 10; // 10ms
      
      responseCache.set('test-key', { data: 'test' }, shortTTL);
      expect(responseCache.size()).toBe(1);

      setTimeout(() => {
        responseCache.cleanup();
        expect(responseCache.size()).toBe(0);
        done();
      }, 20);
    });

    it('should monitor memory usage', () => {
      const memUsage = process.memoryUsage();
      
      expect(memUsage.heapUsed).toBeGreaterThan(0);
      expect(memUsage.heapTotal).toBeGreaterThan(0);
      expect(memUsage.external).toBeGreaterThan(0);
    });
  });
});

describe('Performance Benchmarks', () => {
  const runBenchmark = async (name: string, fn: () => Promise<void>, iterations = 100) => {
    const start = process.hrtime.bigint();
    
    for (let i = 0; i < iterations; i++) {
      await fn();
    }
    
    const end = process.hrtime.bigint();
    const avgTime = Number(end - start) / 1000000 / iterations; // Convert to milliseconds
    
    console.log(`${name}: ${avgTime.toFixed(4)}ms per operation`);
    return avgTime;
  };

  it('should benchmark cache operations', async () => {
    const cacheSetTime = await runBenchmark('Cache Set', async () => {
      responseCache.set('benchmark-key', { data: 'test' });
    });

    const cacheGetTime = await runBenchmark('Cache Get', async () => {
      responseCache.get('benchmark-key');
    });

    expect(cacheSetTime).toBeLessThan(1); // Should be very fast
    expect(cacheGetTime).toBeLessThan(1); // Should be very fast
  });

  it('should benchmark JSON serialization', async () => {
    const largeObject = {
      data: Array(1000).fill(0).map((_, i) => ({ id: i, name: `Item ${i}` }))
    };

    const serializationTime = await runBenchmark('JSON Serialization', async () => {
      JSON.stringify(largeObject);
    });

    const deserializationTime = await runBenchmark('JSON Deserialization', async () => {
      JSON.parse(JSON.stringify(largeObject));
    });

    expect(serializationTime).toBeLessThan(10);
    expect(deserializationTime).toBeLessThan(10);
  });
});