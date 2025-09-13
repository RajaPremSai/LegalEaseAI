# Database Layer

This directory contains the database layer for the Legal Document AI Assistant backend.

## Structure

```
database/
├── connection.ts           # Database connection management
├── migrations/            # Database migration scripts
│   ├── 001_initial_schema.sql
│   └── migrate.ts         # Migration runner
├── repositories/          # Data access layer
│   ├── base.repository.ts # Base repository class
│   ├── user.repository.ts # User data operations
│   └── document.repository.ts # Document data operations
├── index.ts              # Exports
└── README.md             # This file
```

## Setup

### Environment Variables

Set the following environment variables:

```bash
# Database connection
DB_HOST=localhost
DB_PORT=5432
DB_NAME=legal_ai_dev
DB_USER=postgres
DB_PASSWORD=password

# Or use a connection string
DATABASE_URL=postgresql://user:password@localhost:5432/legal_ai_dev
```

### Running Migrations

```bash
# Run all pending migrations
npm run migrate

# Or run directly with ts-node
npx ts-node src/database/migrations/migrate.ts
```

## Usage

### Database Connection

```typescript
import { DatabaseConnection } from './database';

const db = DatabaseConnection.getInstance();
await db.testConnection();
```

### Repositories

```typescript
import { UserRepository, DocumentRepository } from './database';

const userRepo = new UserRepository();
const documentRepo = new DocumentRepository();

// Create a user
const user = await userRepo.create({
  email: 'user@example.com',
  profile: {
    name: 'John Doe',
    userType: 'individual',
    jurisdiction: 'US',
  },
});

// Create a document
const document = await documentRepo.create({
  userId: user.id,
  filename: 'contract.pdf',
  documentType: 'contract',
  jurisdiction: 'US',
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  metadata: {
    pageCount: 5,
    wordCount: 1000,
    language: 'en',
    extractedText: 'Document content...',
  },
});
```

## Database Schema

### Core Tables

- **users**: User accounts
- **user_profiles**: User profile information
- **user_subscriptions**: Subscription and usage data
- **documents**: Document metadata
- **document_metadata**: Document processing results
- **document_analysis**: AI analysis results

### Analysis Tables

- **key_terms**: Important terms found in documents
- **risks**: Risk assessments
- **clauses**: Document clauses with analysis
- **recommendations**: AI-generated recommendations
- **conversations**: Q&A conversations
- **conversation_messages**: Individual messages

### Indexes

The schema includes indexes on:
- User lookups (id, email)
- Document queries (user_id, status, expires_at)
- Analysis data (document_id foreign keys)
- Conversation data (document_id, user_id)

## Migration System

The migration system automatically tracks which migrations have been executed and runs only pending migrations. Each migration file should:

1. Be named with a numeric prefix (e.g., `001_initial_schema.sql`)
2. Contain idempotent SQL (use `IF NOT EXISTS` where appropriate)
3. Include proper error handling
4. Be thoroughly tested

## Testing

Run the database tests:

```bash
npm test -- database.test.ts
```

Note: Database tests require a running PostgreSQL instance with the test database configured.