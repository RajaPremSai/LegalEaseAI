import MonitoringService, { PerformanceMetrics, ErrorMetrics, AnalyticsEvent } from '../../services/monitoring';
import { Request, Response, NextFunction } from 'express';

// Mock winston
jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  })),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    errors: jest.fn(),
    json: jest.fn(),
    simple: jest.fn(),
    colorize: jest.fn()
  },
  transports: {
    File: jest.fn(),
    Console: jest.fn()
  }
}));

describe('MonitoringService', () => {
  let monitoringService: MonitoringService;

  beforeEach(() => {
    monitoringService = MonitoringService.getInstance();
    // Clear any existing metrics
    (monitoringService as any).performanceMetrics = [];
    (monitoringService as any).errorMetrics = [];
    (monitoringService as any).analyticsEvents = [];
  });

  describe('Performance Monitoring', () => {
    it('should record performance metrics', () => {
      const metric: PerformanceMetrics = {
        endpoint: '/api/test',
        method: 'GET',
        responseTime: 150,
        statusCode: 200,
        timestamp: new Date(),
        memoryUsage: process.memoryUsage()
      };

      monitoringService.recordPerformanceMetric(metric);
      const stats = monitoringService.getPerformanceStats();

      expect(stats.totalRequests).toBe(1);
      expect(stats.averageResponseTime).toBe(150);
      expect(stats.errorRate).toBe(0);
    });

    it('should calculate correct statistics for multiple metrics', () => {
      const metrics: PerformanceMetrics[] = [
        {
          endpoint: '/api/test',
          method: 'GET',
          responseTime: 100,
          statusCode: 200,
          timestamp: new Date(),
          memoryUsage: process.memoryUsage()
        },
        {
          endpoint: '/api/test',
          method: 'GET',
          responseTime: 200,
          statusCode: 200,
          timestamp: new Date(),
          memoryUsage: process.memoryUsage()
        },
        {
          endpoint: '/api/test',
          method: 'GET',
          responseTime: 300,
          statusCode: 500,
          timestamp: new Date(),
          memoryUsage: process.memoryUsage()
        }
      ];

      metrics.forEach(metric => monitoringService.recordPerformanceMetric(metric));
      const stats = monitoringService.getPerformanceStats();

      expect(stats.totalRequests).toBe(3);
      expect(stats.averageResponseTime).toBe(200);
      expect(stats.errorRate).toBeCloseTo(0.333, 2);
      expect(stats.statusCodeDistribution['2xx']).toBe(2);
      expect(stats.statusCodeDistribution['5xx']).toBe(1);
    });

    it('should calculate percentiles correctly', () => {
      const responseTimes = [100, 150, 200, 250, 300, 350, 400, 450, 500, 1000];
      
      responseTimes.forEach(responseTime => {
        monitoringService.recordPerformanceMetric({
          endpoint: '/api/test',
          method: 'GET',
          responseTime,
          statusCode: 200,
          timestamp: new Date(),
          memoryUsage: process.memoryUsage()
        });
      });

      const stats = monitoringService.getPerformanceStats();
      
      expect(stats.medianResponseTime).toBe(325); // Median of 10 values
      expect(stats.p95ResponseTime).toBe(1000); // 95th percentile
      expect(stats.p99ResponseTime).toBe(1000); // 99th percentile
    });
  });

  describe('Error Monitoring', () => {
    it('should record error metrics', () => {
      const errorMetric: ErrorMetrics = {
        error: 'Test error',
        endpoint: '/api/test',
        method: 'POST',
        statusCode: 500,
        timestamp: new Date(),
        userId: 'user-123'
      };

      monitoringService.recordErrorMetric(errorMetric);
      const errorStats = monitoringService.getErrorStats();

      expect(errorStats.totalErrors).toBe(1);
      expect(errorStats.errorsByEndpoint['POST /api/test']).toBe(1);
      expect(errorStats.errorsByType['Test error']).toBe(1);
    });

    it('should group errors by endpoint and type', () => {
      const errors: ErrorMetrics[] = [
        {
          error: 'Validation error: Invalid input',
          endpoint: '/api/users',
          method: 'POST',
          statusCode: 400,
          timestamp: new Date()
        },
        {
          error: 'Validation error: Missing field',
          endpoint: '/api/users',
          method: 'POST',
          statusCode: 400,
          timestamp: new Date()
        },
        {
          error: 'Database error: Connection failed',
          endpoint: '/api/documents',
          method: 'GET',
          statusCode: 500,
          timestamp: new Date()
        }
      ];

      errors.forEach(error => monitoringService.recordErrorMetric(error));
      const errorStats = monitoringService.getErrorStats();

      expect(errorStats.totalErrors).toBe(3);
      expect(errorStats.errorsByEndpoint['POST /api/users']).toBe(2);
      expect(errorStats.errorsByEndpoint['GET /api/documents']).toBe(1);
      expect(errorStats.errorsByType['Validation error']).toBe(2);
      expect(errorStats.errorsByType['Database error']).toBe(1);
    });
  });

  describe('Analytics Monitoring', () => {
    it('should record analytics events with privacy protection', () => {
      const event: Omit<AnalyticsEvent, 'timestamp'> = {
        event: 'document_uploaded',
        category: 'user_action',
        properties: { fileType: 'pdf', size: 1024 },
        userId: 'user-123',
        userType: 'individual',
        sessionId: 'session-456'
      };

      monitoringService.recordAnalyticsEvent(event);
      const insights = monitoringService.getAnalyticsInsights();

      expect(insights.totalEvents).toBe(1);
      expect(insights.eventsByCategory['user_action']).toBe(1);
      expect(insights.topEvents[0].event).toBe('document_uploaded');
      expect(insights.userTypeDistribution['individual']).toBe(1);
    });

    it('should hash user IDs for privacy', () => {
      const event: Omit<AnalyticsEvent, 'timestamp'> = {
        event: 'test_event',
        category: 'user_action',
        properties: {},
        userId: 'user-123',
        userType: 'individual'
      };

      monitoringService.recordAnalyticsEvent(event);
      
      // Access private analytics events to verify hashing
      const analyticsEvents = (monitoringService as any).analyticsEvents;
      expect(analyticsEvents[0].userId).not.toBe('user-123');
      expect(analyticsEvents[0].userId).toBeDefined();
      expect(analyticsEvents[0].userId.length).toBe(8); // Hashed to 8 characters
    });

    it('should group events by category and calculate top events', () => {
      const events = [
        { event: 'document_uploaded', category: 'user_action' as const, properties: {} },
        { event: 'document_uploaded', category: 'user_action' as const, properties: {} },
        { event: 'analysis_completed', category: 'system_event' as const, properties: {} },
        { event: 'user_registered', category: 'business_metric' as const, properties: {} },
        { event: 'document_uploaded', category: 'user_action' as const, properties: {} }
      ];

      events.forEach(event => monitoringService.recordAnalyticsEvent(event));
      const insights = monitoringService.getAnalyticsInsights();

      expect(insights.totalEvents).toBe(5);
      expect(insights.eventsByCategory['user_action']).toBe(3);
      expect(insights.eventsByCategory['system_event']).toBe(1);
      expect(insights.eventsByCategory['business_metric']).toBe(1);
      expect(insights.topEvents[0]).toEqual({ event: 'document_uploaded', count: 3 });
    });
  });

  describe('Performance Middleware', () => {
    it('should measure request performance', (done) => {
      const middleware = MonitoringService.performanceMiddleware();
      
      const mockReq = {
        path: '/api/test',
        method: 'GET',
        get: jest.fn(() => 'Test User Agent')
      } as any;

      const mockRes = {
        statusCode: 200,
        get: jest.fn(() => '1024'),
        end: jest.fn()
      } as any;

      const mockNext = jest.fn();

      // Mock the original end function
      const originalEnd = mockRes.end;
      
      middleware(mockReq, mockRes, mockNext);
      
      // Simulate response completion
      setTimeout(() => {
        mockRes.end();
        
        const stats = monitoringService.getPerformanceStats();
        expect(stats.totalRequests).toBe(1);
        expect(stats.averageResponseTime).toBeGreaterThan(0);
        done();
      }, 10);
    });
  });

  describe('Error Middleware', () => {
    it('should capture error information', () => {
      const middleware = MonitoringService.errorMiddleware();
      
      const testError = new Error('Test error message');
      const mockReq = {
        path: '/api/test',
        method: 'POST',
        body: { test: 'data' },
        query: { param: 'value' },
        params: { id: '123' },
        get: jest.fn(() => 'Test User Agent'),
        user: { id: 'user-123' }
      } as any;

      const mockRes = {
        statusCode: 500
      } as any;

      const mockNext = jest.fn();

      middleware(testError, mockReq, mockRes, mockNext);
      
      const errorStats = monitoringService.getErrorStats();
      expect(errorStats.totalErrors).toBe(1);
      expect(errorStats.errorsByEndpoint['POST /api/test']).toBe(1);
      expect(mockNext).toHaveBeenCalledWith(testError);
    });
  });

  describe('Memory Management', () => {
    it('should limit the number of stored metrics', () => {
      // Add more than the limit of performance metrics
      for (let i = 0; i < 1200; i++) {
        monitoringService.recordPerformanceMetric({
          endpoint: '/api/test',
          method: 'GET',
          responseTime: 100,
          statusCode: 200,
          timestamp: new Date(),
          memoryUsage: process.memoryUsage()
        });
      }

      const performanceMetrics = (monitoringService as any).performanceMetrics;
      expect(performanceMetrics.length).toBeLessThanOrEqual(1000);
    });

    it('should limit the number of stored error metrics', () => {
      // Add more than the limit of error metrics
      for (let i = 0; i < 600; i++) {
        monitoringService.recordErrorMetric({
          error: `Error ${i}`,
          endpoint: '/api/test',
          method: 'GET',
          statusCode: 500,
          timestamp: new Date()
        });
      }

      const errorMetrics = (monitoringService as any).errorMetrics;
      expect(errorMetrics.length).toBeLessThanOrEqual(500);
    });

    it('should limit the number of stored analytics events', () => {
      // Add more than the limit of analytics events
      for (let i = 0; i < 2200; i++) {
        monitoringService.recordAnalyticsEvent({
          event: `event_${i}`,
          category: 'user_action',
          properties: {}
        });
      }

      const analyticsEvents = (monitoringService as any).analyticsEvents;
      expect(analyticsEvents.length).toBeLessThanOrEqual(2000);
    });
  });

  describe('Time Window Filtering', () => {
    it('should filter metrics by time window', () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

      // Add metrics from different time periods
      monitoringService.recordPerformanceMetric({
        endpoint: '/api/test',
        method: 'GET',
        responseTime: 100,
        statusCode: 200,
        timestamp: now,
        memoryUsage: process.memoryUsage()
      });

      monitoringService.recordPerformanceMetric({
        endpoint: '/api/test',
        method: 'GET',
        responseTime: 200,
        statusCode: 200,
        timestamp: oneHourAgo,
        memoryUsage: process.memoryUsage()
      });

      monitoringService.recordPerformanceMetric({
        endpoint: '/api/test',
        method: 'GET',
        responseTime: 300,
        statusCode: 200,
        timestamp: twoHoursAgo,
        memoryUsage: process.memoryUsage()
      });

      // Get stats for last 90 minutes (should include first two metrics)
      const stats = monitoringService.getPerformanceStats(90 * 60 * 1000);
      expect(stats.totalRequests).toBe(2);
      expect(stats.averageResponseTime).toBe(150); // (100 + 200) / 2
    });
  });
});