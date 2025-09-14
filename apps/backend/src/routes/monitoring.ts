import { Router, Request, Response } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import MonitoringService from '../services/monitoring';
import AuditLoggerService from '../services/auditLogger';
import { standardRateLimit } from '../middleware/security';

const router = Router();
const monitoringService = MonitoringService.getInstance();

/**
 * GET /monitoring/health
 * Get system health status
 */
router.get('/health', (req: Request, res: Response) => {
  try {
    const performanceStats = monitoringService.getPerformanceStats(5 * 60 * 1000); // Last 5 minutes
    const errorStats = monitoringService.getErrorStats(5 * 60 * 1000);
    const memoryUsage = process.memoryUsage();
    
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date(),
      uptime: process.uptime(),
      memory: {
        used: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
        total: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
        usage: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100) // %
      },
      performance: {
        averageResponseTime: performanceStats.averageResponseTime || 0,
        errorRate: performanceStats.errorRate || 0,
        totalRequests: performanceStats.totalRequests || 0
      },
      errors: {
        totalErrors: errorStats.totalErrors || 0
      }
    };

    // Determine overall health status
    if (errorStats.totalErrors > 10 || performanceStats.errorRate > 0.1) {
      healthStatus.status = 'unhealthy';
    } else if (errorStats.totalErrors > 5 || performanceStats.errorRate > 0.05) {
      healthStatus.status = 'degraded';
    }

    res.json({
      success: true,
      data: healthStatus
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      success: false,
      status: 'error',
      message: 'Health check failed'
    });
  }
});

/**
 * GET /monitoring/metrics
 * Get detailed performance metrics (admin only)
 */
router.get('/metrics', authMiddleware, standardRateLimit, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Check if user has admin privileges (in a real app, this would be role-based)
    if (req.user.userType !== 'enterprise') {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'Admin privileges required'
      });
    }

    const timeWindow = parseInt(req.query.timeWindow as string) || 60 * 60 * 1000; // Default 1 hour
    
    const metrics = {
      performance: monitoringService.getPerformanceStats(timeWindow),
      errors: monitoringService.getErrorStats(timeWindow),
      analytics: monitoringService.getAnalyticsInsights(timeWindow),
      system: {
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
        uptime: process.uptime(),
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      }
    };

    // Log metrics access
    AuditLoggerService.logAction({
      userId: req.user.id,
      userEmail: req.user.email,
      action: 'view_metrics',
      resource: 'monitoring',
      ipAddress: req.ip || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown',
      success: true,
      riskLevel: 'medium',
      details: { timeWindow },
      sessionId: req.sessionID
    });

    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    console.error('Metrics fetch error:', error);
    
    AuditLoggerService.logFailedRequest(req, 'Failed to fetch metrics', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    res.status(500).json({
      success: false,
      error: 'Metrics fetch failed',
      message: 'Unable to retrieve system metrics'
    });
  }
});

/**
 * POST /monitoring/analytics/event
 * Record analytics event
 */
router.post('/analytics/event', authMiddleware, standardRateLimit, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { event, category, properties } = req.body;

    if (!event || !category) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'Event name and category are required'
      });
    }

    // Validate category
    const validCategories = ['user_action', 'system_event', 'business_metric'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid category',
        message: 'Category must be one of: ' + validCategories.join(', ')
      });
    }

    // Record analytics event (privacy-preserving)
    monitoringService.recordAnalyticsEvent({
      event,
      category,
      properties: properties || {},
      userId: req.user.id,
      userType: req.user.userType,
      sessionId: req.sessionID
    });

    res.json({
      success: true,
      message: 'Analytics event recorded'
    });
  } catch (error) {
    console.error('Analytics event error:', error);
    
    AuditLoggerService.logFailedRequest(req, 'Failed to record analytics event', {
      error: error instanceof Error ? error.message : 'Unknown error',
      event: req.body.event,
      category: req.body.category
    });
    
    res.status(500).json({
      success: false,
      error: 'Analytics recording failed',
      message: 'Unable to record analytics event'
    });
  }
});

/**
 * GET /monitoring/analytics/insights
 * Get analytics insights (admin only)
 */
router.get('/analytics/insights', authMiddleware, standardRateLimit, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Check admin privileges
    if (req.user.userType !== 'enterprise') {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'Admin privileges required'
      });
    }

    const timeWindow = parseInt(req.query.timeWindow as string) || 24 * 60 * 60 * 1000; // Default 24 hours
    
    const insights = monitoringService.getAnalyticsInsights(timeWindow);

    // Log analytics access
    AuditLoggerService.logAction({
      userId: req.user.id,
      userEmail: req.user.email,
      action: 'view_analytics',
      resource: 'monitoring',
      ipAddress: req.ip || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown',
      success: true,
      riskLevel: 'medium',
      details: { timeWindow },
      sessionId: req.sessionID
    });

    res.json({
      success: true,
      data: insights
    });
  } catch (error) {
    console.error('Analytics insights error:', error);
    
    AuditLoggerService.logFailedRequest(req, 'Failed to fetch analytics insights', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    res.status(500).json({
      success: false,
      error: 'Analytics fetch failed',
      message: 'Unable to retrieve analytics insights'
    });
  }
});

/**
 * GET /monitoring/alerts
 * Get recent alerts (admin only)
 */
router.get('/alerts', authMiddleware, standardRateLimit, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Check admin privileges
    if (req.user.userType !== 'enterprise') {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'Admin privileges required'
      });
    }

    // In a real implementation, this would fetch from a persistent alert store
    // For now, we'll return a placeholder response
    const alerts = {
      active: [],
      recent: [],
      summary: {
        totalAlerts: 0,
        criticalAlerts: 0,
        resolvedAlerts: 0
      }
    };

    // Log alerts access
    AuditLoggerService.logAction({
      userId: req.user.id,
      userEmail: req.user.email,
      action: 'view_alerts',
      resource: 'monitoring',
      ipAddress: req.ip || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown',
      success: true,
      riskLevel: 'medium',
      sessionId: req.sessionID
    });

    res.json({
      success: true,
      data: alerts
    });
  } catch (error) {
    console.error('Alerts fetch error:', error);
    
    AuditLoggerService.logFailedRequest(req, 'Failed to fetch alerts', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    res.status(500).json({
      success: false,
      error: 'Alerts fetch failed',
      message: 'Unable to retrieve alerts'
    });
  }
});

export default router;