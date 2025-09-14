import { memoryCache, persistentCache, createCacheKey, CACHE_TTL } from './cacheService';

/**
 * Optimized API service with caching, retry logic, and performance monitoring
 */

interface RequestConfig {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
  cache?: boolean;
  cacheTTL?: number;
  persistent?: boolean;
  timeout?: number;
  retries?: number;
}

interface ApiResponse<T> {
  data: T;
  status: number;
  headers: Headers;
  cached?: boolean;
  responseTime?: number;
}

class OptimizedApiService {
  private baseURL: string;
  private defaultTimeout = 10000; // 10 seconds
  private defaultRetries = 3;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  /**
   * Make optimized API request with caching and retry logic
   */
  async request<T>(
    endpoint: string,
    config: RequestConfig = {}
  ): Promise<ApiResponse<T>> {
    const {
      method = 'GET',
      headers = {},
      body,
      cache = method === 'GET',
      cacheTTL = CACHE_TTL.MEDIUM,
      persistent = false,
      timeout = this.defaultTimeout,
      retries = this.defaultRetries,
    } = config;

    const cacheKey = createCacheKey(endpoint, { method, body });
    const startTime = performance.now();

    // Check cache for GET requests
    if (cache && method === 'GET') {
      const cacheService = persistent ? persistentCache : memoryCache;
      const cachedData = cacheService.get<T>(cacheKey);
      
      if (cachedData) {
        return {
          data: cachedData,
          status: 200,
          headers: new Headers(),
          cached: true,
          responseTime: performance.now() - startTime,
        };
      }
    }

    // Make request with retry logic
    let lastError: Error;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(`${this.baseURL}${endpoint}`, {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        const responseTime = performance.now() - startTime;

        // Cache successful GET requests
        if (cache && method === 'GET' && response.status === 200) {
          const cacheService = persistent ? persistentCache : memoryCache;
          cacheService.set(cacheKey, data, cacheTTL);
        }

        return {
          data,
          status: response.status,
          headers: response.headers,
          cached: false,
          responseTime,
        };

      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on certain errors
        if (error instanceof Error && 
            (error.name === 'AbortError' || 
             error.message.includes('HTTP 4'))) {
          break;
        }

        // Exponential backoff for retries
        if (attempt < retries) {
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError!;
  }

  /**
   * GET request with caching
   */
  async get<T>(endpoint: string, config?: Omit<RequestConfig, 'method'>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'GET' });
  }

  /**
   * POST request
   */
  async post<T>(endpoint: string, data?: any, config?: Omit<RequestConfig, 'method' | 'body'>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'POST', body: data });
  }

  /**
   * PUT request
   */
  async put<T>(endpoint: string, data?: any, config?: Omit<RequestConfig, 'method' | 'body'>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'PUT', body: data });
  }

  /**
   * DELETE request
   */
  async delete<T>(endpoint: string, config?: Omit<RequestConfig, 'method'>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'DELETE' });
  }

  /**
   * Upload file with progress tracking
   */
  async uploadFile(
    endpoint: string,
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<ApiResponse<any>> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append('file', file);

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable && onProgress) {
          const progress = (event.loaded / event.total) * 100;
          onProgress(progress);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            resolve({
              data,
              status: xhr.status,
              headers: new Headers(),
              cached: false,
            });
          } catch (error) {
            reject(new Error('Invalid JSON response'));
          }
        } else {
          reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Network error'));
      });

      xhr.addEventListener('timeout', () => {
        reject(new Error('Request timeout'));
      });

      xhr.open('POST', `${this.baseURL}${endpoint}`);
      xhr.timeout = this.defaultTimeout;
      xhr.send(formData);
    });
  }

  /**
   * Prefetch data for better performance
   */
  async prefetch<T>(endpoint: string, config?: RequestConfig): Promise<void> {
    try {
      await this.request<T>(endpoint, { ...config, cache: true });
    } catch (error) {
      // Silently fail prefetch requests
      console.warn('Prefetch failed:', error);
    }
  }

  /**
   * Clear cache for specific endpoint or all
   */
  clearCache(endpoint?: string): void {
    if (endpoint) {
      const cacheKey = createCacheKey(endpoint);
      memoryCache.delete(cacheKey);
      persistentCache.delete(cacheKey);
    } else {
      memoryCache.clear();
      persistentCache.clear();
    }
  }
}

// Create API service instance
const apiService = new OptimizedApiService(
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
);

export default apiService;