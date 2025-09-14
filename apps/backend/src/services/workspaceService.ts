import { 
  Workspace, 
  WorkspaceMember, 
  WorkspaceInvitation, 
  CreateWorkspace, 
  UpdateWorkspace,
  InviteMember,
  WorkspaceActivity
} from '@legal-ai/shared';
import { WorkspaceRepository } from '../database/repositories/workspaceRepository';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

export class WorkspaceService {
  constructor(private workspaceRepository: WorkspaceRepository) {}

  async createWorkspace(ownerId: string, workspaceData: CreateWorkspace): Promise<Workspace> {
    // Set default settings
    const defaultSettings = {
      allowDocumentSharing: true,
      requireApprovalForSharing: false,
      defaultDocumentRetention: 30,
      allowBulkProcessing: true,
      maxBulkDocuments: workspaceData.plan === 'enterprise' ? 1000 : 50,
      allowExternalSharing: workspaceData.plan === 'enterprise',
      auditLogging: true
    };

    const workspace = await this.workspaceRepository.createWorkspace(ownerId, {
      ...workspaceData,
      settings: { ...defaultSettings, ...workspaceData.settings }
    });

    // Log activity
    await this.workspaceRepository.logActivity({
      workspaceId: workspace.id,
      userId: ownerId,
      action: 'settings_changed',
      details: { action: 'workspace_created', workspaceName: workspace.name }
    });

    return workspace;
  }

  async getWorkspace(id: string, userId: string): Promise<Workspace | null> {
    const workspace = await this.workspaceRepository.findWorkspaceById(id);
    if (!workspace) {
      return null;
    }

    // Check if user has access to this workspace
    const members = await this.workspaceRepository.getWorkspaceMembers(id);
    const userMember = members.find(member => member.userId === userId);
    
    if (!userMember || userMember.status !== 'active') {
      return null;
    }

    return workspace;
  }

  async getUserWorkspaces(userId: string): Promise<Workspace[]> {
    return this.workspaceRepository.findWorkspacesByUserId(userId);
  }

  async updateWorkspace(id: string, userId: string, updateData: UpdateWorkspace): Promise<Workspace | null> {
    // Check if user has permission to manage workspace
    const members = await this.workspaceRepository.getWorkspaceMembers(id);
    const userMember = members.find(member => member.userId === userId);
    
    if (!userMember || !userMember.permissions.canManageWorkspace) {
      throw new Error('Insufficient permissions to manage workspace');
    }

    const workspace = await this.workspaceRepository.updateWorkspace(id, updateData);
    
    if (workspace) {
      // Log activity
      await this.workspaceRepository.logActivity({
        workspaceId: id,
        userId,
        action: 'settings_changed',
        details: { action: 'workspace_updated', changes: updateData }
      });
    }

    return workspace;
  }

  async deleteWorkspace(id: string, userId: string): Promise<boolean> {
    // Check if user is owner
    const workspace = await this.workspaceRepository.findWorkspaceById(id);
    if (!workspace || workspace.ownerId !== userId) {
      throw new Error('Only workspace owner can delete workspace');
    }

    const success = await this.workspaceRepository.deleteWorkspace(id);
    
    if (success) {
      // Log activity
      await this.workspaceRepository.logActivity({
        workspaceId: id,
        userId,
        action: 'settings_changed',
        details: { action: 'workspace_deleted' }
      });
    }

    return success;
  }

  async getWorkspaceMembers(workspaceId: string, userId: string): Promise<WorkspaceMember[]> {
    // Check if user has access to workspace
    const members = await this.workspaceRepository.getWorkspaceMembers(workspaceId);
    const userMember = members.find(member => member.userId === userId);
    
    if (!userMember || userMember.status !== 'active') {
      throw new Error('Access denied to workspace');
    }

    return members;
  }

  async inviteMember(workspaceId: string, inviterId: string, invitationData: InviteMember): Promise<WorkspaceInvitation> {
    // Check if user has permission to invite members
    const members = await this.workspaceRepository.getWorkspaceMembers(workspaceId);
    const inviterMember = members.find(member => member.userId === inviterId);
    
    if (!inviterMember || !inviterMember.permissions.canInviteMembers) {
      throw new Error('Insufficient permissions to invite members');
    }

    // Check if user is already a member
    const existingMember = members.find(member => 
      (member as any).email === invitationData.email
    );
    
    if (existingMember) {
      throw new Error('User is already a member of this workspace');
    }

    // Generate invitation token
    const token = crypto.randomBytes(32).toString('hex');

    // Set default permissions based on role
    const defaultPermissions = this.getDefaultPermissions(invitationData.role);
    
    const invitation = await this.workspaceRepository.createInvitation(
      workspaceId,
      {
        ...invitationData,
        permissions: { ...defaultPermissions, ...invitationData.permissions }
      },
      inviterId,
      token
    );

    // Log activity
    await this.workspaceRepository.logActivity({
      workspaceId,
      userId: inviterId,
      action: 'member_invited',
      details: { 
        email: invitationData.email, 
        role: invitationData.role 
      }
    });

    // TODO: Send invitation email
    // await this.emailService.sendInvitation(invitation);

    return invitation;
  }

  async acceptInvitation(token: string, userId: string): Promise<WorkspaceMember | null> {
    const invitation = await this.workspaceRepository.findInvitationByToken(token);
    if (!invitation) {
      throw new Error('Invalid or expired invitation');
    }

    const member = await this.workspaceRepository.acceptInvitation(token, userId);
    
    if (member) {
      // Log activity
      await this.workspaceRepository.logActivity({
        workspaceId: invitation.workspaceId,
        userId,
        action: 'member_joined',
        details: { 
          email: invitation.email,
          role: invitation.role 
        }
      });
    }

    return member;
  }

  async updateMemberRole(workspaceId: string, targetUserId: string, updaterId: string, role: string, permissions?: any): Promise<WorkspaceMember | null> {
    // Check if updater has permission to manage members
    const members = await this.workspaceRepository.getWorkspaceMembers(workspaceId);
    const updaterMember = members.find(member => member.userId === updaterId);
    
    if (!updaterMember || (!updaterMember.permissions.canManageWorkspace && updaterMember.role !== 'owner')) {
      throw new Error('Insufficient permissions to update member role');
    }

    // Cannot change owner role
    const targetMember = members.find(member => member.userId === targetUserId);
    if (targetMember?.role === 'owner') {
      throw new Error('Cannot change owner role');
    }

    const updatedPermissions = permissions || this.getDefaultPermissions(role);
    
    const member = await this.workspaceRepository.updateWorkspaceMember(
      workspaceId, 
      targetUserId, 
      { role, permissions: updatedPermissions }
    );

    if (member) {
      // Log activity
      await this.workspaceRepository.logActivity({
        workspaceId,
        userId: updaterId,
        action: 'settings_changed',
        details: { 
          action: 'member_role_updated',
          targetUserId,
          newRole: role 
        }
      });
    }

    return member;
  }

  async removeMember(workspaceId: string, targetUserId: string, removerId: string): Promise<boolean> {
    // Check if remover has permission
    const members = await this.workspaceRepository.getWorkspaceMembers(workspaceId);
    const removerMember = members.find(member => member.userId === removerId);
    
    if (!removerMember || (!removerMember.permissions.canManageWorkspace && removerMember.role !== 'owner')) {
      throw new Error('Insufficient permissions to remove member');
    }

    // Cannot remove owner
    const targetMember = members.find(member => member.userId === targetUserId);
    if (targetMember?.role === 'owner') {
      throw new Error('Cannot remove workspace owner');
    }

    const success = await this.workspaceRepository.removeWorkspaceMember(workspaceId, targetUserId);
    
    if (success) {
      // Log activity
      await this.workspaceRepository.logActivity({
        workspaceId,
        userId: removerId,
        action: 'settings_changed',
        details: { 
          action: 'member_removed',
          targetUserId 
        }
      });
    }

    return success;
  }

  async getWorkspaceActivities(workspaceId: string, userId: string, limit: number = 50, offset: number = 0): Promise<WorkspaceActivity[]> {
    // Check if user has access to workspace
    const members = await this.workspaceRepository.getWorkspaceMembers(workspaceId);
    const userMember = members.find(member => member.userId === userId);
    
    if (!userMember || userMember.status !== 'active') {
      throw new Error('Access denied to workspace');
    }

    return this.workspaceRepository.getWorkspaceActivities(workspaceId, limit, offset);
  }

  private getDefaultPermissions(role: string): any {
    switch (role) {
      case 'admin':
        return {
          canUploadDocuments: true,
          canViewAllDocuments: true,
          canShareDocuments: true,
          canDeleteDocuments: true,
          canInviteMembers: true,
          canManageWorkspace: true,
          canUseBulkProcessing: true,
          canExportData: true
        };
      case 'member':
        return {
          canUploadDocuments: true,
          canViewAllDocuments: false,
          canShareDocuments: true,
          canDeleteDocuments: false,
          canInviteMembers: false,
          canManageWorkspace: false,
          canUseBulkProcessing: true,
          canExportData: false
        };
      case 'viewer':
        return {
          canUploadDocuments: false,
          canViewAllDocuments: false,
          canShareDocuments: false,
          canDeleteDocuments: false,
          canInviteMembers: false,
          canManageWorkspace: false,
          canUseBulkProcessing: false,
          canExportData: false
        };
      default:
        return {};
    }
  }
}