import request from 'supertest';
import express from 'express';
import { sanitizeInput, xssProtection, securityHeaders } from '../../middleware/security';
import { CSRFProtection } from '../../middleware/csrf';

describe('Security Middleware Tests', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  describe('Input Sanitization', () => {
    beforeEach(() => {
      app.use(sanitizeInput);
      app.post('/test', (req, res) => {
        res.json({ body: req.body, query: req.query, params: req.params });
      });
    });

    it('should sanitize XSS attempts in request body', async () => {
      const maliciousInput = {
        name: '<script>alert("xss")</script>John',
        description: '<img src="x" onerror="alert(1)">Test description'
      };

      const response = await request(app)
        .post('/test')
        .send(maliciousInput)
        .expect(200);

      expect(response.body.body.name).toBe('John');
      expect(response.body.body.description).toBe('Test description');
    });

    it('should sanitize nested objects', async () => {
      const maliciousInput = {
        user: {
          profile: {
            bio: '<script>alert("nested xss")</script>Clean bio'
          }
        }
      };

      const response = await request(app)
        .post('/test')
        .send(maliciousInput)
        .expect(200);

      expect(response.body.body.user.profile.bio).toBe('Clean bio');
    });

    it('should sanitize arrays', async () => {
      const maliciousInput = {
        tags: ['<script>alert("xss")</script>tag1', 'normal-tag', '<img src=x onerror=alert(1)>tag2']
      };

      const response = await request(app)
        .post('/test')
        .send(maliciousInput)
        .expect(200);

      expect(response.body.body.tags).toEqual(['tag1', 'normal-tag', 'tag2']);
    });

    it('should handle non-string values correctly', async () => {
      const input = {
        number: 123,
        boolean: true,
        null: null,
        undefined: undefined,
        object: { nested: 'value' }
      };

      const response = await request(app)
        .post('/test')
        .send(input)
        .expect(200);

      expect(response.body.body.number).toBe(123);
      expect(response.body.body.boolean).toBe(true);
      expect(response.body.body.null).toBe(null);
      expect(response.body.body.object.nested).toBe('value');
    });
  });

  describe('XSS Protection Headers', () => {
    beforeEach(() => {
      app.use(xssProtection);
      app.get('/test', (req, res) => {
        res.json({ message: 'test' });
      });
    });

    it('should set XSS protection headers', async () => {
      const response = await request(app)
        .get('/test')
        .expect(200);

      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    });
  });

  describe('Security Headers', () => {
    beforeEach(() => {
      app.use(securityHeaders);
      app.get('/test', (req, res) => {
        res.json({ message: 'test' });
      });
    });

    it('should set comprehensive security headers', async () => {
      const response = await request(app)
        .get('/test')
        .expect(200);

      expect(response.headers['content-security-policy']).toContain("default-src 'self'");
      expect(response.headers['strict-transport-security']).toBe('max-age=31536000; includeSubDomains; preload');
      expect(response.headers['permissions-policy']).toContain('camera=()');
    });
  });

  describe('CSRF Protection', () => {
    beforeEach(() => {
      // Mock session middleware
      app.use((req: any, res, next) => {
        req.session = {};
        next();
      });
      
      app.use(CSRFProtection.addTokenToResponse());
      app.get('/token', (req, res) => {
        res.json({ message: 'token endpoint' });
      });
      
      app.use(CSRFProtection.verifyCSRFToken());
      app.post('/protected', (req, res) => {
        res.json({ message: 'protected endpoint' });
      });
    });

    it('should add CSRF token to GET responses', async () => {
      const response = await request(app)
        .get('/token')
        .expect(200);

      expect(response.headers['x-csrf-token']).toBeDefined();
      expect(response.body.csrfToken).toBeDefined();
    });

    it('should reject POST requests without CSRF token', async () => {
      const response = await request(app)
        .post('/protected')
        .send({ data: 'test' })
        .expect(403);

      expect(response.body.error).toBe('CSRF token missing');
    });

    it('should allow requests with valid JWT token (skip CSRF)', async () => {
      const response = await request(app)
        .post('/protected')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send({ data: 'test' })
        .expect(200);

      expect(response.body.message).toBe('protected endpoint');
    });
  });
});

describe('Security Vulnerability Tests', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(sanitizeInput);
  });

  describe('SQL Injection Protection', () => {
    it('should sanitize potential SQL injection attempts', async () => {
      app.post('/test', (req, res) => {
        res.json({ sanitized: req.body });
      });

      const sqlInjectionAttempts = [
        "'; DROP TABLE users; --",
        "1' OR '1'='1",
        "admin'/*",
        "1; DELETE FROM users WHERE 1=1; --"
      ];

      for (const attempt of sqlInjectionAttempts) {
        const response = await request(app)
          .post('/test')
          .send({ input: attempt })
          .expect(200);

        // Should not contain SQL injection patterns
        expect(response.body.sanitized.input).not.toContain('DROP TABLE');
        expect(response.body.sanitized.input).not.toContain('DELETE FROM');
        expect(response.body.sanitized.input).not.toContain('--');
      }
    });
  });

  describe('XSS Protection', () => {
    it('should prevent various XSS attack vectors', async () => {
      app.post('/test', (req, res) => {
        res.json({ sanitized: req.body });
      });

      const xssAttempts = [
        '<script>alert("xss")</script>',
        '<img src="x" onerror="alert(1)">',
        '<svg onload="alert(1)">',
        'javascript:alert(1)',
        '<iframe src="javascript:alert(1)"></iframe>',
        '<object data="javascript:alert(1)"></object>',
        '<embed src="javascript:alert(1)">',
        '<link rel="stylesheet" href="javascript:alert(1)">',
        '<style>@import "javascript:alert(1)";</style>'
      ];

      for (const attempt of xssAttempts) {
        const response = await request(app)
          .post('/test')
          .send({ input: attempt })
          .expect(200);

        // Should not contain script tags or javascript: protocols
        expect(response.body.sanitized.input).not.toContain('<script');
        expect(response.body.sanitized.input).not.toContain('javascript:');
        expect(response.body.sanitized.input).not.toContain('onerror');
        expect(response.body.sanitized.input).not.toContain('onload');
      }
    });
  });

  describe('Path Traversal Protection', () => {
    it('should sanitize path traversal attempts', async () => {
      app.post('/test', (req, res) => {
        res.json({ sanitized: req.body });
      });

      const pathTraversalAttempts = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        '....//....//....//etc/passwd',
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd'
      ];

      for (const attempt of pathTraversalAttempts) {
        const response = await request(app)
          .post('/test')
          .send({ filename: attempt })
          .expect(200);

        // Should not contain path traversal patterns
        expect(response.body.sanitized.filename).not.toContain('../');
        expect(response.body.sanitized.filename).not.toContain('..\\');
        expect(response.body.sanitized.filename).not.toContain('/etc/');
        expect(response.body.sanitized.filename).not.toContain('\\windows\\');
      }
    });
  });
});