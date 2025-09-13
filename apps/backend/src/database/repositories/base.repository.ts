import { Pool, PoolClient } from 'pg';
import { DatabaseConnection } from '../connection';

export abstract class BaseRepository {
  protected db: DatabaseConnection;
  protected pool: Pool;

  constructor() {
    this.db = DatabaseConnection.getInstance();
    this.pool = this.db.getPool();
  }

  protected async query(text: string, params?: any[]): Promise<any> {
    return await this.db.query(text, params);
  }

  protected async getClient(): Promise<PoolClient> {
    return await this.db.getClient();
  }

  protected async transaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.getClient();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  protected buildWhereClause(conditions: Record<string, any>): { whereClause: string; values: any[] } {
    const keys = Object.keys(conditions).filter(key => conditions[key] !== undefined);
    
    if (keys.length === 0) {
      return { whereClause: '', values: [] };
    }

    const whereConditions = keys.map((key, index) => `${key} = $${index + 1}`);
    const values = keys.map(key => conditions[key]);

    return {
      whereClause: `WHERE ${whereConditions.join(' AND ')}`,
      values,
    };
  }

  protected buildUpdateClause(data: Record<string, any>, startIndex: number = 1): { setClause: string; values: any[] } {
    const keys = Object.keys(data).filter(key => data[key] !== undefined);
    
    if (keys.length === 0) {
      return { setClause: '', values: [] };
    }

    const setConditions = keys.map((key, index) => `${key} = $${startIndex + index}`);
    const values = keys.map(key => data[key]);

    return {
      setClause: `SET ${setConditions.join(', ')}, updated_at = NOW()`,
      values,
    };
  }
}