import {
  createMigrationFile,
  validateMigrationFile,
  PostgresMigrationRunner,
} from '../migrations';

describe('Migration Utilities', () => {
  describe('createMigrationFile', () => {
    it('should create a properly formatted migration file', () => {
      const name = 'add user preferences';
      const description = 'Add user preferences table';
      const content = createMigrationFile(name, description);
      
      expect(content).toContain('-- Migration:');
      expect(content).toContain('-- Description: Add user preferences table');
      expect(content).toContain('-- Created:');
      expect(content).toContain('add_user_preferences');
    });

    it('should handle special characters in name', () => {
      const name = 'Add User & Admin Roles';
      const description = 'Create roles table';
      const content = createMigrationFile(name, description);
      
      expect(content).toContain('add_user_&_admin_roles');
    });
  });

  describe('validateMigrationFile', () => {
    it('should validate a correct migration file', () => {
      const validContent = `-- Migration: 001_initial_schema
-- Description: Create initial database schema
-- Created: 2024-01-01

CREATE TABLE users (
  id UUID PRIMARY KEY
);`;
      
      const result = validateMigrationFile(validContent);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject migration without required comments', () => {
      const invalidContent = `CREATE TABLE users (
  id UUID PRIMARY KEY
);`;
      
      const result = validateMigrationFile(invalidContent);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Migration file must include a "-- Migration:" comment');
      expect(result.errors).toContain('Migration file must include a "-- Description:" comment');
    });

    it('should detect dangerous operations', () => {
      const dangerousContent = `-- Migration: 002_dangerous
-- Description: Dangerous migration
-- Created: 2024-01-01

DROP TABLE users;
TRUNCATE documents;`;
      
      const result = validateMigrationFile(dangerousContent);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(error => error.includes('dangerous'))).toBe(true);
    });

    it('should allow safe operations', () => {
      const safeContent = `-- Migration: 003_safe_changes
-- Description: Safe schema changes
-- Created: 2024-01-01

ALTER TABLE users ADD COLUMN email VARCHAR(255);
CREATE INDEX idx_users_email ON users(email);
INSERT INTO settings (key, value) VALUES ('version', '1.0');`;
      
      const result = validateMigrationFile(safeContent);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('PostgresMigrationRunner', () => {
    let mockClient: any;
    let runner: PostgresMigrationRunner;

    beforeEach(() => {
      mockClient = {
        query: jest.fn(),
      };
      runner = new PostgresMigrationRunner(mockClient, __dirname + '/fixtures/migrations');
    });

    it('should ensure migrations table exists', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });
      
      await runner.getMigrationStatus();
      
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS schema_migrations')
      );
    });

    it('should get migration status correctly', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // ensureMigrationsTable
        .mockResolvedValueOnce({ 
          rows: [
            { migration_id: '001_test', applied_at: new Date() }
          ] 
        });

      const status = await runner.getMigrationStatus();
      
      expect(status).toHaveLength(2);
      expect(status[0].status).toBe('applied');
      expect(status[1].status).toBe('pending');
    });

    it('should run pending migrations', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // ensureMigrationsTable
        .mockResolvedValueOnce({ rows: [] }) // getMigrationStatus query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce(undefined) // migration SQL
        .mockResolvedValueOnce(undefined) // record migration
        .mockResolvedValueOnce(undefined) // COMMIT
        .mockResolvedValueOnce(undefined) // BEGIN (second migration)
        .mockResolvedValueOnce(undefined) // migration SQL (second migration)
        .mockResolvedValueOnce(undefined) // record migration (second migration)
        .mockResolvedValueOnce(undefined); // COMMIT (second migration)

      jest.spyOn(runner, 'getMigrationStatus').mockResolvedValue([
        {
          id: '001_test',
          name: '001_test',
          appliedAt: null,
          status: 'pending',
        },
        {
          id: '002_add_indexes',
          name: '002_add_indexes',
          appliedAt: null,
          status: 'pending',
        },
      ]);

      await runner.runMigrations();

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('should rollback on migration failure', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // ensureMigrationsTable
        .mockResolvedValueOnce({ rows: [] }) // getMigrationStatus query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockRejectedValueOnce(new Error('SQL error')) // migration SQL fails
        .mockResolvedValueOnce(undefined); // ROLLBACK

      jest.spyOn(runner, 'getMigrationStatus').mockResolvedValue([
        {
          id: '001_test',
          name: '001_test',
          appliedAt: null,
          status: 'pending',
        },
      ]);

      await expect(runner.runMigrations()).rejects.toThrow('SQL error');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });
});