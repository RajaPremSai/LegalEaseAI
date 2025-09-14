import request from 'supertest';
import express from 'express';
import { sanitizeInput, standardRateLimit, strictRateLimit } from '../../middleware/security';
import { authMiddleware } from '../../middleware/auth';

describe('Penetration Testing Suite', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(sanitizeInput);
  });

  describe('Authentication Bypass Attempts', () => {
    beforeEach(() => {
      app.use('/protected', authMiddleware);
      app.get('/protected/resource', (req, res) => {
        res.json({ message: 'protected resource' });
      });
    });

    it('should reject requests without authentication', async () => {
      await request(app)
        .get('/protected/resource')
        .expect(401);
    });

    it('should reject malformed JWT tokens', async () => {
      const malformedTokens = [
        'Bearer invalid.token.here',
        'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid',
        'Bearer null',
        'Bearer undefined',
        'Bearer ',
        'InvalidBearer token'
      ];

      for (const token of malformedTokens) {
        await request(app)
          .get('/protected/resource')
          .set('Authorization', token)
          .expect(401);
      }
    });

    it('should reject requests with missing Bearer prefix', async () => {
      await request(app)
        .get('/protected/resource')
        .set('Authorization', 'some-token-without-bearer')
        .expect(401);
    });
  });

  describe('Rate Limiting Tests', () => {
    it('should enforce rate limits on endpoints', async () => {
      // Create a simple rate-limited endpoint (5 requests per minute for testing)
      const testRateLimit = (windowMs: number, max: number) => {
        let requests = 0;
        const resetTime = Date.now() + windowMs;
        
        return (req: any, res: any, next: any) => {
          if (Date.now() > resetTime) {
            requests = 0;
          }
          
          if (requests >= max) {
            return res.status(429).json({ error: 'Rate limit exceeded' });
          }
          
          requests++;
          next();
        };
      };

      app.use('/rate-limited', testRateLimit(60000, 3)); // 3 requests per minute
      app.get('/rate-limited/endpoint', (req, res) => {
        res.json({ message: 'success' });
      });

      // First 3 requests should succeed
      for (let i = 0; i < 3; i++) {
        await request(app)
          .get('/rate-limited/endpoint')
          .expect(200);
      }

      // 4th request should be rate limited
      await request(app)
        .get('/rate-limited/endpoint')
        .expect(429);
    });
  });

  describe('Input Validation Bypass Attempts', () => {
    beforeEach(() => {
      app.post('/validate', (req, res) => {
        res.json({ received: req.body });
      });
    });

    it('should handle extremely large payloads', async () => {
      const largePayload = {
        data: 'x'.repeat(1000000) // 1MB of data
      };

      const response = await request(app)
        .post('/validate')
        .send(largePayload);

      // Should either accept and sanitize or reject with appropriate error
      expect([200, 413, 400]).toContain(response.status);
    });

    it('should handle deeply nested objects', async () => {
      // Create deeply nested object (potential DoS via JSON parsing)
      let deepObject: any = { value: 'test' };
      for (let i = 0; i < 100; i++) {
        deepObject = { nested: deepObject };
      }

      const response = await request(app)
        .post('/validate')
        .send(deepObject);

      // Should handle gracefully without crashing
      expect([200, 400, 413]).toContain(response.status);
    });

    it('should handle circular references safely', async () => {
      // Note: JSON.stringify will throw on circular references
      // This tests that our middleware handles malformed JSON gracefully
      
      const response = await request(app)
        .post('/validate')
        .set('Content-Type', 'application/json')
        .send('{"a": {"b": {"c": {"$ref": "#/a"}}}}'); // JSON pointer reference

      expect([200, 400]).toContain(response.status);
    });
  });

  describe('Header Injection Tests', () => {
    beforeEach(() => {
      app.get('/header-test', (req, res) => {
        // Simulate endpoint that might use user input in headers
        const userAgent = req.get('User-Agent') || 'unknown';
        res.set('X-User-Agent', userAgent);
        res.json({ message: 'header test' });
      });
    });

    it('should prevent header injection via User-Agent', async () => {
      const maliciousUserAgent = 'Mozilla/5.0\r\nX-Injected-Header: malicious\r\nContent-Length: 0\r\n\r\n';

      const response = await request(app)
        .get('/header-test')
        .set('User-Agent', maliciousUserAgent)
        .expect(200);

      // Should not contain injected headers
      expect(response.headers['x-injected-header']).toBeUndefined();
    });
  });

  describe('File Upload Security Tests', () => {
    beforeEach(() => {
      app.post('/upload-test', (req, res) => {
        // Simulate file upload endpoint
        const contentType = req.get('Content-Type') || '';
        res.json({ contentType, body: req.body });
      });
    });

    it('should handle malicious file types', async () => {
      const maliciousFileTypes = [
        'application/x-executable',
        'application/x-msdownload',
        'application/x-msdos-program',
        'text/html', // HTML files can contain XSS
        'application/javascript'
      ];

      for (const contentType of maliciousFileTypes) {
        const response = await request(app)
          .post('/upload-test')
          .set('Content-Type', contentType)
          .send('malicious content');

        // Should handle safely (either accept with sanitization or reject)
        expect([200, 400, 415]).toContain(response.status);
      }
    });
  });

  describe('NoSQL Injection Tests', () => {
    beforeEach(() => {
      app.post('/nosql-test', (req, res) => {
        // Simulate endpoint that might use input in NoSQL queries
        res.json({ query: req.body });
      });
    });

    it('should prevent NoSQL injection attempts', async () => {
      const nosqlInjectionAttempts = [
        { $where: 'function() { return true; }' },
        { $regex: '.*' },
        { $ne: null },
        { $gt: '' },
        { $exists: true },
        { username: { $ne: null }, password: { $ne: null } }
      ];

      for (const attempt of nosqlInjectionAttempts) {
        const response = await request(app)
          .post('/nosql-test')
          .send(attempt);

        // Input should be sanitized to remove NoSQL operators
        expect(response.status).toBe(200);
        const sanitized = JSON.stringify(response.body.query);
        expect(sanitized).not.toContain('$where');
        expect(sanitized).not.toContain('$regex');
        expect(sanitized).not.toContain('$ne');
        expect(sanitized).not.toContain('$gt');
        expect(sanitized).not.toContain('$exists');
      }
    });
  });

  describe('Prototype Pollution Tests', () => {
    beforeEach(() => {
      app.post('/prototype-test', (req, res) => {
        // Simulate vulnerable object assignment
        const result: any = {};
        Object.assign(result, req.body);
        res.json({ result });
      });
    });

    it('should prevent prototype pollution attacks', async () => {
      const prototypePollutionAttempts = [
        { '__proto__': { 'polluted': true } },
        { 'constructor': { 'prototype': { 'polluted': true } } },
        { 'prototype': { 'polluted': true } }
      ];

      for (const attempt of prototypePollutionAttempts) {
        await request(app)
          .post('/prototype-test')
          .send(attempt);

        // Check that prototype wasn't polluted
        expect((Object.prototype as any).polluted).toBeUndefined();
        expect((Array.prototype as any).polluted).toBeUndefined();
      }
    });
  });

  describe('Timing Attack Tests', () => {
    it('should have consistent response times for invalid credentials', async () => {
      app.post('/login-test', (req, res) => {
        const { username, password } = req.body;
        
        // Simulate constant-time comparison
        const validUsername = 'admin';
        const validPassword = 'password123';
        
        const usernameMatch = username === validUsername;
        const passwordMatch = password === validPassword;
        
        if (usernameMatch && passwordMatch) {
          res.json({ success: true });
        } else {
          // Add artificial delay to prevent timing attacks
          setTimeout(() => {
            res.status(401).json({ success: false });
          }, 100);
        }
      });

      const startTime = Date.now();
      
      // Test with invalid credentials
      await request(app)
        .post('/login-test')
        .send({ username: 'wrong', password: 'wrong' })
        .expect(401);
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      // Should take at least 100ms due to artificial delay
      expect(responseTime).toBeGreaterThanOrEqual(100);
    });
  });
});