-- Initialize database for Legal Document AI Assistant
-- This script sets up the database using the migration system

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create schema_migrations table for migration tracking
CREATE TABLE IF NOT EXISTS schema_migrations (
    migration_id VARCHAR(255) PRIMARY KEY,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Note: The actual schema is created through migrations in packages/shared/migrations/
-- Run the migration system to apply all schema changes:
-- 
-- Example usage:
-- const { PostgresMigrationRunner } = require('@legal-ai/shared');
-- const runner = new PostgresMigrationRunner(client);
-- await runner.runMigrations();

-- For development/testing, you can manually run the initial migration:
-- \i packages/shared/migrations/001_initial_schema.sql