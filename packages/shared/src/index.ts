// Shared types and utilities for the Legal Document AI Assistant

// Export types (interfaces)
export * from './types';

// Export schemas and their inferred types with different names to avoid conflicts
export {
  TextLocationSchema,
  DocumentMetadataSchema,
  KeyTermSchema,
  RiskSchema,
  ClauseSchema,
  DocumentAnalysisSchema,
  DocumentSchema,
  UserPreferencesSchema,
  UserProfileSchema,
  UserSubscriptionSchema,
  UserSchema,
  DocumentUploadSchema,
  DocumentAnalysisRequestSchema,
  QuestionSchema,
  UserRegistrationSchema,
  UserUpdateSchema,
} from './schemas';

// Export inferred types with Schema suffix to avoid conflicts
export type {
  TextLocation as TextLocationSchemaType,
  DocumentMetadata as DocumentMetadataSchemaType,
  KeyTerm as KeyTermSchemaType,
  Risk as RiskSchemaType,
  Clause as ClauseSchemaType,
  DocumentAnalysis as DocumentAnalysisSchemaType,
  Document as DocumentSchemaType,
  UserPreferences as UserPreferencesSchemaType,
  UserProfile as UserProfileSchemaType,
  UserSubscription as UserSubscriptionSchemaType,
  User as UserSchemaType,
  DocumentUpload,
  DocumentAnalysisRequest,
  Question,
  UserRegistration,
  UserUpdate,
} from './schemas';

export * from './utils';
export * from './migrations';