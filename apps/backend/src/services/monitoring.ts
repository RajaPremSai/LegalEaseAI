import winston from 'winston';
import { Request, Response, NextFunction } from 'express';
import { performance } from 'perf_hooks';

// Performance monitoring logger
const performanceLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'legal-ai-performance' },
  transports: [
    new winston.transports.File({ 
      filename: 'logs/performance.log',
      maxsize: 10485760,
      maxFiles: 5,
      tailable: true
    })
  ]
});

// Error monitoring logger
const errorLogger = winston.createLogger({
  level: 'error',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'legal-ai-errors' },
  transports: [
    new winston.transports.File({ 
      filename: 'logs/errors.log',
      maxsize: 10485760,
      maxFiles: 10,
      tailable: true
    }),
    // Also log to console in development
    ...(process.env.NODE_ENV === 'development' ? [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        )
      })
    ] : [])
  ]
});

// Analytics logger (privacy-preserving)
const analyticsLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'legal-ai-analytics' },
  transports: [
    new winston.transports.File({ 
      filename: 'logs/analytics.log',
      maxsize: 10485760,
      maxFiles: 15,
      tailable: true
    })
  ]
});

export interface PerformanceMetrics {
  endpoint: string;
  method: string;
  responseTime: number;
  statusCode: number;
  timestamp: Date;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage?: NodeJS.CpuUsage;
  userAgent?: string;
  contentLength?: number;
}

export interface ErrorMetrics {
  error: string;
  stack?: string;
  endpoint: string;
  method: string;
  statusCode: number;
  timestamp: Date;
  userId?: string;
  requestId?: string;
  userAgent?: string;
  additionalContext?: Record<string, any>;
}

export interface AnalyticsEvent {
  event: string;
  category: 'user_action' | 'system_event' | 'business_metric';
  properties: Record<string, any>;
  timestamp: Date;
  sessionId?: string;
  userId?: string; // Hashed for privacy
  userType?: 'individual' | 'small_business' | 'enterprise';
}

export class MonitoringService {
  private static instance: MonitoringService;
  private performanceMetrics: PerformanceMetrics[] = [];
  private errorMetrics: ErrorMetrics[] = [];
  private analyticsEvents: AnalyticsEvent[] = [];
  private alertThresholds = {
    responseTime: 5000, // 5 seconds
    errorRate: 0.05, // 5%
    memoryUsage: 500 * 1024 * 1024, // 500MB
    consecutiveErrors: 10
  };

  private constructor() {
    // Start periodic cleanup and aggregation
    setInterval(() => this.cleanupOldMetrics(), 60 * 60 * 1000); // Every hour
    setInterval(() => this.generateHealthReport(), 5 * 60 * 1000); // Every 5 minutes
  }

  static getInstance(): MonitoringService {
    if (!MonitoringService.instance) {
      MonitoringService.instance = new MonitoringService();
    }
    return MonitoringService.instance;
  }

  /**
   * Performance monitoring middleware
   */
  static performanceMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = performance.now();
      const startCpuUsage = process.cpuUsage();
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Add request ID to request for tracking
      (req as any).requestId = requestId;

      // Override res.end to capture metrics
      const originalEnd = res.end;
      res.end = function(chunk?: any, encoding?: any) {
        const endTime = performance.now();
        const responseTime = endTime - startTime;
        const endCpuUsage = process.cpuUsage(startCpuUsage);
        
        const metrics: PerformanceMetrics = {
          endpoint: req.path,
          method: req.method,
          responseTime,
          statusCode: res.statusCode,
          timestamp: new Date(),
          memoryUsage: process.memoryUsage(),
          cpuUsage: endCpuUsage,
          userAgent: req.get('User-Agent'),
          contentLength: res.get('Content-Length') ? parseInt(res.get('Content-Length')!) : undefined
        };

        MonitoringService.getInstance().recordPerformanceMetric(metrics);
        
        // Log performance metric
        performanceLogger.info('Request completed', {
          ...metrics,
          requestId
        });

        // Check for performance alerts
        if (responseTime > MonitoringService.getInstance().alertThresholds.responseTime) {
          MonitoringService.getInstance().triggerAlert('slow_response', {
            endpoint: req.path,
            responseTime,
            threshold: MonitoringService.getInstance().alertThresholds.responseTime
          });
        }

        return originalEnd.call(this, chunk, encoding);
      };

      next();
    };
  }

  /**
   * Error monitoring middleware
   */
  static errorMiddleware() {
    return (err: Error, req: Request, res: Response, next: NextFunction) => {
      const errorMetric: ErrorMetrics = {
        error: err.message,
        stack: err.stack,
        endpoint: req.path,
        method: req.method,
        statusCode: res.statusCode || 500,
        timestamp: new Date(),
        userId: (req as any).user?.id,
        requestId: (req as any).requestId,
        userAgent: req.get('User-Agent'),
        additionalContext: {
          body: req.body,
          query: req.query,
          params: req.params
        }
      };

      MonitoringService.getInstance().recordErrorMetric(errorMetric);
      
      // Log error
      errorLogger.error('Request error', errorMetric);

      // Check for error rate alerts
      MonitoringService.getInstance().checkErrorRateAlert();

      next(err);
    };
  }

  /**
   * Record performance metric
   */
  recordPerformanceMetric(metric: PerformanceMetrics) {
    this.performanceMetrics.push(metric);
    
    // Keep only last 1000 metrics in memory
    if (this.performanceMetrics.length > 1000) {
      this.performanceMetrics = this.performanceMetrics.slice(-1000);
    }
  }

  /**
   * Record error metric
   */
  recordErrorMetric(metric: ErrorMetrics) {
    this.errorMetrics.push(metric);
    
    // Keep only last 500 errors in memory
    if (this.errorMetrics.length > 500) {
      this.errorMetrics = this.errorMetrics.slice(-500);
    }
  }

  /**
   * Record analytics event (privacy-preserving)
   */
  recordAnalyticsEvent(event: Omit<AnalyticsEvent, 'timestamp'>) {
    const analyticsEvent: AnalyticsEvent = {
      ...event,
      timestamp: new Date(),
      // Hash user ID for privacy
      userId: event.userId ? this.hashUserId(event.userId) : undefined
    };

    this.analyticsEvents.push(analyticsEvent);
    
    // Log analytics event
    analyticsLogger.info('Analytics event', analyticsEvent);
    
    // Keep only last 2000 events in memory
    if (this.analyticsEvents.length > 2000) {
      this.analyticsEvents = this.analyticsEvents.slice(-2000);
    }
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(timeWindow: number = 60 * 60 * 1000): any {
    const cutoff = new Date(Date.now() - timeWindow);
    const recentMetrics = this.performanceMetrics.filter(m => m.timestamp > cutoff);

    if (recentMetrics.length === 0) {
      return { message: 'No metrics available for the specified time window' };
    }

    const responseTimes = recentMetrics.map(m => m.responseTime);
    const statusCodes = recentMetrics.map(m => m.statusCode);
    
    return {
      totalRequests: recentMetrics.length,
      averageResponseTime: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
      medianResponseTime: this.calculateMedian(responseTimes),
      p95ResponseTime: this.calculatePercentile(responseTimes, 95),
      p99ResponseTime: this.calculatePercentile(responseTimes, 99),
      errorRate: statusCodes.filter(code => code >= 400).length / statusCodes.length,
      statusCodeDistribution: this.getStatusCodeDistribution(statusCodes),
      endpointStats: this.getEndpointStats(recentMetrics),
      memoryUsage: {
        current: process.memoryUsage(),
        average: this.calculateAverageMemoryUsage(recentMetrics)
      }
    };
  }

  /**
   * Get error statistics
   */
  getErrorStats(timeWindow: number = 60 * 60 * 1000): any {
    const cutoff = new Date(Date.now() - timeWindow);
    const recentErrors = this.errorMetrics.filter(e => e.timestamp > cutoff);

    return {
      totalErrors: recentErrors.length,
      errorsByEndpoint: this.groupErrorsByEndpoint(recentErrors),
      errorsByType: this.groupErrorsByType(recentErrors),
      recentErrors: recentErrors.slice(-10).map(e => ({
        error: e.error,
        endpoint: e.endpoint,
        timestamp: e.timestamp,
        statusCode: e.statusCode
      }))
    };
  }

  /**
   * Get analytics insights (privacy-preserving)
   */
  getAnalyticsInsights(timeWindow: number = 24 * 60 * 60 * 1000): any {
    const cutoff = new Date(Date.now() - timeWindow);
    const recentEvents = this.analyticsEvents.filter(e => e.timestamp > cutoff);

    return {
      totalEvents: recentEvents.length,
      eventsByCategory: this.groupEventsByCategory(recentEvents),
      topEvents: this.getTopEvents(recentEvents),
      userTypeDistribution: this.getUserTypeDistribution(recentEvents),
      hourlyActivity: this.getHourlyActivity(recentEvents)
    };
  }

  /**
   * Trigger alert
   */
  private triggerAlert(type: string, context: any) {
    const alert = {
      type,
      context,
      timestamp: new Date(),
      severity: this.getAlertSeverity(type, context)
    };

    errorLogger.warn('Alert triggered', alert);

    // In production, this would integrate with alerting systems
    // like PagerDuty, Slack, email notifications, etc.
    console.warn(`🚨 ALERT [${alert.severity}]: ${type}`, context);
  }

  /**
   * Check error rate and trigger alerts if necessary
   */
  private checkErrorRateAlert() {
    const recentMetrics = this.performanceMetrics.filter(
      m => m.timestamp > new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
    );

    if (recentMetrics.length < 10) return; // Need minimum sample size

    const errorRate = recentMetrics.filter(m => m.statusCode >= 400).length / recentMetrics.length;
    
    if (errorRate > this.alertThresholds.errorRate) {
      this.triggerAlert('high_error_rate', {
        errorRate,
        threshold: this.alertThresholds.errorRate,
        sampleSize: recentMetrics.length
      });
    }

    // Check for consecutive errors
    const recentErrors = this.errorMetrics.slice(-this.alertThresholds.consecutiveErrors);
    if (recentErrors.length === this.alertThresholds.consecutiveErrors) {
      const timeSpan = recentErrors[recentErrors.length - 1].timestamp.getTime() - 
                     recentErrors[0].timestamp.getTime();
      
      if (timeSpan < 5 * 60 * 1000) { // Within 5 minutes
        this.triggerAlert('consecutive_errors', {
          errorCount: this.alertThresholds.consecutiveErrors,
          timeSpan: timeSpan / 1000 // in seconds
        });
      }
    }
  }

  /**
   * Generate periodic health report
   */
  private generateHealthReport() {
    const stats = this.getPerformanceStats(5 * 60 * 1000); // Last 5 minutes
    const errors = this.getErrorStats(5 * 60 * 1000);
    const memoryUsage = process.memoryUsage();

    const healthReport = {
      timestamp: new Date(),
      status: this.determineHealthStatus(stats, errors, memoryUsage),
      performance: stats,
      errors: errors,
      system: {
        memoryUsage,
        uptime: process.uptime(),
        nodeVersion: process.version
      }
    };

    performanceLogger.info('Health report', healthReport);

    // Check memory usage alert
    if (memoryUsage.heapUsed > this.alertThresholds.memoryUsage) {
      this.triggerAlert('high_memory_usage', {
        current: memoryUsage.heapUsed,
        threshold: this.alertThresholds.memoryUsage
      });
    }
  }

  /**
   * Determine overall health status
   */
  private determineHealthStatus(stats: any, errors: any, memoryUsage: NodeJS.MemoryUsage): 'healthy' | 'warning' | 'critical' {
    if (errors.totalErrors > 10 || stats.errorRate > 0.1 || memoryUsage.heapUsed > this.alertThresholds.memoryUsage) {
      return 'critical';
    }
    
    if (errors.totalErrors > 5 || stats.errorRate > 0.05 || stats.averageResponseTime > 2000) {
      return 'warning';
    }
    
    return 'healthy';
  }

  /**
   * Clean up old metrics to prevent memory leaks
   */
  private cleanupOldMetrics() {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    
    this.performanceMetrics = this.performanceMetrics.filter(m => m.timestamp > cutoff);
    this.errorMetrics = this.errorMetrics.filter(e => e.timestamp > cutoff);
    this.analyticsEvents = this.analyticsEvents.filter(e => e.timestamp > cutoff);
  }

  // Utility methods
  private hashUserId(userId: string): string {
    // Simple hash for privacy (in production, use crypto.createHash)
    return Buffer.from(userId).toString('base64').substr(0, 8);
  }

  private calculateMedian(values: number[]): number {
    const sorted = values.slice().sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }

  private calculatePercentile(values: number[], percentile: number): number {
    const sorted = values.slice().sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  private getStatusCodeDistribution(statusCodes: number[]): Record<string, number> {
    return statusCodes.reduce((acc, code) => {
      const range = `${Math.floor(code / 100)}xx`;
      acc[range] = (acc[range] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private getEndpointStats(metrics: PerformanceMetrics[]): Record<string, any> {
    const endpointGroups = metrics.reduce((acc, metric) => {
      const key = `${metric.method} ${metric.endpoint}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(metric);
      return acc;
    }, {} as Record<string, PerformanceMetrics[]>);

    return Object.entries(endpointGroups).reduce((acc, [endpoint, endpointMetrics]) => {
      const responseTimes = endpointMetrics.map(m => m.responseTime);
      acc[endpoint] = {
        requestCount: endpointMetrics.length,
        averageResponseTime: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
        errorRate: endpointMetrics.filter(m => m.statusCode >= 400).length / endpointMetrics.length
      };
      return acc;
    }, {} as Record<string, any>);
  }

  private calculateAverageMemoryUsage(metrics: PerformanceMetrics[]): NodeJS.MemoryUsage {
    const memoryMetrics = metrics.map(m => m.memoryUsage);
    const avgHeapUsed = memoryMetrics.reduce((sum, mem) => sum + mem.heapUsed, 0) / memoryMetrics.length;
    const avgHeapTotal = memoryMetrics.reduce((sum, mem) => sum + mem.heapTotal, 0) / memoryMetrics.length;
    const avgExternal = memoryMetrics.reduce((sum, mem) => sum + mem.external, 0) / memoryMetrics.length;
    const avgRss = memoryMetrics.reduce((sum, mem) => sum + mem.rss, 0) / memoryMetrics.length;

    return {
      heapUsed: Math.round(avgHeapUsed),
      heapTotal: Math.round(avgHeapTotal),
      external: Math.round(avgExternal),
      rss: Math.round(avgRss),
      arrayBuffers: 0 // Not available in averages
    };
  }

  private groupErrorsByEndpoint(errors: ErrorMetrics[]): Record<string, number> {
    return errors.reduce((acc, error) => {
      const key = `${error.method} ${error.endpoint}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private groupErrorsByType(errors: ErrorMetrics[]): Record<string, number> {
    return errors.reduce((acc, error) => {
      const errorType = error.error.split(':')[0] || 'Unknown';
      acc[errorType] = (acc[errorType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private groupEventsByCategory(events: AnalyticsEvent[]): Record<string, number> {
    return events.reduce((acc, event) => {
      acc[event.category] = (acc[event.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private getTopEvents(events: AnalyticsEvent[]): Array<{ event: string; count: number }> {
    const eventCounts = events.reduce((acc, event) => {
      acc[event.event] = (acc[event.event] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(eventCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([event, count]) => ({ event, count }));
  }

  private getUserTypeDistribution(events: AnalyticsEvent[]): Record<string, number> {
    return events.reduce((acc, event) => {
      if (event.userType) {
        acc[event.userType] = (acc[event.userType] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);
  }

  private getHourlyActivity(events: AnalyticsEvent[]): Record<string, number> {
    return events.reduce((acc, event) => {
      const hour = event.timestamp.getHours().toString().padStart(2, '0');
      acc[hour] = (acc[hour] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private getAlertSeverity(type: string, context: any): 'low' | 'medium' | 'high' | 'critical' {
    switch (type) {
      case 'consecutive_errors':
        return 'critical';
      case 'high_error_rate':
        return context.errorRate > 0.2 ? 'critical' : 'high';
      case 'high_memory_usage':
        return context.current > this.alertThresholds.memoryUsage * 1.5 ? 'critical' : 'high';
      case 'slow_response':
        return context.responseTime > 10000 ? 'high' : 'medium';
      default:
        return 'medium';
    }
  }
}

export default MonitoringService;