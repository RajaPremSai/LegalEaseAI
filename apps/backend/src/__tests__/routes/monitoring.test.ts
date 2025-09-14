import request from 'supertest';
import express from 'express';
import monitoringRoutes from '../../routes/monitoring';
import { authMiddleware } from '../../middleware/auth';
import MonitoringService from '../../services/monitoring';

// Mock dependencies
jest.mock('../../services/monitoring');
jest.mock('../../services/auditLogger');
jest.mock('../../middleware/security', () => ({
  standardRateLimit: (req: any, res: any, next: any) => next()
}));

const MockedMonitoringService = MonitoringService as jest.MockedClass<typeof MonitoringService>;

describe('Monitoring Routes', () => {
  let app: express.Application;
  let mockMonitoringService: jest.Mocked<MonitoringService>;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    // Mock authentication middleware
    app.use((req: any, res, next) => {
      req.user = {
        id: 'user-123',
        email: 'test@example.com',
        userType: 'enterprise'
      };
      req.sessionID = 'session-123';
      req.ip = '192.168.1.1';
      next();
    });
    
    app.use('/api/monitoring', monitoringRoutes);

    // Setup mocked monitoring service
    mockMonitoringService = {
      getPerformanceStats: jest.fn(),
      getErrorStats: jest.fn(),
      getAnalyticsInsights: jest.fn(),
      recordAnalyticsEvent: jest.fn(),
      recordPerformanceMetric: jest.fn(),
      recordErrorMetric: jest.fn()
    } as any;

    MockedMonitoringService.getInstance.mockReturnValue(mockMonitoringService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /health', () => {
    it('should return health status without authentication', async () => {
      mockMonitoringService.getPerformanceStats.mockReturnValue({
        averageResponseTime: 150,
        errorRate: 0.02,
        totalRequests: 100
      });

      mockMonitoringService.getErrorStats.mockReturnValue({
        totalErrors: 2
      });

      const response = await request(app)
        .get('/api/monitoring/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('healthy');
      expect(response.body.data.performance.averageResponseTime).toBe(150);
      expect(response.body.data.performance.errorRate).toBe(0.02);
      expect(response.body.data.errors.totalErrors).toBe(2);
    });

    it('should return degraded status for moderate issues', async () => {
      mockMonitoringService.getPerformanceStats.mockReturnValue({
        averageResponseTime: 150,
        errorRate: 0.07, // Above 5% threshold
        totalRequests: 100
      });

      mockMonitoringService.getErrorStats.mockReturnValue({
        totalErrors: 7
      });

      const response = await request(app)
        .get('/api/monitoring/health')
        .expect(200);

      expect(response.body.data.status).toBe('degraded');
    });

    it('should return unhealthy status for severe issues', async () => {
      mockMonitoringService.getPerformanceStats.mockReturnValue({
        averageResponseTime: 150,
        errorRate: 0.15, // Above 10% threshold
        totalRequests: 100
      });

      mockMonitoringService.getErrorStats.mockReturnValue({
        totalErrors: 15
      });

      const response = await request(app)
        .get('/api/monitoring/health')
        .expect(200);

      expect(response.body.data.status).toBe('unhealthy');
    });
  });

  describe('GET /metrics', () => {
    it('should return detailed metrics for enterprise users', async () => {
      const mockMetrics = {
        performance: { averageResponseTime: 150, totalRequests: 100 },
        errors: { totalErrors: 2 },
        analytics: { totalEvents: 50 }
      };

      mockMonitoringService.getPerformanceStats.mockReturnValue(mockMetrics.performance);
      mockMonitoringService.getErrorStats.mockReturnValue(mockMetrics.errors);
      mockMonitoringService.getAnalyticsInsights.mockReturnValue(mockMetrics.analytics);

      const response = await request(app)
        .get('/api/monitoring/metrics')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.performance).toEqual(mockMetrics.performance);
      expect(response.body.data.errors).toEqual(mockMetrics.errors);
      expect(response.body.data.analytics).toEqual(mockMetrics.analytics);
      expect(response.body.data.system).toBeDefined();
    });

    it('should reject non-enterprise users', async () => {
      // Override user type for this test
      app.use((req: any, res, next) => {
        req.user = {
          id: 'user-123',
          email: 'test@example.com',
          userType: 'individual'
        };
        next();
      });

      app.use('/api/monitoring-test', monitoringRoutes);

      await request(app)
        .get('/api/monitoring-test/metrics')
        .expect(403);
    });

    it('should accept custom time window parameter', async () => {
      mockMonitoringService.getPerformanceStats.mockReturnValue({});
      mockMonitoringService.getErrorStats.mockReturnValue({});
      mockMonitoringService.getAnalyticsInsights.mockReturnValue({});

      await request(app)
        .get('/api/monitoring/metrics?timeWindow=7200000') // 2 hours
        .expect(200);

      expect(mockMonitoringService.getPerformanceStats).toHaveBeenCalledWith(7200000);
      expect(mockMonitoringService.getErrorStats).toHaveBeenCalledWith(7200000);
      expect(mockMonitoringService.getAnalyticsInsights).toHaveBeenCalledWith(7200000);
    });
  });

  describe('POST /analytics/event', () => {
    it('should record analytics event successfully', async () => {
      const eventData = {
        event: 'document_uploaded',
        category: 'user_action',
        properties: { fileType: 'pdf', size: 1024 }
      };

      const response = await request(app)
        .post('/api/monitoring/analytics/event')
        .send(eventData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Analytics event recorded');
      expect(mockMonitoringService.recordAnalyticsEvent).toHaveBeenCalledWith({
        event: 'document_uploaded',
        category: 'user_action',
        properties: { fileType: 'pdf', size: 1024 },
        userId: 'user-123',
        userType: 'enterprise',
        sessionId: 'session-123'
      });
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/monitoring/analytics/event')
        .send({ properties: { test: 'value' } }) // Missing event and category
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Missing required fields');
    });

    it('should validate category values', async () => {
      const response = await request(app)
        .post('/api/monitoring/analytics/event')
        .send({
          event: 'test_event',
          category: 'invalid_category',
          properties: {}
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid category');
    });

    it('should accept valid categories', async () => {
      const validCategories = ['user_action', 'system_event', 'business_metric'];

      for (const category of validCategories) {
        await request(app)
          .post('/api/monitoring/analytics/event')
          .send({
            event: 'test_event',
            category,
            properties: {}
          })
          .expect(200);
      }

      expect(mockMonitoringService.recordAnalyticsEvent).toHaveBeenCalledTimes(3);
    });
  });

  describe('GET /analytics/insights', () => {
    it('should return analytics insights for enterprise users', async () => {
      const mockInsights = {
        totalEvents: 100,
        eventsByCategory: { user_action: 60, system_event: 40 },
        topEvents: [{ event: 'document_uploaded', count: 25 }]
      };

      mockMonitoringService.getAnalyticsInsights.mockReturnValue(mockInsights);

      const response = await request(app)
        .get('/api/monitoring/analytics/insights')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockInsights);
    });

    it('should reject non-enterprise users', async () => {
      // Override user type for this test
      app.use((req: any, res, next) => {
        req.user = {
          id: 'user-123',
          email: 'test@example.com',
          userType: 'individual'
        };
        next();
      });

      app.use('/api/monitoring-test', monitoringRoutes);

      await request(app)
        .get('/api/monitoring-test/analytics/insights')
        .expect(403);
    });

    it('should accept custom time window parameter', async () => {
      mockMonitoringService.getAnalyticsInsights.mockReturnValue({});

      await request(app)
        .get('/api/monitoring/analytics/insights?timeWindow=86400000') // 24 hours
        .expect(200);

      expect(mockMonitoringService.getAnalyticsInsights).toHaveBeenCalledWith(86400000);
    });
  });

  describe('GET /alerts', () => {
    it('should return alerts for enterprise users', async () => {
      const response = await request(app)
        .get('/api/monitoring/alerts')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.active).toBeDefined();
      expect(response.body.data.recent).toBeDefined();
      expect(response.body.data.summary).toBeDefined();
    });

    it('should reject non-enterprise users', async () => {
      // Override user type for this test
      app.use((req: any, res, next) => {
        req.user = {
          id: 'user-123',
          email: 'test@example.com',
          userType: 'small_business'
        };
        next();
      });

      app.use('/api/monitoring-test', monitoringRoutes);

      await request(app)
        .get('/api/monitoring-test/alerts')
        .expect(403);
    });
  });

  describe('Error Handling', () => {
    it('should handle monitoring service errors gracefully', async () => {
      mockMonitoringService.getPerformanceStats.mockImplementation(() => {
        throw new Error('Service unavailable');
      });

      const response = await request(app)
        .get('/api/monitoring/health')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.status).toBe('error');
    });

    it('should handle analytics recording errors', async () => {
      mockMonitoringService.recordAnalyticsEvent.mockImplementation(() => {
        throw new Error('Recording failed');
      });

      const response = await request(app)
        .post('/api/monitoring/analytics/event')
        .send({
          event: 'test_event',
          category: 'user_action',
          properties: {}
        })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Analytics recording failed');
    });
  });
});