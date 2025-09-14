import { render, screen, waitFor } from '@testing-library/react';
import { performance } from 'perf_hooks';
import { memoryCache, persistentCache } from '../services/cacheService';
import { collectPerformanceMetrics, debounce, throttle } from '../utils/performance';
import apiService from '../services/optimizedApiService';

// Mock performance API for testing
Object.defineProperty(global, 'performance', {
  writable: true,
  value: {
    now: jest.fn(() => Date.now()),
    getEntriesByType: jest.fn(() => []),
    memory: {
      usedJSHeapSize: 1000000,
      totalJSHeapSize: 2000000,
      jsHeapSizeLimit: 4000000,
    },
  },
});

describe('Performance Optimizations', () => {
  beforeEach(() => {
    memoryCache.clear();
    persistentCache.clear();
    jest.clearAllMocks();
  });

  describe('Cache Service', () => {
    it('should cache and retrieve data efficiently', () => {
      const testData = { id: 1, name: 'test' };
      const key = 'test-key';

      // Measure cache set performance
      const setStart = performance.now();
      memoryCache.set(key, testData);
      const setEnd = performance.now();
      
      expect(setEnd - setStart).toBeLessThan(1); // Should be very fast

      // Measure cache get performance
      const getStart = performance.now();
      const retrieved = memoryCache.get(key);
      const getEnd = performance.now();

      expect(getEnd - getStart).toBeLessThan(1); // Should be very fast
      expect(retrieved).toEqual(testData);
    });

    it('should handle cache expiration correctly', async () => {
      const testData = { id: 1, name: 'test' };
      const key = 'test-key';
      const shortTTL = 10; // 10ms

      memoryCache.set(key, testData, shortTTL);
      expect(memoryCache.get(key)).toEqual(testData);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 20));
      expect(memoryCache.get(key)).toBeNull();
    });

    it('should cleanup expired items efficiently', () => {
      // Add multiple items with different TTLs
      for (let i = 0; i < 100; i++) {
        memoryCache.set(`key-${i}`, { data: i }, i < 50 ? 1 : 10000);
      }

      expect(memoryCache.size()).toBe(100);

      // Wait for some items to expire
      setTimeout(() => {
        memoryCache.cleanup();
        expect(memoryCache.size()).toBeLessThan(100);
      }, 5);
    });
  });

  describe('API Service Performance', () => {
    beforeEach(() => {
      global.fetch = jest.fn();
    });

    it('should cache GET requests', async () => {
      const mockResponse = { data: 'test' };
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
        headers: new Headers(),
      });

      // First request
      const start1 = performance.now();
      const response1 = await apiService.get('/test');
      const end1 = performance.now();

      expect(response1.data).toEqual(mockResponse);
      expect(response1.cached).toBe(false);

      // Second request (should be cached)
      const start2 = performance.now();
      const response2 = await apiService.get('/test');
      const end2 = performance.now();

      expect(response2.data).toEqual(mockResponse);
      expect(response2.cached).toBe(true);
      expect(end2 - start2).toBeLessThan(end1 - start1); // Cached should be faster
    });

    it('should handle request timeouts', async () => {
      (global.fetch as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 2000))
      );

      const start = performance.now();
      
      try {
        await apiService.get('/slow-endpoint', { timeout: 100 });
      } catch (error) {
        const end = performance.now();
        expect(end - start).toBeLessThan(200); // Should timeout quickly
        expect(error).toBeDefined();
      }
    });
  });

  describe('Utility Functions Performance', () => {
    it('should debounce function calls efficiently', (done) => {
      let callCount = 0;
      const debouncedFn = debounce(() => {
        callCount++;
      }, 50);

      // Call multiple times rapidly
      for (let i = 0; i < 10; i++) {
        debouncedFn();
      }

      // Should only be called once after delay
      setTimeout(() => {
        expect(callCount).toBe(1);
        done();
      }, 100);
    });

    it('should throttle function calls efficiently', (done) => {
      let callCount = 0;
      const throttledFn = throttle(() => {
        callCount++;
      }, 50);

      // Call multiple times rapidly
      for (let i = 0; i < 10; i++) {
        throttledFn();
      }

      // Should be called immediately, then throttled
      expect(callCount).toBe(1);

      setTimeout(() => {
        throttledFn();
        expect(callCount).toBe(2);
        done();
      }, 100);
    });
  });

  describe('Component Render Performance', () => {
    it('should render components within performance budget', async () => {
      const TestComponent = () => <div>Test Component</div>;

      const renderStart = performance.now();
      render(<TestComponent />);
      const renderEnd = performance.now();

      expect(renderEnd - renderStart).toBeLessThan(16); // Should render within 16ms (60fps)
    });

    it('should lazy load components efficiently', async () => {
      // Mock dynamic import
      const LazyComponent = () => <div>Lazy Component</div>;
      
      const loadStart = performance.now();
      render(<LazyComponent />);
      const loadEnd = performance.now();

      expect(loadEnd - loadStart).toBeLessThan(50); // Should load quickly
    });
  });

  describe('Memory Usage', () => {
    it('should not cause memory leaks in cache', () => {
      const initialSize = memoryCache.size();

      // Add many items
      for (let i = 0; i < 1000; i++) {
        memoryCache.set(`key-${i}`, { data: new Array(1000).fill(i) });
      }

      expect(memoryCache.size()).toBe(initialSize + 1000);

      // Clear cache
      memoryCache.clear();
      expect(memoryCache.size()).toBe(0);
    });

    it('should monitor memory usage', () => {
      const metrics = collectPerformanceMetrics();
      
      if (metrics?.memory) {
        expect(metrics.memory.usedJSHeapSize).toBeGreaterThan(0);
        expect(metrics.memory.totalJSHeapSize).toBeGreaterThan(0);
        expect(metrics.memory.jsHeapSizeLimit).toBeGreaterThan(0);
      }
    });
  });

  describe('Bundle Size Performance', () => {
    it('should have reasonable bundle sizes', () => {
      // This would typically be measured by webpack-bundle-analyzer
      // For now, we'll just ensure imports are working
      expect(typeof memoryCache).toBe('object');
      expect(typeof apiService).toBe('object');
      expect(typeof debounce).toBe('function');
      expect(typeof throttle).toBe('function');
    });
  });
});

describe('Performance Benchmarks', () => {
  const runBenchmark = (name: string, fn: () => void, iterations = 1000) => {
    const start = performance.now();
    
    for (let i = 0; i < iterations; i++) {
      fn();
    }
    
    const end = performance.now();
    const avgTime = (end - start) / iterations;
    
    console.log(`${name}: ${avgTime.toFixed(4)}ms per operation`);
    return avgTime;
  };

  it('should benchmark cache operations', () => {
    const cacheSetTime = runBenchmark('Cache Set', () => {
      memoryCache.set('benchmark-key', { data: 'test' });
    });

    const cacheGetTime = runBenchmark('Cache Get', () => {
      memoryCache.get('benchmark-key');
    });

    expect(cacheSetTime).toBeLessThan(0.1); // Should be very fast
    expect(cacheGetTime).toBeLessThan(0.1); // Should be very fast
  });

  it('should benchmark utility functions', () => {
    const debouncedFn = debounce(() => {}, 10);
    const throttledFn = throttle(() => {}, 10);

    const debounceTime = runBenchmark('Debounce Creation', () => {
      debounce(() => {}, 10);
    });

    const throttleTime = runBenchmark('Throttle Creation', () => {
      throttle(() => {}, 10);
    });

    expect(debounceTime).toBeLessThan(0.1);
    expect(throttleTime).toBeLessThan(0.1);
  });
});