/**
 * Analytics Service
 * Tracks user behavior, system performance, and business metrics while preserving privacy
 */

import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

export interface AnalyticsEvent {
  id: string;
  sessionId: string;
  userId?: string;
  eventType: string;
  eventName: string;
  properties: Record<string, any>;
  timestamp: Date;
  userAgent?: string;
  ipAddress?: string;
  page?: string;
  referrer?: string;
}

export interface UserSession {
  id: string;
  userId?: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  pageViews: number;
  events: string[];
  userAgent: string;
  ipAddress: string;
  referrer?: string;
  exitPage?: string;
}

export interface PerformanceMetric {
  id: string;
  metricType: 'page_load' | 'api_response' | 'document_processing' | 'ai_analysis';
  value: number;
  unit: 'ms' | 'seconds' | 'bytes' | 'count';
  timestamp: Date;
  context: Record<string, any>;
}

export interface BusinessMetric {
  date: Date;
  documentsAnalyzed: number;
  uniqueUsers: number;
  newSignups: number;
  subscriptionConversions: number;
  averageSessionDuration: number;
  userSatisfactionScore: number;
  supportTickets: number;
  systemUptime: number;
}

export class AnalyticsService {
  private events: Map<string, AnalyticsEvent> = new Map();
  private sessions: Map<string, UserSession> = new Map();
  private performanceMetrics: PerformanceMetric[] = [];
  private businessMetrics: Map<string, BusinessMetric> = new Map();

  constructor() {
    this.startMetricsAggregation();
  }

  async trackEvent(eventData: {
    sessionId: string;
    userId?: string;
    eventType: string;
    eventName: string;
    properties?: Record<string, any>;
    userAgent?: string;
    ipAddress?: string;
    page?: string;
    referrer?: string;
  }): Promise<void> {
    try {
      // Privacy-first: Hash IP addresses and don't store PII
      const hashedIp = eventData.ipAddress ? this.hashString(eventData.ipAddress) : undefined;

      const event: AnalyticsEvent = {
        id: uuidv4(),
        sessionId: eventData.sessionId,
        userId: eventData.userId,
        eventType: eventData.eventType,
        eventName: eventData.eventName,
        properties: this.sanitizeProperties(eventData.properties || {}),
        timestamp: new Date(),
        userAgent: eventData.userAgent,
        ipAddress: hashedIp,
        page: eventData.page,
        referrer: eventData.referrer
      };

      this.events.set(event.id, event);

      // Update session
      await this.updateSession(eventData.sessionId, event);

      logger.debug('Analytics event tracked', { 
        eventType: event.eventType, 
        eventName: event.eventName,
        sessionId: event.sessionId
      });

    } catch (error) {
      logger.error('Error tracking analytics event', { error: error.message });
    }
  }

  async trackPerformance(metricData: {
    metricType: PerformanceMetric['metricType'];
    value: number;
    unit: PerformanceMetric['unit'];
    context?: Record<string, any>;
  }): Promise<void> {
    try {
      const metric: PerformanceMetric = {
        id: uuidv4(),
        metricType: metricData.metricType,
        value: metricData.value,
        unit: metricData.unit,
        timestamp: new Date(),
        context: metricData.context || {}
      };

      this.performanceMetrics.push(metric);

      // Keep only last 10,000 metrics to prevent memory issues
      if (this.performanceMetrics.length > 10000) {
        this.performanceMetrics = this.performanceMetrics.slice(-10000);
      }

      logger.debug('Performance metric tracked', { 
        metricType: metric.metricType, 
        value: metric.value,
        unit: metric.unit
      });

    } catch (error) {
      logger.error('Error tracking performance metric', { error: error.message });
    }
  }

  async startSession(sessionData: {
    sessionId: string;
    userId?: string;
    userAgent: string;
    ipAddress: string;
    referrer?: string;
  }): Promise<void> {
    try {
      const hashedIp = this.hashString(sessionData.ipAddress);

      const session: UserSession = {
        id: sessionData.sessionId,
        userId: sessionData.userId,
        startTime: new Date(),
        pageViews: 0,
        events: [],
        userAgent: sessionData.userAgent,
        ipAddress: hashedIp,
        referrer: sessionData.referrer
      };

      this.sessions.set(sessionData.sessionId, session);

      await this.trackEvent({
        sessionId: sessionData.sessionId,
        userId: sessionData.userId,
        eventType: 'session',
        eventName: 'session_start',
        userAgent: sessionData.userAgent,
        ipAddress: sessionData.ipAddress,
        referrer: sessionData.referrer
      });

    } catch (error) {
      logger.error('Error starting session', { error: error.message });
    }
  }

  async endSession(sessionId: string, exitPage?: string): Promise<void> {
    try {
      const session = this.sessions.get(sessionId);
      if (!session) {
        return;
      }

      session.endTime = new Date();
      session.duration = session.endTime.getTime() - session.startTime.getTime();
      session.exitPage = exitPage;

      await this.trackEvent({
        sessionId,
        userId: session.userId,
        eventType: 'session',
        eventName: 'session_end',
        properties: {
          duration: session.duration,
          pageViews: session.pageViews,
          exitPage
        }
      });

    } catch (error) {
      logger.error('Error ending session', { error: error.message });
    }
  }

  async getAnalyticsSummary(timeRange: {
    startDate: Date;
    endDate: Date;
  }): Promise<{
    totalEvents: number;
    uniqueSessions: number;
    uniqueUsers: number;
    topEvents: Array<{ eventName: string; count: number }>;
    averageSessionDuration: number;
    performanceMetrics: {
      averagePageLoad: number;
      averageApiResponse: number;
      averageDocumentProcessing: number;
    };
  }> {
    try {
      const filteredEvents = Array.from(this.events.values())
        .filter(event => 
          event.timestamp >= timeRange.startDate && 
          event.timestamp <= timeRange.endDate
        );

      const uniqueSessions = new Set(filteredEvents.map(e => e.sessionId)).size;
      const uniqueUsers = new Set(
        filteredEvents
          .filter(e => e.userId)
          .map(e => e.userId)
      ).size;

      // Top events
      const eventCounts = new Map<string, number>();
      filteredEvents.forEach(event => {
        const count = eventCounts.get(event.eventName) || 0;
        eventCounts.set(event.eventName, count + 1);
      });

      const topEvents = Array.from(eventCounts.entries())
        .map(([eventName, count]) => ({ eventName, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Average session duration
      const completedSessions = Array.from(this.sessions.values())
        .filter(session => 
          session.duration && 
          session.startTime >= timeRange.startDate && 
          session.startTime <= timeRange.endDate
        );

      const averageSessionDuration = completedSessions.length > 0
        ? completedSessions.reduce((sum, session) => sum + (session.duration || 0), 0) / completedSessions.length
        : 0;

      // Performance metrics
      const performanceInRange = this.performanceMetrics
        .filter(metric => 
          metric.timestamp >= timeRange.startDate && 
          metric.timestamp <= timeRange.endDate
        );

      const getAverageMetric = (type: string) => {
        const metrics = performanceInRange.filter(m => m.metricType === type);
        return metrics.length > 0
          ? metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length
          : 0;
      };

      return {
        totalEvents: filteredEvents.length,
        uniqueSessions,
        uniqueUsers,
        topEvents,
        averageSessionDuration,
        performanceMetrics: {
          averagePageLoad: getAverageMetric('page_load'),
          averageApiResponse: getAverageMetric('api_response'),
          averageDocumentProcessing: getAverageMetric('document_processing')
        }
      };

    } catch (error) {
      logger.error('Error generating analytics summary', { error: error.message });
      throw error;
    }
  }

  async getUserJourney(userId: string, timeRange?: {
    startDate: Date;
    endDate: Date;
  }): Promise<{
    sessions: UserSession[];
    events: AnalyticsEvent[];
    totalSessions: number;
    totalEvents: number;
    averageSessionDuration: number;
    mostUsedFeatures: Array<{ feature: string; usage: number }>;
  }> {
    try {
      let userEvents = Array.from(this.events.values())
        .filter(event => event.userId === userId);

      let userSessions = Array.from(this.sessions.values())
        .filter(session => session.userId === userId);

      if (timeRange) {
        userEvents = userEvents.filter(event => 
          event.timestamp >= timeRange.startDate && 
          event.timestamp <= timeRange.endDate
        );
        userSessions = userSessions.filter(session => 
          session.startTime >= timeRange.startDate && 
          session.startTime <= timeRange.endDate
        );
      }

      // Calculate average session duration
      const completedSessions = userSessions.filter(s => s.duration);
      const averageSessionDuration = completedSessions.length > 0
        ? completedSessions.reduce((sum, s) => sum + (s.duration || 0), 0) / completedSessions.length
        : 0;

      // Most used features
      const featureUsage = new Map<string, number>();
      userEvents.forEach(event => {
        if (event.eventType === 'feature_usage') {
          const feature = event.properties.feature || event.eventName;
          featureUsage.set(feature, (featureUsage.get(feature) || 0) + 1);
        }
      });

      const mostUsedFeatures = Array.from(featureUsage.entries())
        .map(([feature, usage]) => ({ feature, usage }))
        .sort((a, b) => b.usage - a.usage)
        .slice(0, 5);

      return {
        sessions: userSessions.sort((a, b) => b.startTime.getTime() - a.startTime.getTime()),
        events: userEvents.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()),
        totalSessions: userSessions.length,
        totalEvents: userEvents.length,
        averageSessionDuration,
        mostUsedFeatures
      };

    } catch (error) {
      logger.error('Error generating user journey', { error: error.message, userId });
      throw error;
    }
  }

  async getBusinessMetrics(date: Date): Promise<BusinessMetric> {
    try {
      const dateKey = date.toISOString().split('T')[0];
      
      if (this.businessMetrics.has(dateKey)) {
        return this.businessMetrics.get(dateKey)!;
      }

      // Calculate metrics for the given date
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const dayEvents = Array.from(this.events.values())
        .filter(event => 
          event.timestamp >= startOfDay && 
          event.timestamp <= endOfDay
        );

      const documentsAnalyzed = dayEvents
        .filter(event => event.eventName === 'document_analyzed').length;

      const uniqueUsers = new Set(
        dayEvents
          .filter(event => event.userId)
          .map(event => event.userId)
      ).size;

      const newSignups = dayEvents
        .filter(event => event.eventName === 'user_signup').length;

      const subscriptionConversions = dayEvents
        .filter(event => event.eventName === 'subscription_created').length;

      const daySessions = Array.from(this.sessions.values())
        .filter(session => 
          session.startTime >= startOfDay && 
          session.startTime <= endOfDay &&
          session.duration
        );

      const averageSessionDuration = daySessions.length > 0
        ? daySessions.reduce((sum, s) => sum + (s.duration || 0), 0) / daySessions.length
        : 0;

      // Mock some metrics that would come from other systems
      const userSatisfactionScore = 4.2 + Math.random() * 0.6; // 4.2-4.8
      const supportTickets = Math.floor(Math.random() * 10) + 1; // 1-10
      const systemUptime = 99.5 + Math.random() * 0.5; // 99.5-100%

      const metrics: BusinessMetric = {
        date,
        documentsAnalyzed,
        uniqueUsers,
        newSignups,
        subscriptionConversions,
        averageSessionDuration,
        userSatisfactionScore,
        supportTickets,
        systemUptime
      };

      this.businessMetrics.set(dateKey, metrics);
      return metrics;

    } catch (error) {
      logger.error('Error calculating business metrics', { error: error.message, date });
      throw error;
    }
  }

  private async updateSession(sessionId: string, event: AnalyticsEvent): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    session.events.push(event.eventName);

    if (event.eventType === 'page_view') {
      session.pageViews++;
    }

    // Update user ID if not set
    if (event.userId && !session.userId) {
      session.userId = event.userId;
    }
  }

  private sanitizeProperties(properties: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(properties)) {
      // Remove potential PII
      if (this.isPotentialPII(key, value)) {
        continue;
      }

      // Sanitize values
      if (typeof value === 'string') {
        sanitized[key] = value.substring(0, 1000); // Limit string length
      } else if (typeof value === 'number') {
        sanitized[key] = isFinite(value) ? value : 0;
      } else if (typeof value === 'boolean') {
        sanitized[key] = value;
      } else if (Array.isArray(value)) {
        sanitized[key] = value.slice(0, 100); // Limit array length
      } else if (value && typeof value === 'object') {
        sanitized[key] = JSON.stringify(value).substring(0, 1000);
      }
    }

    return sanitized;
  }

  private isPotentialPII(key: string, value: any): boolean {
    const piiKeys = [
      'email', 'phone', 'ssn', 'credit_card', 'password', 
      'address', 'name', 'first_name', 'last_name'
    ];

    const keyLower = key.toLowerCase();
    
    // Check if key suggests PII
    if (piiKeys.some(piiKey => keyLower.includes(piiKey))) {
      return true;
    }

    // Check if value looks like email
    if (typeof value === 'string' && value.includes('@') && value.includes('.')) {
      return true;
    }

    // Check if value looks like phone number
    if (typeof value === 'string' && /^\+?[\d\s\-\(\)]{10,}$/.test(value)) {
      return true;
    }

    return false;
  }

  private hashString(input: string): string {
    // Simple hash function for privacy (in production, use crypto.createHash)
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  private startMetricsAggregation(): void {
    // Aggregate daily metrics every hour
    setInterval(async () => {
      try {
        const today = new Date();
        await this.getBusinessMetrics(today);
        
        // Clean up old events (keep only last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        for (const [id, event] of this.events.entries()) {
          if (event.timestamp < thirtyDaysAgo) {
            this.events.delete(id);
          }
        }

        // Clean up old sessions
        for (const [id, session] of this.sessions.entries()) {
          if (session.startTime < thirtyDaysAgo) {
            this.sessions.delete(id);
          }
        }

        logger.debug('Metrics aggregation completed');

      } catch (error) {
        logger.error('Error in metrics aggregation', { error: error.message });
      }
    }, 60 * 60 * 1000); // Every hour
  }
}