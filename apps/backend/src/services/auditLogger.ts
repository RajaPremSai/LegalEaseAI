import winston from 'winston';
import { Request } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';

// Configure Winston logger for audit logs
const auditLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'legal-ai-audit' },
  transports: [
    // Write audit logs to a separate file
    new winston.transports.File({ 
      filename: 'logs/audit.log',
      maxsize: 10485760, // 10MB
      maxFiles: 10,
      tailable: true
    }),
    // Also log to console in development
    ...(process.env.NODE_ENV === 'development' ? [
      new winston.transports.Console({
        format: winston.format.simple()
      })
    ] : [])
  ]
});

export interface AuditLogEntry {
  userId?: string;
  userEmail?: string;
  action: string;
  resource: string;
  resourceId?: string;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  success: boolean;
  details?: Record<string, any>;
  riskLevel: 'low' | 'medium' | 'high';
  sessionId?: string;
}

export class AuditLoggerService {
  /**
   * Log a user action for audit purposes
   */
  static logAction(entry: Omit<AuditLogEntry, 'timestamp'>) {
    const logEntry: AuditLogEntry = {
      ...entry,
      timestamp: new Date()
    };

    auditLogger.info('User action logged', logEntry);

    // For high-risk actions, also log to security monitoring
    if (entry.riskLevel === 'high') {
      this.logSecurityEvent(logEntry);
    }
  }

  /**
   * Log authentication events
   */
  static logAuth(req: Request, action: 'login' | 'logout' | 'register' | 'password_reset', success: boolean, details?: Record<string, any>) {
    const authReq = req as AuthenticatedRequest;
    
    this.logAction({
      userId: authReq.user?.id,
      userEmail: authReq.user?.email,
      action,
      resource: 'authentication',
      ipAddress: this.getClientIP(req),
      userAgent: req.get('User-Agent') || 'unknown',
      success,
      details,
      riskLevel: success ? 'low' : 'medium',
      sessionId: req.sessionID
    });
  }

  /**
   * Log document operations
   */
  static logDocumentAction(req: Request, action: string, documentId?: string, success: boolean = true, details?: Record<string, any>) {
    const authReq = req as AuthenticatedRequest;
    
    this.logAction({
      userId: authReq.user?.id,
      userEmail: authReq.user?.email,
      action,
      resource: 'document',
      resourceId: documentId,
      ipAddress: this.getClientIP(req),
      userAgent: req.get('User-Agent') || 'unknown',
      success,
      details,
      riskLevel: this.determineDocumentRiskLevel(action),
      sessionId: req.sessionID
    });
  }

  /**
   * Log AI analysis operations
   */
  static logAIAction(req: Request, action: string, documentId?: string, success: boolean = true, details?: Record<string, any>) {
    const authReq = req as AuthenticatedRequest;
    
    this.logAction({
      userId: authReq.user?.id,
      userEmail: authReq.user?.email,
      action,
      resource: 'ai_analysis',
      resourceId: documentId,
      ipAddress: this.getClientIP(req),
      userAgent: req.get('User-Agent') || 'unknown',
      success,
      details,
      riskLevel: 'medium', // AI operations are medium risk
      sessionId: req.sessionID
    });
  }

  /**
   * Log privacy and compliance actions
   */
  static logPrivacyAction(req: Request, action: string, success: boolean = true, details?: Record<string, any>) {
    const authReq = req as AuthenticatedRequest;
    
    this.logAction({
      userId: authReq.user?.id,
      userEmail: authReq.user?.email,
      action,
      resource: 'privacy',
      ipAddress: this.getClientIP(req),
      userAgent: req.get('User-Agent') || 'unknown',
      success,
      details,
      riskLevel: 'high', // Privacy actions are high risk
      sessionId: req.sessionID
    });
  }

  /**
   * Log security events
   */
  static logSecurityEvent(entry: AuditLogEntry) {
    // In production, this would integrate with security monitoring systems
    // like Google Cloud Security Command Center, Splunk, or similar
    console.warn('SECURITY EVENT:', entry);
    
    // Log to separate security log file
    const securityLogger = winston.createLogger({
      level: 'warn',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ 
          filename: 'logs/security.log',
          maxsize: 10485760,
          maxFiles: 20,
          tailable: true
        })
      ]
    });

    securityLogger.warn('Security event detected', entry);
  }

  /**
   * Log failed requests and potential attacks
   */
  static logFailedRequest(req: Request, error: string, details?: Record<string, any>) {
    this.logAction({
      userId: (req as AuthenticatedRequest).user?.id,
      userEmail: (req as AuthenticatedRequest).user?.email,
      action: 'failed_request',
      resource: 'api',
      ipAddress: this.getClientIP(req),
      userAgent: req.get('User-Agent') || 'unknown',
      success: false,
      details: {
        error,
        path: req.path,
        method: req.method,
        ...details
      },
      riskLevel: 'medium',
      sessionId: req.sessionID
    });
  }

  /**
   * Get client IP address from request
   */
  private static getClientIP(req: Request): string {
    return (
      req.ip ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      (req.connection as any)?.socket?.remoteAddress ||
      'unknown'
    );
  }

  /**
   * Determine risk level for document actions
   */
  private static determineDocumentRiskLevel(action: string): 'low' | 'medium' | 'high' {
    const highRiskActions = ['delete', 'bulk_delete', 'export_all'];
    const mediumRiskActions = ['upload', 'share', 'download'];
    
    if (highRiskActions.includes(action)) return 'high';
    if (mediumRiskActions.includes(action)) return 'medium';
    return 'low';
  }

  /**
   * Create audit middleware for automatic logging
   */
  static createAuditMiddleware(action: string, resource: string) {
    return (req: Request, res: Response, next: NextFunction) => {
      const originalSend = res.send;
      
      res.send = function(data) {
        const success = res.statusCode < 400;
        
        AuditLoggerService.logAction({
          userId: (req as AuthenticatedRequest).user?.id,
          userEmail: (req as AuthenticatedRequest).user?.email,
          action,
          resource,
          resourceId: req.params.id || req.params.documentId,
          ipAddress: AuditLoggerService.getClientIP(req),
          userAgent: req.get('User-Agent') || 'unknown',
          success,
          details: success ? undefined : { statusCode: res.statusCode },
          riskLevel: success ? 'low' : 'medium',
          sessionId: req.sessionID
        });
        
        return originalSend.call(this, data);
      };
      
      next();
    };
  }
}

// Create logs directory if it doesn't exist
import { mkdirSync } from 'fs';
try {
  mkdirSync('logs', { recursive: true });
} catch (error) {
  // Directory might already exist
}

export default AuditLoggerService;