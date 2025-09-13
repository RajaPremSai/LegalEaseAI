import { Pool } from 'pg';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

interface Migration {
  id: number;
  filename: string;
  sql: string;
}

export class MigrationRunner {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async createMigrationsTable(): Promise<void> {
    const sql = `
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;
    await this.pool.query(sql);
  }

  async getExecutedMigrations(): Promise<number[]> {
    const result = await this.pool.query('SELECT id FROM migrations ORDER BY id');
    return result.rows.map(row => row.id);
  }

  async loadMigrations(): Promise<Migration[]> {
    const migrationsDir = __dirname;
    const files = readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    return files.map(filename => {
      const match = filename.match(/^(\d+)_/);
      if (!match) {
        throw new Error(`Invalid migration filename: ${filename}`);
      }

      const id = parseInt(match[1], 10);
      const sql = readFileSync(join(migrationsDir, filename), 'utf-8');

      return { id, filename, sql };
    });
  }

  async executeMigration(migration: Migration): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Execute the migration SQL
      await client.query(migration.sql);
      
      // Record the migration as executed
      await client.query(
        'INSERT INTO migrations (id, filename) VALUES ($1, $2)',
        [migration.id, migration.filename]
      );
      
      await client.query('COMMIT');
      console.log(`✓ Executed migration ${migration.filename}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async runMigrations(): Promise<void> {
    await this.createMigrationsTable();
    
    const executedMigrations = await this.getExecutedMigrations();
    const allMigrations = await this.loadMigrations();
    
    const pendingMigrations = allMigrations.filter(
      migration => !executedMigrations.includes(migration.id)
    );

    if (pendingMigrations.length === 0) {
      console.log('No pending migrations');
      return;
    }

    console.log(`Running ${pendingMigrations.length} pending migrations...`);
    
    for (const migration of pendingMigrations) {
      await this.executeMigration(migration);
    }
    
    console.log('All migrations completed successfully');
  }
}

// CLI runner
if (require.main === module) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/legal_ai_dev',
  });

  const runner = new MigrationRunner(pool);
  
  runner.runMigrations()
    .then(() => {
      console.log('Migration process completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}