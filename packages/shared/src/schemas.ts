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

// Template library schemas
export const CustomizationOptionSchema = z.object({
  id: z.string().uuid(),
  fieldName: z.string().min(1).max(100),
  fieldType: z.enum(['text', 'number', 'date', 'select', 'multiselect', 'boolean']),
  label: z.string().min(1).max(200),
  description: z.string().min(1).max(500),
  required: z.boolean(),
  defaultValue: z.any().optional(),
  options: z.array(z.string()).optional(),
  validation: z.object({
    minLength: z.number().min(0).optional(),
    maxLength: z.number().min(1).optional(),
    pattern: z.string().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
  }).optional(),
});

export const TemplateAnnotationSchema = z.object({
  id: z.string().uuid(),
  location: TextLocationSchema,
  type: z.enum(['explanation', 'warning', 'customization', 'alternative']),
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(1000),
  importance: z.enum(['high', 'medium', 'low']),
});

export const ClauseAlternativeSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  description: z.string().min(1).max(500),
  favorability: z.enum(['favorable', 'neutral', 'unfavorable']),
  useCase: z.string().min(1).max(300),
});

export const StandardClauseSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  category: z.enum(['payment', 'termination', 'liability', 'intellectual_property', 'confidentiality', 'dispute_resolution', 'other']),
  isRequired: z.boolean(),
  alternatives: z.array(ClauseAlternativeSchema),
  explanation: z.string().min(1).max(1000),
  riskLevel: z.enum(['low', 'medium', 'high']),
});

export const DocumentTemplateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
  category: z.enum(['contract', 'lease', 'terms_of_service', 'privacy_policy', 'loan_agreement', 'employment', 'nda', 'other']),
  industry: z.array(z.string().min(1).max(100)),
  jurisdiction: z.array(z.string().min(2).max(10)),
  templateContent: z.string().min(1),
  annotations: z.array(TemplateAnnotationSchema),
  standardClauses: z.array(StandardClauseSchema),
  customizationOptions: z.array(CustomizationOptionSchema),
  version: z.string().min(1).max(20),
  createdAt: z.date(),
  updatedAt: z.date(),
  isActive: z.boolean(),
  usage: z.object({
    downloadCount: z.number().min(0),
    rating: z.number().min(0).max(5),
    reviewCount: z.number().min(0),
  }),
});

export const MissingClauseSchema = z.object({
  clauseId: z.string().uuid(),
  title: z.string().min(1).max(200),
  importance: z.enum(['critical', 'recommended', 'optional']),
  description: z.string().min(1).max(500),
  suggestedContent: z.string().min(1),
});

export const TemplateDeviationSchema = z.object({
  location: TextLocationSchema,
  templateClause: z.string().min(1),
  userClause: z.string().min(1),
  deviationType: z.enum(['missing', 'modified', 'additional']),
  severity: z.enum(['high', 'medium', 'low']),
  explanation: z.string().min(1).max(500),
  recommendation: z.string().min(1).max(500),
});

export const TemplateComparisonSchema = z.object({
  templateId: z.string().uuid(),
  userDocumentId: z.string().uuid(),
  comparisonResult: z.object({
    overallCompliance: z.number().min(0).max(100),
    missingClauses: z.array(MissingClauseSchema),
    deviations: z.array(TemplateDeviationSchema),
    recommendations: z.array(z.string().min(1).max(500)),
    riskAssessment: z.object({
      increasedrisk: z.boolean(),
      riskFactors: z.array(z.string().min(1).max(200)),
    }),
  }),
  generatedAt: z.date(),
});

// API request schemas for templates
export const TemplateSearchSchema = z.object({
  category: z.enum(['contract', 'lease', 'terms_of_service', 'privacy_policy', 'loan_agreement', 'employment', 'nda', 'other']).optional(),
  industry: z.string().min(1).max(100).optional(),
  jurisdiction: z.string().min(2).max(10).optional(),
  query: z.string().min(1).max(200).optional(),
  limit: z.number().min(1).max(50).default(20),
  offset: z.number().min(0).default(0),
});

export const TemplateCustomizationSchema = z.object({
  templateId: z.string().uuid(),
  customizations: z.record(z.string(), z.any()),
});

export const TemplateComparisonRequestSchema = z.object({
  templateId: z.string().uuid(),
  documentId: z.string().uuid(),
});

// Inferred types for templates
export type CustomizationOption = z.infer<typeof CustomizationOptionSchema>;
export type TemplateAnnotation = z.infer<typeof TemplateAnnotationSchema>;
export type ClauseAlternative = z.infer<typeof ClauseAlternativeSchema>;
export type StandardClause = z.infer<typeof StandardClauseSchema>;
export type DocumentTemplate = z.infer<typeof DocumentTemplateSchema>;
export type MissingClause = z.infer<typeof MissingClauseSchema>;
export type TemplateDeviation = z.infer<typeof TemplateDeviationSchema>;
export type TemplateComparison = z.infer<typeof TemplateComparisonSchema>;
export type TemplateSearch = z.infer<typeof TemplateSearchSchema>;
export type TemplateCustomization = z.infer<typeof TemplateCustomizationSchema>;
export type TemplateComparisonRequest = z.infer<typeof TemplateComparisonRequestSchema>;

// Business user and workspace schemas
export const WorkspaceSettingsSchema = z.object({
  allowDocumentSharing: z.boolean().default(true),
  requireApprovalForSharing: z.boolean().default(false),
  defaultDocumentRetention: z.number().min(1).max(365).default(30),
  allowBulkProcessing: z.boolean().default(true),
  maxBulkDocuments: z.number().min(1).max(1000).default(50),
  allowExternalSharing: z.boolean().default(false),
  auditLogging: z.boolean().default(true),
});

export const WorkspaceSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).default(''),
  ownerId: z.string().uuid(),
  plan: z.enum(['small_business', 'enterprise']),
  settings: WorkspaceSettingsSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
  isActive: z.boolean().default(true),
  memberCount: z.number().min(0),
  documentCount: z.number().min(0),
  storageUsed: z.number().min(0),
  storageLimit: z.number().min(0),
});

export const WorkspacePermissionsSchema = z.object({
  canUploadDocuments: z.boolean().default(true),
  canViewAllDocuments: z.boolean().default(false),
  canShareDocuments: z.boolean().default(true),
  canDeleteDocuments: z.boolean().default(false),
  canInviteMembers: z.boolean().default(false),
  canManageWorkspace: z.boolean().default(false),
  canUseBulkProcessing: z.boolean().default(false),
  canExportData: z.boolean().default(false),
});

export const WorkspaceMemberSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  userId: z.string().uuid(),
  role: z.enum(['owner', 'admin', 'member', 'viewer']),
  permissions: WorkspacePermissionsSchema,
  invitedBy: z.string().uuid(),
  invitedAt: z.date(),
  joinedAt: z.date().optional(),
  status: z.enum(['pending', 'active', 'suspended']),
});

export const SharePermissionsSchema = z.object({
  canView: z.boolean().default(true),
  canComment: z.boolean().default(false),
  canDownload: z.boolean().default(false),
  canShare: z.boolean().default(false),
});

export const DocumentShareSchema = z.object({
  id: z.string().uuid(),
  documentId: z.string().uuid(),
  sharedBy: z.string().uuid(),
  sharedWith: z.array(z.string()),
  workspaceId: z.string().uuid().optional(),
  shareType: z.enum(['internal', 'external', 'public']),
  permissions: SharePermissionsSchema,
  expiresAt: z.date().optional(),
  createdAt: z.date(),
  accessCount: z.number().min(0),
  lastAccessedAt: z.date().optional(),
});

export const BulkDocumentSchema = z.object({
  id: z.string().uuid(),
  filename: z.string().min(1).max(255),
  size: z.number().min(1),
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  documentId: z.string().uuid().optional(),
  error: z.string().optional(),
});

export const BulkProcessingSettingsSchema = z.object({
  analysisType: z.enum(['full', 'summary', 'risk_only']).default('full'),
  templateComparison: z.object({
    enabled: z.boolean(),
    templateId: z.string().uuid().optional(),
  }).optional(),
  outputFormat: z.enum(['individual', 'consolidated', 'both']).default('individual'),
  notifyOnCompletion: z.boolean().default(true),
  retentionDays: z.number().min(1).max(365).optional(),
});

export const BulkDocumentResultSchema = z.object({
  documentId: z.string().uuid(),
  filename: z.string(),
  status: z.enum(['success', 'failed']),
  analysis: DocumentAnalysisSchema.optional(),
  templateComparison: TemplateComparisonSchema.optional(),
  error: z.string().optional(),
  processingTime: z.number().min(0),
});

export const BulkProcessingResultsSchema = z.object({
  summary: z.object({
    totalDocuments: z.number().min(0),
    successfullyProcessed: z.number().min(0),
    failed: z.number().min(0),
    averageRiskScore: z.number().min(0).max(100),
    highRiskDocuments: z.number().min(0),
  }),
  documents: z.array(BulkDocumentResultSchema),
  consolidatedReport: z.string().optional(),
});

export const BulkProcessingJobSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  documents: z.array(BulkDocumentSchema),
  status: z.enum(['pending', 'processing', 'completed', 'failed', 'cancelled']),
  progress: z.object({
    total: z.number().min(0),
    processed: z.number().min(0),
    successful: z.number().min(0),
    failed: z.number().min(0),
  }),
  settings: BulkProcessingSettingsSchema,
  results: BulkProcessingResultsSchema.optional(),
  createdAt: z.date(),
  startedAt: z.date().optional(),
  completedAt: z.date().optional(),
  error: z.string().optional(),
});

export const WorkspaceInvitationSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(['owner', 'admin', 'member', 'viewer']),
  permissions: WorkspacePermissionsSchema,
  invitedBy: z.string().uuid(),
  invitedAt: z.date(),
  expiresAt: z.date(),
  status: z.enum(['pending', 'accepted', 'declined', 'expired']),
  token: z.string(),
});

export const WorkspaceActivitySchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  userId: z.string().uuid(),
  action: z.enum(['document_uploaded', 'document_shared', 'member_invited', 'member_joined', 'bulk_job_started', 'bulk_job_completed', 'settings_changed']),
  details: z.record(z.any()),
  timestamp: z.date(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
});

// API request schemas for business features
export const CreateWorkspaceSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  plan: z.enum(['small_business', 'enterprise']),
  settings: WorkspaceSettingsSchema.partial().optional(),
});

export const UpdateWorkspaceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  settings: WorkspaceSettingsSchema.partial().optional(),
});

export const InviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'member', 'viewer']),
  permissions: WorkspacePermissionsSchema.partial().optional(),
});

export const ShareDocumentSchema = z.object({
  documentId: z.string().uuid(),
  sharedWith: z.array(z.string().email()),
  shareType: z.enum(['internal', 'external']),
  permissions: SharePermissionsSchema.partial().optional(),
  expiresAt: z.date().optional(),
});

export const CreateBulkJobSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  settings: BulkProcessingSettingsSchema.partial().optional(),
});

// Inferred types for business features
export type WorkspaceSettings = z.infer<typeof WorkspaceSettingsSchema>;
export type Workspace = z.infer<typeof WorkspaceSchema>;
export type WorkspacePermissions = z.infer<typeof WorkspacePermissionsSchema>;
export type WorkspaceMember = z.infer<typeof WorkspaceMemberSchema>;
export type SharePermissions = z.infer<typeof SharePermissionsSchema>;
export type DocumentShare = z.infer<typeof DocumentShareSchema>;
export type BulkDocument = z.infer<typeof BulkDocumentSchema>;
export type BulkProcessingSettings = z.infer<typeof BulkProcessingSettingsSchema>;
export type BulkDocumentResult = z.infer<typeof BulkDocumentResultSchema>;
export type BulkProcessingResults = z.infer<typeof BulkProcessingResultsSchema>;
export type BulkProcessingJob = z.infer<typeof BulkProcessingJobSchema>;
export type WorkspaceInvitation = z.infer<typeof WorkspaceInvitationSchema>;
export type WorkspaceActivity = z.infer<typeof WorkspaceActivitySchema>;
export type CreateWorkspace = z.infer<typeof CreateWorkspaceSchema>;
export type UpdateWorkspace = z.infer<typeof UpdateWorkspaceSchema>;
export type InviteMember = z.infer<typeof InviteMemberSchema>;
export type ShareDocument = z.infer<typeof ShareDocumentSchema>;
export type CreateBulkJob = z.infer<typeof CreateBulkJobSchema>;