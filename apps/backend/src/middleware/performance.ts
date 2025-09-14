import { Request, Response, NextFunction } from 'express';
import compression from 'compression';
import { createHash } from 'crypto';

/**
 * Performance middleware for backend optimization
 */

interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
  etag: string;
}

class ResponseCache {
  private cache = new Map<string, CacheEntry>();
  private readonly defaultTTL = 5 * 60 * 1000; // 5 minutes

  set(key: string, data: any, ttl: number = this.defaultTTL): void {
    const etag = this.generateETag(data);
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
      etag,
    });
  }

  get(key: string): CacheEntry | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry;
  }

  private generateETag(data: any): string {
    return createHash('md5').update(JSON.stringify(data)).digest('hex');
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

const responseCache = new ResponseCache();

// Cleanup expired cache entries every 5 minutes
setInterval(() => {
  responseCache.cleanup();
}, 5 * 60 * 1000);

/**
 * Response caching middleware
 */
export const cacheMiddleware = (ttl: number = 5 * 60 * 1000) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const cacheKey = `${req.originalUrl}:${JSON.stringify(req.query)}`;
    const cachedEntry = responseCache.get(cacheKey);

    if (cachedEntry) {
      // Check if client has cached version
      const clientETag = req.headers['if-none-match'];
      if (clientETag === cachedEntry.etag) {
        return res.status(304).end();
      }

      res.set('ETag', cachedEntry.etag);
      res.set('Cache-Control', `public, max-age=${Math.floor(ttl / 1000)}`);
      return res.json(cachedEntry.data);
    }

    // Override res.json to cache the response
    const originalJson = res.json;
    res.json = function(data: any) {
      if (res.statusCode === 200) {
        responseCache.set(cacheKey, data, ttl);
        const etag = responseCache.get(cacheKey)?.etag;
        if (etag) {
          res.set('ETag', etag);
          res.set('Cache-Control', `public, max-age=${Math.floor(ttl / 1000)}`);
        }
      }
      return originalJson.call(this, data);
    };

    next();
  };
};

/**
 * Compression middleware with optimized settings
 */
export const compressionMiddleware = compression({
  level: 6, // Balanced compression level
  threshold: 1024, // Only compress responses larger than 1KB
  filter: (req, res) => {
    // Don't compress if client doesn't support it
    if (req.headers['x-no-compression']) {
      return false;
    }
    
    // Compress JSON and text responses
    const contentType = res.getHeader('content-type') as string;
    return contentType && (
      contentType.includes('application/json') ||
      contentType.includes('text/') ||
      contentType.includes('application/javascript')
    );
  },
});

/**
 * Request timing middleware
 */
export const timingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const startTime = process.hrtime.bigint();
  
  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
    
    res.set('X-Response-Time', `${duration.toFixed(2)}ms`);
    
    // Log slow requests
    if (duration > 1000) { // Log requests taking more than 1 second
      console.warn(`Slow request: ${req.method} ${req.originalUrl} - ${duration.toFixed(2)}ms`);
    }
  });
  
  next();
};

/**
 * Memory usage monitoring middleware
 */
export const memoryMonitoringMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const memUsage = process.memoryUsage();
  
  // Log memory warnings
  const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
  const heapTotalMB = memUsage.heapTotal / 1024 / 1024;
  
  if (heapUsedMB > 500) { // Warn if using more than 500MB
    console.warn(`High memory usage: ${heapUsedMB.toFixed(2)}MB / ${heapTotalMB.toFixed(2)}MB`);
  }
  
  res.set('X-Memory-Usage', `${heapUsedMB.toFixed(2)}MB`);
  next();
};

/**
 * Request deduplication middleware
 */
const pendingRequests = new Map<string, Promise<any>>();

export const deduplicationMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Only deduplicate GET requests
  if (req.method !== 'GET') {
    return next();
  }

  const requestKey = `${req.originalUrl}:${JSON.stringify(req.query)}`;
  const pendingRequest = pendingRequests.get(requestKey);

  if (pendingRequest) {
    // Wait for the pending request to complete
    pendingRequest
      .then((result) => {
        res.json(result);
      })
      .catch((error) => {
        res.status(500).json({ error: 'Request failed' });
      });
    return;
  }

  // Create a promise for this request
  const requestPromise = new Promise((resolve, reject) => {
    const originalJson = res.json;
    res.json = function(data: any) {
      pendingRequests.delete(requestKey);
      resolve(data);
      return originalJson.call(this, data);
    };

    res.on('error', (error) => {
      pendingRequests.delete(requestKey);
      reject(error);
    });

    next();
  });

  pendingRequests.set(requestKey, requestPromise);
};

/**
 * Connection pooling optimization
 */
export const connectionPoolMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Set keep-alive headers for connection reuse
  res.set('Connection', 'keep-alive');
  res.set('Keep-Alive', 'timeout=5, max=1000');
  next();
};

/**
 * Batch processing middleware for multiple requests
 */
export const batchProcessingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (req.path === '/api/batch' && req.method === 'POST') {
    const requests = req.body.requests;
    
    if (!Array.isArray(requests)) {
      return res.status(400).json({ error: 'Invalid batch request format' });
    }

    // Process requests in parallel with concurrency limit
    const concurrencyLimit = 5;
    const results: any[] = [];
    
    const processBatch = async () => {
      for (let i = 0; i < requests.length; i += concurrencyLimit) {
        const batch = requests.slice(i, i + concurrencyLimit);
        const batchPromises = batch.map(async (request: any) => {
          try {
            // Simulate processing individual request
            // In real implementation, this would make internal API calls
            return { success: true, data: request };
          } catch (error) {
            return { success: false, error: (error as Error).message };
          }
        });
        
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      }
      
      res.json({ results });
    };

    processBatch().catch((error) => {
      res.status(500).json({ error: 'Batch processing failed' });
    });
    
    return;
  }
  
  next();
};

/**
 * Performance metrics collection
 */
interface PerformanceMetrics {
  requestCount: number;
  averageResponseTime: number;
  errorRate: number;
  memoryUsage: number;
  cacheHitRate: number;
}

class PerformanceCollector {
  private metrics = {
    requestCount: 0,
    totalResponseTime: 0,
    errorCount: 0,
    cacheHits: 0,
    cacheMisses: 0,
  };

  recordRequest(responseTime: number, isError: boolean = false, isCacheHit: boolean = false) {
    this.metrics.requestCount++;
    this.metrics.totalResponseTime += responseTime;
    
    if (isError) {
      this.metrics.errorCount++;
    }
    
    if (isCacheHit) {
      this.metrics.cacheHits++;
    } else {
      this.metrics.cacheMisses++;
    }
  }

  getMetrics(): PerformanceMetrics {
    const memUsage = process.memoryUsage();
    
    return {
      requestCount: this.metrics.requestCount,
      averageResponseTime: this.metrics.requestCount > 0 
        ? this.metrics.totalResponseTime / this.metrics.requestCount 
        : 0,
      errorRate: this.metrics.requestCount > 0 
        ? (this.metrics.errorCount / this.metrics.requestCount) * 100 
        : 0,
      memoryUsage: memUsage.heapUsed / 1024 / 1024, // MB
      cacheHitRate: (this.metrics.cacheHits + this.metrics.cacheMisses) > 0
        ? (this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses)) * 100
        : 0,
    };
  }

  reset() {
    this.metrics = {
      requestCount: 0,
      totalResponseTime: 0,
      errorCount: 0,
      cacheHits: 0,
      cacheMisses: 0,
    };
  }
}

export const performanceCollector = new PerformanceCollector();

export const metricsCollectionMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const startTime = process.hrtime.bigint();
  
  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const responseTime = Number(endTime - startTime) / 1000000; // Convert to milliseconds
    const isError = res.statusCode >= 400;
    const isCacheHit = res.getHeader('X-Cache-Hit') === 'true';
    
    performanceCollector.recordRequest(responseTime, isError, isCacheHit);
  });
  
  next();
};

// Export cache instance for manual cache management
export { responseCache };