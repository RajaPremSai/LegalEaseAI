import { Pool } from 'pg';
import { 
  Workspace, 
  WorkspaceMember, 
  WorkspaceInvitation, 
  CreateWorkspace, 
  UpdateWorkspace,
  InviteMember,
  WorkspaceActivity
} from '@legal-ai/shared';

export class WorkspaceRepository {
  constructor(private pool: Pool) {}

  async createWorkspace(ownerId: string, workspaceData: CreateWorkspace): Promise<Workspace> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Create workspace
      const workspaceResult = await client.query(`
        INSERT INTO workspaces (name, description, owner_id, plan, settings)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [
        workspaceData.name,
        workspaceData.description || '',
        ownerId,
        workspaceData.plan,
        JSON.stringify(workspaceData.settings || {})
      ]);

      const workspace = workspaceResult.rows[0];

      // Add owner as member
      await client.query(`
        INSERT INTO workspace_members (workspace_id, user_id, role, permissions, invited_by, joined_at, status)
        VALUES ($1, $2, 'owner', $3, $2, NOW(), 'active')
      `, [
        workspace.id,
        ownerId,
        JSON.stringify({
          canUploadDocuments: true,
          canViewAllDocuments: true,
          canShareDocuments: true,
          canDeleteDocuments: true,
          canInviteMembers: true,
          canManageWorkspace: true,
          canUseBulkProcessing: true,
          canExportData: true
        })
      ]);

      await client.query('COMMIT');
      return this.mapRowToWorkspace(workspace);

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async findWorkspaceById(id: string): Promise<Workspace | null> {
    const result = await this.pool.query(`
      SELECT * FROM workspaces WHERE id = $1 AND is_active = true
    `, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToWorkspace(result.rows[0]);
  }

  async findWorkspacesByUserId(userId: string): Promise<Workspace[]> {
    const result = await this.pool.query(`
      SELECT w.* FROM workspaces w
      JOIN workspace_members wm ON w.id = wm.workspace_id
      WHERE wm.user_id = $1 AND wm.status = 'active' AND w.is_active = true
      ORDER BY w.created_at DESC
    `, [userId]);

    return result.rows.map(row => this.mapRowToWorkspace(row));
  }

  async updateWorkspace(id: string, updateData: UpdateWorkspace): Promise<Workspace | null> {
    const setParts: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updateData.name !== undefined) {
      setParts.push(`name = $${paramIndex}`);
      values.push(updateData.name);
      paramIndex++;
    }

    if (updateData.description !== undefined) {
      setParts.push(`description = $${paramIndex}`);
      values.push(updateData.description);
      paramIndex++;
    }

    if (updateData.settings !== undefined) {
      setParts.push(`settings = $${paramIndex}`);
      values.push(JSON.stringify(updateData.settings));
      paramIndex++;
    }

    if (setParts.length === 0) {
      return this.findWorkspaceById(id);
    }

    values.push(id);
    const result = await this.pool.query(`
      UPDATE workspaces 
      SET ${setParts.join(', ')}, updated_at = NOW()
      WHERE id = $${paramIndex} AND is_active = true
      RETURNING *
    `, values);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToWorkspace(result.rows[0]);
  }

  async deleteWorkspace(id: string): Promise<boolean> {
    const result = await this.pool.query(`
      UPDATE workspaces SET is_active = false WHERE id = $1
    `, [id]);

    return result.rowCount > 0;
  }

  async getWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
    const result = await this.pool.query(`
      SELECT wm.*, u.email, u.profile->>'name' as user_name
      FROM workspace_members wm
      JOIN users u ON wm.user_id = u.id
      WHERE wm.workspace_id = $1
      ORDER BY wm.role, wm.joined_at
    `, [workspaceId]);

    return result.rows.map(row => ({
      id: row.id,
      workspaceId: row.workspace_id,
      userId: row.user_id,
      role: row.role,
      permissions: row.permissions,
      invitedBy: row.invited_by,
      invitedAt: row.invited_at,
      joinedAt: row.joined_at,
      status: row.status,
      // Additional fields for UI
      email: row.email,
      userName: row.user_name
    }));
  }

  async addWorkspaceMember(workspaceId: string, userId: string, role: string, permissions: any, invitedBy: string): Promise<WorkspaceMember> {
    const result = await this.pool.query(`
      INSERT INTO workspace_members (workspace_id, user_id, role, permissions, invited_by, joined_at, status)
      VALUES ($1, $2, $3, $4, $5, NOW(), 'active')
      RETURNING *
    `, [workspaceId, userId, role, JSON.stringify(permissions), invitedBy]);

    return this.mapRowToWorkspaceMember(result.rows[0]);
  }

  async updateWorkspaceMember(workspaceId: string, userId: string, updates: Partial<WorkspaceMember>): Promise<WorkspaceMember | null> {
    const setParts: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.role !== undefined) {
      setParts.push(`role = $${paramIndex}`);
      values.push(updates.role);
      paramIndex++;
    }

    if (updates.permissions !== undefined) {
      setParts.push(`permissions = $${paramIndex}`);
      values.push(JSON.stringify(updates.permissions));
      paramIndex++;
    }

    if (updates.status !== undefined) {
      setParts.push(`status = $${paramIndex}`);
      values.push(updates.status);
      paramIndex++;
    }

    if (setParts.length === 0) {
      return null;
    }

    values.push(workspaceId, userId);
    const result = await this.pool.query(`
      UPDATE workspace_members 
      SET ${setParts.join(', ')}
      WHERE workspace_id = $${paramIndex} AND user_id = $${paramIndex + 1}
      RETURNING *
    `, values);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToWorkspaceMember(result.rows[0]);
  }

  async removeWorkspaceMember(workspaceId: string, userId: string): Promise<boolean> {
    const result = await this.pool.query(`
      DELETE FROM workspace_members 
      WHERE workspace_id = $1 AND user_id = $2 AND role != 'owner'
    `, [workspaceId, userId]);

    return result.rowCount > 0;
  }

  async createInvitation(workspaceId: string, invitationData: InviteMember, invitedBy: string, token: string): Promise<WorkspaceInvitation> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    const result = await this.pool.query(`
      INSERT INTO workspace_invitations (workspace_id, email, role, permissions, invited_by, expires_at, token)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      workspaceId,
      invitationData.email,
      invitationData.role,
      JSON.stringify(invitationData.permissions || {}),
      invitedBy,
      expiresAt,
      token
    ]);

    return this.mapRowToWorkspaceInvitation(result.rows[0]);
  }

  async findInvitationByToken(token: string): Promise<WorkspaceInvitation | null> {
    const result = await this.pool.query(`
      SELECT * FROM workspace_invitations 
      WHERE token = $1 AND status = 'pending' AND expires_at > NOW()
    `, [token]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToWorkspaceInvitation(result.rows[0]);
  }

  async acceptInvitation(token: string, userId: string): Promise<WorkspaceMember | null> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Get invitation
      const invitationResult = await client.query(`
        SELECT * FROM workspace_invitations 
        WHERE token = $1 AND status = 'pending' AND expires_at > NOW()
      `, [token]);

      if (invitationResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }

      const invitation = invitationResult.rows[0];

      // Add member
      const memberResult = await client.query(`
        INSERT INTO workspace_members (workspace_id, user_id, role, permissions, invited_by, joined_at, status)
        VALUES ($1, $2, $3, $4, $5, NOW(), 'active')
        RETURNING *
      `, [
        invitation.workspace_id,
        userId,
        invitation.role,
        invitation.permissions,
        invitation.invited_by
      ]);

      // Update invitation status
      await client.query(`
        UPDATE workspace_invitations SET status = 'accepted' WHERE id = $1
      `, [invitation.id]);

      await client.query('COMMIT');
      return this.mapRowToWorkspaceMember(memberResult.rows[0]);

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async logActivity(activity: Omit<WorkspaceActivity, 'id' | 'timestamp'>): Promise<void> {
    await this.pool.query(`
      INSERT INTO workspace_activities (workspace_id, user_id, action, details, ip_address, user_agent)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      activity.workspaceId,
      activity.userId,
      activity.action,
      JSON.stringify(activity.details),
      activity.ipAddress,
      activity.userAgent
    ]);
  }

  async getWorkspaceActivities(workspaceId: string, limit: number = 50, offset: number = 0): Promise<WorkspaceActivity[]> {
    const result = await this.pool.query(`
      SELECT wa.*, u.profile->>'name' as user_name
      FROM workspace_activities wa
      JOIN users u ON wa.user_id = u.id
      WHERE wa.workspace_id = $1
      ORDER BY wa.timestamp DESC
      LIMIT $2 OFFSET $3
    `, [workspaceId, limit, offset]);

    return result.rows.map(row => ({
      id: row.id,
      workspaceId: row.workspace_id,
      userId: row.user_id,
      action: row.action,
      details: row.details,
      timestamp: row.timestamp,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      // Additional field for UI
      userName: row.user_name
    }));
  }

  private mapRowToWorkspace(row: any): Workspace {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      ownerId: row.owner_id,
      plan: row.plan,
      settings: row.settings,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      isActive: row.is_active,
      memberCount: row.member_count,
      documentCount: row.document_count,
      storageUsed: row.storage_used,
      storageLimit: row.storage_limit
    };
  }

  private mapRowToWorkspaceMember(row: any): WorkspaceMember {
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      userId: row.user_id,
      role: row.role,
      permissions: row.permissions,
      invitedBy: row.invited_by,
      invitedAt: row.invited_at,
      joinedAt: row.joined_at,
      status: row.status
    };
  }

  private mapRowToWorkspaceInvitation(row: any): WorkspaceInvitation {
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      email: row.email,
      role: row.role,
      permissions: row.permissions,
      invitedBy: row.invited_by,
      invitedAt: row.invited_at,
      expiresAt: row.expires_at,
      status: row.status,
      token: row.token
    };
  }
}