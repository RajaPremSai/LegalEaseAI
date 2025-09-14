import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import privacyRoutes from './routes/privacy';
import uploadRoutes from './routes/upload';
import documentRoutes from './routes/documents';
import qaRoutes from './routes/qa';
import documentVersionRoutes from './routes/documentVersions';
import analysisRoutes from './routes/analysis';
import templateRoutes from './routes/templates';
import workspaceRoutes from './routes/workspaces';
import bulkProcessingRoutes from './routes/bulkProcessing';
import monitoringRoutes from './routes/monitoring';
import { schedulerService } from './services/scheduler';
import { 
  sanitizeInput, 
  xssProtection, 
  securityHeaders, 
  standardRateLimit,
  requestSizeLimiter 
} from './middleware/security';
import { csrfTokenGenerator } from './middleware/csrf';
import AuditLoggerService from './services/auditLogger';
import MonitoringService from './services/monitoring';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://apis.google.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.google.com", "https://*.googleapis.com"],
      frameAncestors: ["'none'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  optionsSuccessStatus: 200
}));

app.use(securityHeaders);
app.use(xssProtection);
app.use(standardRateLimit);
app.use(requestSizeLimiter('50mb'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(sanitizeInput);
app.use(csrfTokenGenerator);

// Monitoring middleware
app.use(MonitoringService.performanceMiddleware());
app.use(MonitoringService.errorMiddleware());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// API routes
app.get('/api', (req, res) => {
  res.json({ message: 'Legal Document AI Assistant API' });
});

// Authentication routes
app.use('/api/auth', authRoutes);

// Privacy and compliance routes
app.use('/api/privacy', privacyRoutes);

// Upload routes
app.use('/api/upload', uploadRoutes);

// Document processing routes
app.use('/api/documents', documentRoutes);

// AI Analysis routes
app.use('/api/analysis', analysisRoutes);

// Question & Answer routes
app.use('/api/qa', qaRoutes);

// Document versioning and comparison routes
app.use('/api/document-versions', documentVersionRoutes);

// Template library routes
app.use('/api/templates', templateRoutes);

// Workspace routes
app.use('/api/workspaces', workspaceRoutes);

// Bulk processing routes
app.use('/api/bulk-processing', bulkProcessingRoutes);

// Monitoring and analytics routes
app.use('/api/monitoring', monitoringRoutes);

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  
  // Log security-related errors
  if (err.message.includes('CSRF') || err.message.includes('XSS') || err.message.includes('validation')) {
    AuditLoggerService.logFailedRequest(req, err.message, { stack: err.stack });
  }
  
  // Don't expose internal error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(500).json({ 
    error: 'Internal server error',
    message: isDevelopment ? err.message : 'Something went wrong!',
    ...(isDevelopment && { stack: err.stack })
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  // Start scheduled jobs for privacy compliance
  schedulerService.start();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  schedulerService.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  schedulerService.stop();
  process.exit(0);
});