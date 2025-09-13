// Database migration utilities

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

export interface Migration {
  id: string;
  name: string;
  description: string;
  sql: string;
  createdAt: Date;
}

export interface MigrationRunner {
  runMigrations(): Promise<void>;
  getMigrations(): Migration[];
  getMigrationStatus(): Promise<MigrationStatus[]>;
}

export interface MigrationStatus {
  id: string;
  name: string;
  appliedAt: Date | null;
  status: 'pending' | 'applied' | 'failed';
}

export class PostgresMigrationRunner implements MigrationRunner {
  private migrationsPath: string;
  private client: any; // PostgreSQL client

  constructor(client: any, migrationsPath?: string) {
    this.client = client;
    this.migrationsPath = migrationsPath || join(__dirname, '../migrations');
  }

  async runMigrations(): Promise<void> {
    // Ensure migrations table exists
    await this.ensureMigrationsTable();

    const migrations = this.getMigrations();
    const status = await this.getMigrationStatus();

    for (const migration of migrations) {
      const migrationStatus = status.find(s => s.id === migration.id);
      
      if (!migrationStatus || migrationStatus.status === 'pending') {
        console.log(`Running migration: ${migration.name}`);
        
        try {
          await this.client.query('BEGIN');
          await this.client.query(migration.sql);
          await this.recordMigration(migration);
          await this.client.query('COMMIT');
          
          console.log(`✓ Migration ${migration.name} completed successfully`);
        } catch (error) {
          await this.client.query('ROLLBACK');
          console.error(`✗ Migration ${migration.name} failed:`, error);
          throw error;
        }
      } else {
        console.log(`⏭ Migration ${migration.name} already applied`);
      }
    }
  }

  getMigrations(): Migration[] {
    const files = readdirSync(this.migrationsPath)
      .filter(file => file.endsWith('.sql'))
      .sort();

    return files.map(file => {
      const content = readFileSync(join(this.migrationsPath, file), 'utf-8');
      const lines = content.split('\n');
      
      // Parse migration metadata from comments
      const idMatch = lines.find(line => line.includes('Migration:'))?.match(/Migration:\s*(.+)/);
      const descMatch = lines.find(line => line.includes('Description:'))?.match(/Description:\s*(.+)/);
      const dateMatch = lines.find(line => line.includes('Created:'))?.match(/Created:\s*(.+)/);
      
      return {
        id: idMatch?.[1]?.trim() || file.replace('.sql', ''),
        name: file.replace('.sql', ''),
        description: descMatch?.[1]?.trim() || 'No description',
        sql: content,
        createdAt: dateMatch?.[1] ? new Date(dateMatch[1].trim()) : new Date(),
      };
    });
  }

  async getMigrationStatus(): Promise<MigrationStatus[]> {
    await this.ensureMigrationsTable();
    
    const migrations = this.getMigrations();
    const result = await this.client.query(
      'SELECT migration_id, applied_at FROM schema_migrations ORDER BY applied_at'
    );
    
    const appliedMigrations = new Map<string, Date>(
      result.rows.map((row: any) => [row.migration_id, row.applied_at])
    );

    return migrations.map(migration => ({
      id: migration.id,
      name: migration.name,
      appliedAt: appliedMigrations.get(migration.id) || null,
      status: appliedMigrations.has(migration.id) ? 'applied' as const : 'pending' as const,
    }));
  }

  private async ensureMigrationsTable(): Promise<void> {
    await this.client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        migration_id VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
  }

  private async recordMigration(migration: Migration): Promise<void> {
    await this.client.query(
      'INSERT INTO schema_migrations (migration_id) VALUES ($1)',
      [migration.id]
    );
  }
}

// Utility functions for migration management
export const createMigrationFile = (name: string, description: string): string => {
  const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const migrationId = `${timestamp}_${name.toLowerCase().replace(/\s+/g, '_')}`;
  
  return `-- Migration: ${migrationId}
-- Description: ${description}
-- Created: ${new Date().toISOString().split('T')[0]}

-- Add your SQL statements here
`;
};

export const validateMigrationFile = (content: string): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!content.includes('-- Migration:')) {
    errors.push('Migration file must include a "-- Migration:" comment');
  }
  
  if (!content.includes('-- Description:')) {
    errors.push('Migration file must include a "-- Description:" comment');
  }
  
  // Check for potentially dangerous operations
  const dangerousPatterns = [
    /DROP\s+TABLE/i,
    /DROP\s+DATABASE/i,
    /TRUNCATE/i,
    /DELETE\s+FROM.*WHERE/i,
  ];
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(content)) {
      errors.push(`Potentially dangerous operation detected: ${pattern.source}`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
};