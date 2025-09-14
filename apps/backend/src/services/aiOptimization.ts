import { VertexAI } from '@google-cloud/aiplatform';
import { createHash } from 'crypto';

/**
 * AI Model Response Optimization Service
 * Optimizes AI model calls for better performance and cost efficiency
 */

interface ModelResponse {
  content: string;
  confidence: number;
  tokens: number;
  responseTime: number;
}

interface CachedResponse {
  response: ModelResponse;
  timestamp: number;
  ttl: number;
}

interface OptimizationConfig {
  enableCaching: boolean;
  cacheTTL: number;
  maxTokens: number;
  temperature: number;
  batchSize: number;
  enableStreaming: boolean;
}

class AIOptimizationService {
  private vertexAI: VertexAI;
  private responseCache = new Map<string, CachedResponse>();
  private requestQueue: Array<{
    prompt: string;
    resolve: (response: ModelResponse) => void;
    reject: (error: Error) => void;
  }> = [];
  private processingBatch = false;

  private config: OptimizationConfig = {
    enableCaching: true,
    cacheTTL: 30 * 60 * 1000, // 30 minutes
    maxTokens: 2048,
    temperature: 0.3,
    batchSize: 5,
    enableStreaming: false,
  };

  constructor() {
    this.vertexAI = new VertexAI({
      project: process.env.GOOGLE_CLOUD_PROJECT_ID!,
      location: process.env.GOOGLE_CLOUD_REGION || 'us-central1',
    });

    // Start batch processing
    this.startBatchProcessor();
    
    // Cleanup expired cache entries
    setInterval(() => this.cleanupCache(), 5 * 60 * 1000);
  }

  /**
   * Generate optimized AI response with caching and batching
   */
  async generateResponse(
    prompt: string,
    options: Partial<OptimizationConfig> = {}
  ): Promise<ModelResponse> {
    const config = { ...this.config, ...options };
    
    // Check cache first
    if (config.enableCaching) {
      const cachedResponse = this.getCachedResponse(prompt);
      if (cachedResponse) {
        return cachedResponse;
      }
    }

    // Add to batch queue for processing
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ prompt, resolve, reject });
      
      // Process immediately if not batching or queue is full
      if (!config.batchSize || this.requestQueue.length >= config.batchSize) {
        this.processBatch();
      }
    });
  }

  /**
   * Optimize document analysis with chunking and parallel processing
   */
  async analyzeDocumentOptimized(
    documentText: string,
    analysisType: 'summary' | 'risk' | 'qa' | 'comparison'
  ): Promise<ModelResponse> {
    const chunks = this.chunkDocument(documentText);
    const maxConcurrency = 3; // Limit concurrent requests
    
    // Process chunks in parallel with concurrency limit
    const results: ModelResponse[] = [];
    
    for (let i = 0; i < chunks.length; i += maxConcurrency) {
      const batch = chunks.slice(i, i + maxConcurrency);
      const batchPromises = batch.map(chunk => 
        this.generateAnalysisForChunk(chunk, analysisType)
      );
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    // Combine results
    return this.combineAnalysisResults(results, analysisType);
  }

  /**
   * Streaming response for real-time chat
   */
  async generateStreamingResponse(
    prompt: string,
    onChunk: (chunk: string) => void
  ): Promise<ModelResponse> {
    const startTime = Date.now();
    let fullResponse = '';
    let tokenCount = 0;

    try {
      const model = this.vertexAI.preview.getGenerativeModel({
        model: 'gemini-pro',
        generationConfig: {
          maxOutputTokens: this.config.maxTokens,
          temperature: this.config.temperature,
        },
      });

      const result = await model.generateContentStream(prompt);
      
      for await (const chunk of result.stream) {
        const chunkText = chunk.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (chunkText) {
          fullResponse += chunkText;
          tokenCount += this.estimateTokens(chunkText);
          onChunk(chunkText);
        }
      }

      const response: ModelResponse = {
        content: fullResponse,
        confidence: 0.9, // Estimate confidence
        tokens: tokenCount,
        responseTime: Date.now() - startTime,
      };

      // Cache the complete response
      if (this.config.enableCaching) {
        this.cacheResponse(prompt, response);
      }

      return response;

    } catch (error) {
      throw new Error(`Streaming generation failed: ${(error as Error).message}`);
    }
  }

  /**
   * Batch process queued requests
   */
  private async processBatch(): Promise<void> {
    if (this.processingBatch || this.requestQueue.length === 0) {
      return;
    }

    this.processingBatch = true;
    const batch = this.requestQueue.splice(0, this.config.batchSize);

    try {
      // Process batch requests in parallel
      const promises = batch.map(async ({ prompt, resolve, reject }) => {
        try {
          const response = await this.callModel(prompt);
          
          // Cache successful responses
          if (this.config.enableCaching) {
            this.cacheResponse(prompt, response);
          }
          
          resolve(response);
        } catch (error) {
          reject(error as Error);
        }
      });

      await Promise.all(promises);
    } catch (error) {
      console.error('Batch processing error:', error);
    } finally {
      this.processingBatch = false;
      
      // Process next batch if queue has items
      if (this.requestQueue.length > 0) {
        setTimeout(() => this.processBatch(), 100);
      }
    }
  }

  /**
   * Start batch processor with interval
   */
  private startBatchProcessor(): void {
    setInterval(() => {
      if (this.requestQueue.length > 0) {
        this.processBatch();
      }
    }, 1000); // Process every second
  }

  /**
   * Call the AI model
   */
  private async callModel(prompt: string): Promise<ModelResponse> {
    const startTime = Date.now();

    try {
      const model = this.vertexAI.preview.getGenerativeModel({
        model: 'gemini-pro',
        generationConfig: {
          maxOutputTokens: this.config.maxTokens,
          temperature: this.config.temperature,
        },
      });

      const result = await model.generateContent(prompt);
      const response = result.response;
      const content = response.candidates?.[0]?.content?.parts?.[0]?.text || '';

      return {
        content,
        confidence: this.calculateConfidence(response),
        tokens: this.estimateTokens(content),
        responseTime: Date.now() - startTime,
      };

    } catch (error) {
      throw new Error(`Model call failed: ${(error as Error).message}`);
    }
  }

  /**
   * Generate cache key for prompt
   */
  private generateCacheKey(prompt: string): string {
    return createHash('md5').update(prompt).digest('hex');
  }

  /**
   * Cache response
   */
  private cacheResponse(prompt: string, response: ModelResponse): void {
    const key = this.generateCacheKey(prompt);
    this.responseCache.set(key, {
      response,
      timestamp: Date.now(),
      ttl: this.config.cacheTTL,
    });
  }

  /**
   * Get cached response
   */
  private getCachedResponse(prompt: string): ModelResponse | null {
    const key = this.generateCacheKey(prompt);
    const cached = this.responseCache.get(key);

    if (!cached) {
      return null;
    }

    // Check if expired
    if (Date.now() - cached.timestamp > cached.ttl) {
      this.responseCache.delete(key);
      return null;
    }

    return cached.response;
  }

  /**
   * Cleanup expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, cached] of this.responseCache.entries()) {
      if (now - cached.timestamp > cached.ttl) {
        this.responseCache.delete(key);
      }
    }
  }

  /**
   * Chunk document for parallel processing
   */
  private chunkDocument(text: string, maxChunkSize: number = 4000): string[] {
    const chunks: string[] = [];
    const sentences = text.split(/[.!?]+/);
    let currentChunk = '';

    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > maxChunkSize && currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        currentChunk += sentence + '.';
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * Generate analysis for document chunk
   */
  private async generateAnalysisForChunk(
    chunk: string,
    analysisType: string
  ): Promise<ModelResponse> {
    const prompts = {
      summary: `Summarize this legal document section in plain language: ${chunk}`,
      risk: `Identify potential risks in this legal text: ${chunk}`,
      qa: `Extract key information from this legal section: ${chunk}`,
      comparison: `Analyze the legal implications of this text: ${chunk}`,
    };

    const prompt = prompts[analysisType as keyof typeof prompts] || prompts.summary;
    return this.generateResponse(prompt);
  }

  /**
   * Combine analysis results from multiple chunks
   */
  private combineAnalysisResults(
    results: ModelResponse[],
    analysisType: string
  ): ModelResponse {
    const combinedContent = results.map(r => r.content).join('\n\n');
    const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;
    const totalTokens = results.reduce((sum, r) => sum + r.tokens, 0);
    const maxResponseTime = Math.max(...results.map(r => r.responseTime));

    return {
      content: combinedContent,
      confidence: avgConfidence,
      tokens: totalTokens,
      responseTime: maxResponseTime,
    };
  }

  /**
   * Estimate token count
   */
  private estimateTokens(text: string): number {
    // Rough estimation: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(response: any): number {
    // This would use actual model confidence if available
    // For now, return a reasonable estimate
    return 0.85;
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    return {
      cacheSize: this.responseCache.size,
      queueLength: this.requestQueue.length,
      processingBatch: this.processingBatch,
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.responseCache.clear();
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<OptimizationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

export default new AIOptimizationService();