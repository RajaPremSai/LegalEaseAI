// Shared TypeScript types

export interface Document {
  id: string;
  userId: string;
  filename: string;
  documentType: 'contract' | 'lease' | 'terms_of_service' | 'privacy_policy' | 'loan_agreement' | 'other';
  jurisdiction: string;
  uploadedAt: Date;
  expiresAt: Date;
  status: 'processing' | 'analyzed' | 'error';
  metadata: DocumentMetadata;
  analysis?: DocumentAnalysis;
}

export interface DocumentMetadata {
  pageCount: number;
  wordCount: number;
  language: string;
  extractedText: string;
}

export interface DocumentAnalysis {
  summary: string;
  riskScore: 'low' | 'medium' | 'high';
  keyTerms: KeyTerm[];
  risks: Risk[];
  recommendations: string[];
  clauses: Clause[];
  generatedAt: Date;
}

export interface KeyTerm {
  term: string;
  definition: string;
  importance: 'high' | 'medium' | 'low';
  location: TextLocation;
}

export interface Risk {
  category: 'financial' | 'legal' | 'privacy' | 'operational';
  severity: 'high' | 'medium' | 'low';
  description: string;
  affectedClause: string;
  recommendation: string;
}

export interface Clause {
  id: string;
  title: string;
  content: string;
  location: TextLocation;
  riskLevel: 'low' | 'medium' | 'high';
  explanation: string;
}

export interface TextLocation {
  startIndex: number;
  endIndex: number;
  pageNumber?: number;
}

export interface User {
  id: string;
  email: string;
  profile: UserProfile;
  subscription: UserSubscription;
  createdAt: Date;
}

export interface UserProfile {
  name: string;
  userType: 'individual' | 'small_business' | 'enterprise';
  jurisdiction: string;
  preferences: UserPreferences;
}

export interface UserPreferences {
  language: string;
  notifications: boolean;
  autoDelete: boolean;
}

export interface UserSubscription {
  plan: 'free' | 'premium' | 'enterprise';
  documentsRemaining: number;
  renewsAt: Date;
}

// Document versioning and comparison types
export interface DocumentVersion {
  id: string;
  documentId: string;
  versionNumber: number;
  filename: string;
  uploadedAt: Date;
  metadata: DocumentMetadata;
  analysis?: DocumentAnalysis;
  parentVersionId?: string;
}

export interface DocumentComparison {
  id: string;
  originalVersionId: string;
  comparedVersionId: string;
  comparedAt: Date;
  changes: DocumentChange[];
  impactAnalysis: ImpactAnalysis;
}

export interface DocumentChange {
  id: string;
  type: 'addition' | 'deletion' | 'modification';
  originalText?: string;
  newText?: string;
  location: TextLocation;
  affectedClause?: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
}

export interface ImpactAnalysis {
  overallImpact: 'favorable' | 'unfavorable' | 'neutral';
  riskScoreChange: number; // Difference in risk scores
  significantChanges: SignificantChange[];
  summary: string;
}

export interface SignificantChange {
  changeId: string;
  category: 'rights' | 'obligations' | 'financial' | 'legal' | 'privacy';
  impact: 'favorable' | 'unfavorable' | 'neutral';
  description: string;
  recommendation?: string;
}

// Template library types
export interface DocumentTemplate {
  id: string;
  name: string;
  description: string;
  category: 'contract' | 'lease' | 'terms_of_service' | 'privacy_policy' | 'loan_agreement' | 'employment' | 'nda' | 'other';
  industry: string[];
  jurisdiction: string[];
  templateContent: string;
  annotations: TemplateAnnotation[];
  standardClauses: StandardClause[];
  customizationOptions: CustomizationOption[];
  version: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  usage: {
    downloadCount: number;
    rating: number;
    reviewCount: number;
  };
}

export interface TemplateAnnotation {
  id: string;
  location: TextLocation;
  type: 'explanation' | 'warning' | 'customization' | 'alternative';
  title: string;
  content: string;
  importance: 'high' | 'medium' | 'low';
}

export interface StandardClause {
  id: string;
  title: string;
  content: string;
  category: 'payment' | 'termination' | 'liability' | 'intellectual_property' | 'confidentiality' | 'dispute_resolution' | 'other';
  isRequired: boolean;
  alternatives: ClauseAlternative[];
  explanation: string;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface ClauseAlternative {
  id: string;
  title: string;
  content: string;
  description: string;
  favorability: 'favorable' | 'neutral' | 'unfavorable';
  useCase: string;
}

export interface CustomizationOption {
  id: string;
  fieldName: string;
  fieldType: 'text' | 'number' | 'date' | 'select' | 'multiselect' | 'boolean';
  label: string;
  description: string;
  required: boolean;
  defaultValue?: any;
  options?: string[]; // For select/multiselect types
  validation?: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    min?: number;
    max?: number;
  };
}

export interface TemplateComparison {
  templateId: string;
  userDocumentId: string;
  comparisonResult: {
    overallCompliance: number; // Percentage 0-100
    missingClauses: MissingClause[];
    deviations: TemplateDeviation[];
    recommendations: string[];
    riskAssessment: {
      increasedrisk: boolean;
      riskFactors: string[];
    };
  };
  generatedAt: Date;
}

export interface MissingClause {
  clauseId: string;
  title: string;
  importance: 'critical' | 'recommended' | 'optional';
  description: string;
  suggestedContent: string;
}

export interface TemplateDeviation {
  location: TextLocation;
  templateClause: string;
  userClause: string;
  deviationType: 'missing' | 'modified' | 'additional';
  severity: 'high' | 'medium' | 'low';
  explanation: string;
  recommendation: string;
}

// Business user and workspace types
export interface Workspace {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  plan: 'small_business' | 'enterprise';
  settings: WorkspaceSettings;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  memberCount: number;
  documentCount: number;
  storageUsed: number; // in bytes
  storageLimit: number; // in bytes
}

export interface WorkspaceSettings {
  allowDocumentSharing: boolean;
  requireApprovalForSharing: boolean;
  defaultDocumentRetention: number; // days
  allowBulkProcessing: boolean;
  maxBulkDocuments: number;
  allowExternalSharing: boolean;
  auditLogging: boolean;
}

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  permissions: WorkspacePermissions;
  invitedBy: string;
  invitedAt: Date;
  joinedAt?: Date;
  status: 'pending' | 'active' | 'suspended';
}

export interface WorkspacePermissions {
  canUploadDocuments: boolean;
  canViewAllDocuments: boolean;
  canShareDocuments: boolean;
  canDeleteDocuments: boolean;
  canInviteMembers: boolean;
  canManageWorkspace: boolean;
  canUseBulkProcessing: boolean;
  canExportData: boolean;
}

export interface DocumentShare {
  id: string;
  documentId: string;
  sharedBy: string;
  sharedWith: string[]; // user IDs or email addresses
  workspaceId?: string;
  shareType: 'internal' | 'external' | 'public';
  permissions: SharePermissions;
  expiresAt?: Date;
  createdAt: Date;
  accessCount: number;
  lastAccessedAt?: Date;
}

export interface SharePermissions {
  canView: boolean;
  canComment: boolean;
  canDownload: boolean;
  canShare: boolean;
}

export interface BulkProcessingJob {
  id: string;
  workspaceId: string;
  userId: string;
  name: string;
  description?: string;
  documents: BulkDocument[];
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: {
    total: number;
    processed: number;
    successful: number;
    failed: number;
  };
  settings: BulkProcessingSettings;
  results?: BulkProcessingResults;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

export interface BulkDocument {
  id: string;
  filename: string;
  size: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  documentId?: string; // Set after upload
  error?: string;
}

export interface BulkProcessingSettings {
  analysisType: 'full' | 'summary' | 'risk_only';
  templateComparison?: {
    enabled: boolean;
    templateId?: string;
  };
  outputFormat: 'individual' | 'consolidated' | 'both';
  notifyOnCompletion: boolean;
  retentionDays?: number;
}

export interface BulkProcessingResults {
  summary: {
    totalDocuments: number;
    successfullyProcessed: number;
    failed: number;
    averageRiskScore: number;
    highRiskDocuments: number;
  };
  documents: BulkDocumentResult[];
  consolidatedReport?: string;
}

export interface BulkDocumentResult {
  documentId: string;
  filename: string;
  status: 'success' | 'failed';
  analysis?: DocumentAnalysis;
  templateComparison?: TemplateComparison;
  error?: string;
  processingTime: number; // milliseconds
}

export interface WorkspaceInvitation {
  id: string;
  workspaceId: string;
  email: string;
  role: WorkspaceMember['role'];
  permissions: WorkspacePermissions;
  invitedBy: string;
  invitedAt: Date;
  expiresAt: Date;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  token: string;
}

export interface WorkspaceActivity {
  id: string;
  workspaceId: string;
  userId: string;
  action: 'document_uploaded' | 'document_shared' | 'member_invited' | 'member_joined' | 'bulk_job_started' | 'bulk_job_completed' | 'settings_changed';
  details: Record<string, any>;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
}