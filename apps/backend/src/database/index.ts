// Database exports
export { DatabaseConnection, db } from './connection';
export { BaseRepository } from './repositories/base.repository';
export { UserRepository } from './repositories/user.repository';
export { DocumentRepository } from './repositories/document.repository';
export { MigrationRunner } from './migrations/migrate';

// Re-export types from shared package
export type {
  User,
  Document,
  DocumentAnalysis,
  DocumentMetadata,
  UserProfile,
  UserSubscription,
} from '@legal-ai/shared';