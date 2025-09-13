# @legal-ai/shared

Shared TypeScript types, validation schemas, and utilities for the Legal Document AI Assistant.

## Features

- **TypeScript Interfaces**: Comprehensive type definitions for all data models
- **Zod Validation Schemas**: Runtime validation for API requests and data integrity
- **Database Migrations**: PostgreSQL migration system with rollback support
- **Utility Functions**: Common helper functions for file handling, validation, and formatting
- **Comprehensive Testing**: Full test coverage for all components

## Installation

```bash
npm install @legal-ai/shared
```

## Usage

### TypeScript Interfaces

```typescript
import { Document, User, DocumentAnalysis } from '@legal-ai/shared';

const document: Document = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  userId: '123e4567-e89b-12d3-a456-426614174001',
  filename: 'contract.pdf',
  documentType: 'contract',
  jurisdiction: 'US',
  uploadedAt: new Date(),
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  status: 'processing',
  metadata: {
    pageCount: 5,
    wordCount: 1000,
    language: 'en',
    extractedText: 'Document content...',
  },
};
```

### Validation Schemas

```typescript
import { DocumentSchema, UserRegistrationSchema } from '@legal-ai/shared';

// Validate document data
try {
  const validDocument = DocumentSchema.parse(documentData);
  console.log('Document is valid:', validDocument);
} catch (error) {
  console.error('Validation failed:', error.errors);
}

// Validate user registration
const registrationData = {
  email: 'user@example.com',
  name: 'John Doe',
  jurisdiction: 'US',
};

const validRegistration = UserRegistrationSchema.parse(registrationData);
// userType defaults to 'individual'
```

### Database Migrations

```typescript
import { PostgresMigrationRunner } from '@legal-ai/shared';
import { Client } from 'pg';

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

await client.connect();

const migrationRunner = new PostgresMigrationRunner(client);

// Run all pending migrations
await migrationRunner.runMigrations();

// Check migration status
const status = await migrationRunner.getMigrationStatus();
console.log('Migration status:', status);
```

### Utility Functions

```typescript
import {
  formatFileSize,
  generateId,
  isValidFileType,
  sanitizeFilename,
  validateJurisdiction,
} from '@legal-ai/shared';

// Format file sizes
console.log(formatFileSize(1048576)); // "1 MB"

// Generate UUIDs
const id = generateId(); // "123e4567-e89b-12d3-a456-426614174000"

// Validate file types
const isValid = isValidFileType('application/pdf'); // true

// Sanitize filenames
const clean = sanitizeFilename('My Contract (v2).pdf'); // "my_contract_(v2).pdf"

// Validate jurisdictions
const validJurisdiction = validateJurisdiction('US'); // true
```

## Data Models

### Document

Represents a legal document uploaded by a user.

```typescript
interface Document {
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
```

### User

Represents a user of the system.

```typescript
interface User {
  id: string;
  email: string;
  profile: UserProfile;
  subscription: UserSubscription;
  createdAt: Date;
}
```

### DocumentAnalysis

Contains AI-generated analysis of a legal document.

```typescript
interface DocumentAnalysis {
  summary: string;
  riskScore: 'low' | 'medium' | 'high';
  keyTerms: KeyTerm[];
  risks: Risk[];
  recommendations: string[];
  clauses: Clause[];
  generatedAt: Date;
}
```

## Database Schema

The package includes PostgreSQL migration scripts that create the following tables:

- `users` - User accounts
- `user_profiles` - User profile information
- `user_subscriptions` - Subscription details
- `documents` - Document metadata
- `document_metadata` - Extracted document content
- `document_analysis` - AI analysis results
- `conversations` - Q&A conversations
- `schema_migrations` - Migration tracking

### Running Migrations

1. Ensure PostgreSQL is running and accessible
2. Create a database for the application
3. Run the migration system:

```typescript
import { PostgresMigrationRunner } from '@legal-ai/shared';

const runner = new PostgresMigrationRunner(client);
await runner.runMigrations();
```

## Validation

All data models include comprehensive Zod validation schemas:

- **Type Safety**: Ensures data matches expected types
- **Format Validation**: Validates emails, UUIDs, file types, etc.
- **Business Rules**: Enforces constraints like file size limits
- **Default Values**: Applies sensible defaults where appropriate

### API Request Schemas

- `DocumentUploadSchema` - File upload validation
- `UserRegistrationSchema` - User registration
- `QuestionSchema` - Q&A questions
- `DocumentAnalysisRequestSchema` - Analysis requests

## Testing

Run the test suite:

```bash
npm test
```

The package includes comprehensive tests for:

- Schema validation with edge cases
- Utility function behavior
- Migration system functionality
- Data model consistency

## Development

### Building

```bash
npm run build
```

### Type Checking

```bash
npm run type-check
```

### Linting

```bash
npm run lint
```

## Requirements Covered

This implementation addresses the following requirements from the Legal Document AI Assistant specification:

- **1.1**: Document processing and analysis data models
- **3.3**: User authentication and profile management
- **5.1**: Document comparison and versioning support
- **7.1**: Multi-jurisdiction document type support

## License

MIT