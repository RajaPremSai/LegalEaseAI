import { z } from 'zod';

// Zod validation schemas

export const DocumentUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  fileSize: z.number().max(50 * 1024 * 1024), // 50MB max
  mimeType: z.enum(['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']),
  jurisdiction: z.string().optional(),
});

export const DocumentAnalysisRequestSchema = z.object({
  documentId: z.string().uuid(),
  analysisType: z.enum(['full', 'summary', 'risk_only']).default('full'),
});

export const QuestionSchema = z.object({
  documentId: z.string().uuid(),
  question: z.string().min(1).max(1000),
  conversationId: z.string().uuid().optional(),
});

export const UserRegistrationSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  userType: z.enum(['individual', 'small_business', 'enterprise']).default('individual'),
  jurisdiction: z.string().min(2).max(10),
});

export type DocumentUpload = z.infer<typeof DocumentUploadSchema>;
export type DocumentAnalysisRequest = z.infer<typeof DocumentAnalysisRequestSchema>;
export type Question = z.infer<typeof QuestionSchema>;
export type UserRegistration = z.infer<typeof UserRegistrationSchema>;