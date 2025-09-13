import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables
dotenv.config();

// Environment validation schema
const envSchema = z.object({
  // Server configuration
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3001'),
  
  // Google Cloud configuration
  GOOGLE_CLOUD_PROJECT_ID: z.string().min(1, 'Google Cloud Project ID is required'),
  GOOGLE_CLOUD_LOCATION: z.string().default('us-central1'),
  GOOGLE_CLOUD_PROCESSOR_ID: z.string().min(1, 'Document AI Processor ID is required'),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
  
  // Storage configuration
  DOCUMENTS_BUCKET: z.string().min(1, 'Documents bucket name is required'),
  TEMP_BUCKET: z.string().min(1, 'Temp bucket name is required'),
  MAX_FILE_SIZE: z.string().transform(Number).default('52428800'), // 50MB
  DOCUMENT_RETENTION_HOURS: z.string().transform(Number).default('24'),
  
  // Authentication configuration
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('24h'),
  BCRYPT_ROUNDS: z.string().transform(Number).default('12'),
  
  // Database configuration
  DATABASE_URL: z.string().optional(),
  
  // Firestore collections
  USERS_COLLECTION: z.string().default('users'),
  DOCUMENTS_COLLECTION: z.string().default('documents'),
  ANALYSES_COLLECTION: z.string().default('analyses'),
  SESSIONS_COLLECTION: z.string().default('sessions'),
  
  // API configuration
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('900000'), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('100'),
  
  // Monitoring and logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  ENABLE_REQUEST_LOGGING: z.string().transform(Boolean).default('true'),
});

// Validate and parse environment variables
let env: z.infer<typeof envSchema>;

try {
  env = envSchema.parse(process.env);
} catch (error) {
  console.error('Environment validation failed:');
  if (error instanceof z.ZodError) {
    error.errors.forEach((err) => {
      console.error(`- ${err.path.join('.')}: ${err.message}`);
    });
  }
  process.exit(1);
}

// Export configuration objects
export const serverConfig = {
  nodeEnv: env.NODE_ENV,
  port: env.PORT,
  corsOrigin: env.CORS_ORIGIN,
  logLevel: env.LOG_LEVEL,
  enableRequestLogging: env.ENABLE_REQUEST_LOGGING,
};

export const googleCloudConfig = {
  projectId: env.GOOGLE_CLOUD_PROJECT_ID,
  location: env.GOOGLE_CLOUD_LOCATION,
  processorId: env.GOOGLE_CLOUD_PROCESSOR_ID,
  keyFilename: env.GOOGLE_APPLICATION_CREDENTIALS,
};

export const storageConfig = {
  documentsBucket: env.DOCUMENTS_BUCKET,
  tempBucket: env.TEMP_BUCKET,
  maxFileSize: env.MAX_FILE_SIZE,
  allowedMimeTypes: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
  ],
  documentRetentionHours: env.DOCUMENT_RETENTION_HOURS,
};

export const authConfig = {
  jwtSecret: env.JWT_SECRET,
  jwtExpiresIn: env.JWT_EXPIRES_IN,
  bcryptRounds: env.BCRYPT_ROUNDS,
};

export const firestoreConfig = {
  collections: {
    users: env.USERS_COLLECTION,
    documents: env.DOCUMENTS_COLLECTION,
    analyses: env.ANALYSES_COLLECTION,
    sessions: env.SESSIONS_COLLECTION,
  },
};

export const rateLimitConfig = {
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
};

// Utility function to check if running in production
export const isProduction = (): boolean => env.NODE_ENV === 'production';

// Utility function to check if running in development
export const isDevelopment = (): boolean => env.NODE_ENV === 'development';

// Utility function to check if running in test
export const isTest = (): boolean => env.NODE_ENV === 'test';

// Export the validated environment for direct access if needed
export { env };