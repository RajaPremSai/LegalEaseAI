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
import { schedulerService } from './services/scheduler';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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

// Question & Answer routes
app.use('/api/qa', qaRoutes);

// Document versioning and comparison routes
app.use('/api/document-versions', documentVersionRoutes);

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
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