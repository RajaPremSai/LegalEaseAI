import { z } from 'zod';

// Base validation schemas

export const TextLocationSchema = z.object({
  startIndex: z.number().min(0),
  endIndex: z.number().min(0),
  pageNumber: z.number().min(1).optional(),
});

export const DocumentMetadataSchema = z.object({
  pageCount: z.number().min(1),
  wordCount: z.number().min(0),
  language: z.string().min(2).max(10),
  extractedText: z.string(),
});

export const KeyTermSchema = z.object({
  term: z.string().min(1).max(200),
  definition: z.string().min(1).max(1000),
  importance: z.enum(['high', 'medium', 'low']),
  location: TextLocationSchema,
});

export const RiskSchema = z.object({
  category: z.enum(['financial', 'legal', 'privacy', 'operational']),
  severity: z.enum(['high', 'medium', 'low']),
  description: z.string().min(1).max(500),
  affectedClause: z.string().min(1).max(200),
  recommendation: z.string().min(1).max(500),
});

export const ClauseSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  location: TextLocationSchema,
  riskLevel: z.enum(['low', 'medium', 'high']),
  explanation: z.string().min(1).max(1000),
});

export const DocumentAnalysisSchema = z.object({
  summary: z.string().min(1).max(2000),
  riskScore: z.enum(['low', 'medium', 'high']),
  keyTerms: z.array(KeyTermSchema),
  risks: z.array(RiskSchema),
  recommendations: z.array(z.string().min(1).max(500)),
  clauses: z.array(ClauseSchema),
  generatedAt: z.date(),
});

export const DocumentSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  filename: z.string().min(1).max(255),
  documentType: z.enum(['contract', 'lease', 'terms_of_service', 'privacy_policy', 'loan_agreement', 'other']),
  jurisdiction: z.string().min(2).max(10),
  uploadedAt: z.date(),
  expiresAt: z.date(),
  status: z.enum(['processing', 'analyzed', 'error']),
  metadata: DocumentMetadataSchema,
  analysis: DocumentAnalysisSchema.optional(),
});

export const UserPreferencesSchema = z.object({
  language: z.string().min(2).max(10).default('en'),
  notifications: z.boolean().default(true),
  autoDelete: z.boolean().default(true),
});

export const UserProfileSchema = z.object({
  name: z.string().min(1).max(100),
  userType: z.enum(['individual', 'small_business', 'enterprise']),
  jurisdiction: z.string().min(2).max(10),
  preferences: UserPreferencesSchema,
});

export const UserSubscriptionSchema = z.object({
  plan: z.enum(['free', 'premium', 'enterprise']),
  documentsRemaining: z.number().min(0),
  renewsAt: z.date(),
});

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  profile: UserProfileSchema,
  subscription: UserSubscriptionSchema,
  createdAt: z.date(),
});

// API request/response schemas

export const DocumentUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  fileSize: z.number().max(50 * 1024 * 1024), // 50MB max
  mimeType: z.enum(['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']),
  jurisdiction: z.string().min(2).max(10).optional(),
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

export const UserUpdateSchema = z.object({
  profile: UserProfileSchema.partial().optional(),
  subscription: UserSubscriptionSchema.partial().optional(),
});

// Inferred types
export type TextLocation = z.infer<typeof TextLocationSchema>;
export type DocumentMetadata = z.infer<typeof DocumentMetadataSchema>;
export type KeyTerm = z.infer<typeof KeyTermSchema>;
export type Risk = z.infer<typeof RiskSchema>;
export type Clause = z.infer<typeof ClauseSchema>;
export type DocumentAnalysis = z.infer<typeof DocumentAnalysisSchema>;
export type Document = z.infer<typeof DocumentSchema>;
export type UserPreferences = z.infer<typeof UserPreferencesSchema>;
export type UserProfile = z.infer<typeof UserProfileSchema>;
export type UserSubscription = z.infer<typeof UserSubscriptionSchema>;
export type User = z.infer<typeof UserSchema>;
export type DocumentUpload = z.infer<typeof DocumentUploadSchema>;
export type DocumentAnalysisRequest = z.infer<typeof DocumentAnalysisRequestSchema>;
export type Question = z.infer<typeof QuestionSchema>;
export type UserRegistration = z.infer<typeof UserRegistrationSchema>;
export type UserUpdate = z.infer<typeof UserUpdateSchema>;

// Document versioning and comparison schemas
export const DocumentVersionSchema = z.object({
  id: z.string().uuid(),
  documentId: z.string().uuid(),
  versionNumber: z.number().min(1),
  filename: z.string().min(1).max(255),
  uploadedAt: z.date(),
  metadata: DocumentMetadataSchema,
  analysis: DocumentAnalysisSchema.optional(),
  parentVersionId: z.string().uuid().optional(),
});

export const DocumentChangeSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['addition', 'deletion', 'modification']),
  originalText: z.string().optional(),
  newText: z.string().optional(),
  location: TextLocationSchema,
  affectedClause: z.string().optional(),
  severity: z.enum(['low', 'medium', 'high']),
  description: z.string().min(1).max(500),
});

export const SignificantChangeSchema = z.object({
  changeId: z.string().uuid(),
  category: z.enum(['rights', 'obligations', 'financial', 'legal', 'privacy']),
  impact: z.enum(['favorable', 'unfavorable', 'neutral']),
  description: z.string().min(1).max(500),
  recommendation: z.string().max(500).optional(),
});

export const ImpactAnalysisSchema = z.object({
  overallImpact: z.enum(['favorable', 'unfavorable', 'neutral']),
  riskScoreChange: z.number(),
  significantChanges: z.array(SignificantChangeSchema),
  summary: z.string().min(1).max(1000),
});

export const DocumentComparisonSchema = z.object({
  id: z.string().uuid(),
  originalVersionId: z.string().uuid(),
  comparedVersionId: z.string().uuid(),
  comparedAt: z.date(),
  changes: z.array(DocumentChangeSchema),
  impactAnalysis: ImpactAnalysisSchema,
});

// API request schemas for comparison
export const DocumentComparisonRequestSchema = z.object({
  originalVersionId: z.string().uuid(),
  comparedVersionId: z.string().uuid(),
});

// Inferred types for versioning and comparison
export type DocumentVersion = z.infer<typeof DocumentVersionSchema>;
export type DocumentChange = z.infer<typeof DocumentChangeSchema>;
export type SignificantChange = z.infer<typeof SignificantChangeSchema>;
export type ImpactAnalysis = z.infer<typeof ImpactAnalysisSchema>;
export type DocumentComparison = z.infer<typeof DocumentComparisonSchema>;
export type DocumentComparisonRequest = z.infer<typeof DocumentComparisonRequestSchema>;