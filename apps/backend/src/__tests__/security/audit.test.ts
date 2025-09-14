import AuditLoggerService from '../../services/auditLogger';
import { Request } from 'express';

// Mock winston to capture log calls
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
    simple: jest.fn()
  },
  transports: {
    File: jest.fn(),
    Console: jest.fn()
  }
}));

describe('Audit Logger Service', () => {
  let mockRequest: Partial<Request>;

  beforeEach(() => {
    mockRequest = {
      ip: '192.168.1.1',
      get: jest.fn((header: string) => {
        if (header === 'User-Agent') return 'Mozilla/5.0 Test Browser';
        return undefined;
      }),
      sessionID: 'test-session-123',
      path: '/api/test',
      method: 'POST'
    };

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('logAction', () => {
    it('should log user actions with all required fields', () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation();

      AuditLoggerService.logAction({
        userId: 'user-123',
        userEmail: 'test@example.com',
        action: 'document_upload',
        resource: 'document',
        resourceId: 'doc-456',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser',
        success: true,
        riskLevel: 'medium',
        sessionId: 'session-123'
      });

      // Verify that logging was called (implementation details may vary)
      expect(logSpy).toHaveBeenCalled();
      logSpy.mockRestore();
    });

    it('should handle high-risk actions appropriately', () => {
      const securityLogSpy = jest.spyOn(AuditLoggerService, 'logSecurityEvent').mockImplementation();

      AuditLoggerService.logAction({
        userId: 'user-123',
        userEmail: 'test@example.com',
        action: 'bulk_delete',
        resource: 'document',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser',
        success: true,
        riskLevel: 'high',
        sessionId: 'session-123'
      });

      expect(securityLogSpy).toHaveBeenCalled();
      securityLogSpy.mockRestore();
    });
  });

  describe('logAuth', () => {
    it('should log successful authentication', () => {
      const logActionSpy = jest.spyOn(AuditLoggerService, 'logAction').mockImplementation();

      AuditLoggerService.logAuth(mockRequest as Request, 'login', true, { method: 'jwt' });

      expect(logActionSpy).toHaveBeenCalledWith(expect.objectContaining({
        action: 'login',
        resource: 'authentication',
        success: true,
        riskLevel: 'low',
        details: { method: 'jwt' }
      }));

      logActionSpy.mockRestore();
    });

    it('should log failed authentication with medium risk', () => {
      const logActionSpy = jest.spyOn(AuditLoggerService, 'logAction').mockImplementation();

      AuditLoggerService.logAuth(mockRequest as Request, 'login', false, { reason: 'invalid_password' });

      expect(logActionSpy).toHaveBeenCalledWith(expect.objectContaining({
        action: 'login',
        resource: 'authentication',
        success: false,
        riskLevel: 'medium',
        details: { reason: 'invalid_password' }
      }));

      logActionSpy.mockRestore();
    });
  });

  describe('logDocumentAction', () => {
    it('should determine correct risk level for document actions', () => {
      const logActionSpy = jest.spyOn(AuditLoggerService, 'logAction').mockImplementation();

      // Test high-risk action
      AuditLoggerService.logDocumentAction(mockRequest as Request, 'delete', 'doc-123');
      expect(logActionSpy).toHaveBeenCalledWith(expect.objectContaining({
        riskLevel: 'high'
      }));

      // Test medium-risk action
      AuditLoggerService.logDocumentAction(mockRequest as Request, 'upload', 'doc-123');
      expect(logActionSpy).toHaveBeenCalledWith(expect.objectContaining({
        riskLevel: 'medium'
      }));

      // Test low-risk action
      AuditLoggerService.logDocumentAction(mockRequest as Request, 'view', 'doc-123');
      expect(logActionSpy).toHaveBeenCalledWith(expect.objectContaining({
        riskLevel: 'low'
      }));

      logActionSpy.mockRestore();
    });
  });

  describe('logAIAction', () => {
    it('should log AI analysis actions with medium risk', () => {
      const logActionSpy = jest.spyOn(AuditLoggerService, 'logAction').mockImplementation();

      AuditLoggerService.logAIAction(mockRequest as Request, 'analyze_document', 'doc-123', true, {
        model: 'palm-2',
        tokens_used: 1500
      });

      expect(logActionSpy).toHaveBeenCalledWith(expect.objectContaining({
        action: 'analyze_document',
        resource: 'ai_analysis',
        resourceId: 'doc-123',
        success: true,
        riskLevel: 'medium',
        details: {
          model: 'palm-2',
          tokens_used: 1500
        }
      }));

      logActionSpy.mockRestore();
    });
  });

  describe('logPrivacyAction', () => {
    it('should log privacy actions with high risk', () => {
      const logActionSpy = jest.spyOn(AuditLoggerService, 'logAction').mockImplementation();

      AuditLoggerService.logPrivacyAction(mockRequest as Request, 'data_export', true, {
        export_type: 'full_data'
      });

      expect(logActionSpy).toHaveBeenCalledWith(expect.objectContaining({
        action: 'data_export',
        resource: 'privacy',
        success: true,
        riskLevel: 'high',
        details: {
          export_type: 'full_data'
        }
      }));

      logActionSpy.mockRestore();
    });
  });

  describe('logFailedRequest', () => {
    it('should log failed requests with appropriate details', () => {
      const logActionSpy = jest.spyOn(AuditLoggerService, 'logAction').mockImplementation();

      AuditLoggerService.logFailedRequest(mockRequest as Request, 'Validation failed', {
        field: 'email',
        value: 'invalid-email'
      });

      expect(logActionSpy).toHaveBeenCalledWith(expect.objectContaining({
        action: 'failed_request',
        resource: 'api',
        success: false,
        riskLevel: 'medium',
        details: {
          error: 'Validation failed',
          path: '/api/test',
          method: 'POST',
          field: 'email',
          value: 'invalid-email'
        }
      }));

      logActionSpy.mockRestore();
    });
  });

  describe('createAuditMiddleware', () => {
    it('should create middleware that logs actions based on response status', () => {
      const logActionSpy = jest.spyOn(AuditLoggerService, 'logAction').mockImplementation();
      
      const middleware = AuditLoggerService.createAuditMiddleware('test_action', 'test_resource');
      
      const mockRes = {
        statusCode: 200,
        send: jest.fn()
      };
      
      const mockNext = jest.fn();
      
      // Call middleware
      middleware(mockRequest as Request, mockRes as any, mockNext);
      
      // Simulate response
      const originalSend = mockRes.send;
      mockRes.send('test response');
      
      expect(logActionSpy).toHaveBeenCalledWith(expect.objectContaining({
        action: 'test_action',
        resource: 'test_resource',
        success: true,
        riskLevel: 'low'
      }));
      
      logActionSpy.mockRestore();
    });

    it('should log failed requests when status code >= 400', () => {
      const logActionSpy = jest.spyOn(AuditLoggerService, 'logAction').mockImplementation();
      
      const middleware = AuditLoggerService.createAuditMiddleware('test_action', 'test_resource');
      
      const mockRes = {
        statusCode: 400,
        send: jest.fn()
      };
      
      const mockNext = jest.fn();
      
      // Call middleware
      middleware(mockRequest as Request, mockRes as any, mockNext);
      
      // Simulate error response
      mockRes.send('error response');
      
      expect(logActionSpy).toHaveBeenCalledWith(expect.objectContaining({
        action: 'test_action',
        resource: 'test_resource',
        success: false,
        riskLevel: 'medium',
        details: { statusCode: 400 }
      }));
      
      logActionSpy.mockRestore();
    });
  });

  describe('IP Address Extraction', () => {
    it('should extract IP address from various request properties', () => {
      const testCases = [
        { ip: '192.168.1.1', expected: '192.168.1.1' },
        { connection: { remoteAddress: '10.0.0.1' }, expected: '10.0.0.1' },
        { socket: { remoteAddress: '172.16.0.1' }, expected: '172.16.0.1' },
        { expected: 'unknown' } // No IP available
      ];

      testCases.forEach((testCase, index) => {
        const logActionSpy = jest.spyOn(AuditLoggerService, 'logAction').mockImplementation();
        
        const testRequest = {
          ...mockRequest,
          ...testCase,
          get: jest.fn(() => 'Test Browser')
        };
        
        delete (testRequest as any).expected;
        
        AuditLoggerService.logDocumentAction(testRequest as Request, 'test', 'doc-123');
        
        expect(logActionSpy).toHaveBeenCalledWith(expect.objectContaining({
          ipAddress: testCase.expected
        }));
        
        logActionSpy.mockRestore();
      });
    });
  });
});