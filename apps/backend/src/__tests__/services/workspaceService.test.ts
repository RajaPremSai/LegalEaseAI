import { WorkspaceService } from '../../services/workspaceService';
import { WorkspaceRepository } from '../../database/repositories/workspaceRepository';
import { Workspace, CreateWorkspace, WorkspaceMember } from '@legal-ai/shared';

// Mock dependencies
jest.mock('../../database/repositories/workspaceRepository');

const mockWorkspaceRepository = new WorkspaceRepository({} as any) as jest.Mocked<WorkspaceRepository>;

describe('WorkspaceService', () => {
  let workspaceService: WorkspaceService;

  beforeEach(() => {
    jest.clearAllMocks();
    workspaceService = new WorkspaceService(mockWorkspaceRepository);
  });

  describe('createWorkspace', () => {
    it('should create workspace with default settings', async () => {
      const mockWorkspace: Workspace = {
        id: '1',
        name: 'Test Workspace',
        description: 'Test Description',
        ownerId: 'user1',
        plan: 'small_business',
        settings: {
          allowDocumentSharing: true,
          requireApprovalForSharing: false,
          defaultDocumentRetention: 30,
          allowBulkProcessing: true,
          maxBulkDocuments: 50,
          allowExternalSharing: false,
          auditLogging: true
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
        memberCount: 1,
        documentCount: 0,
        storageUsed: 0,
        storageLimit: 10737418240
      };

      mockWorkspaceRepository.createWorkspace.mockResolvedValue(mockWorkspace);
      mockWorkspaceRepository.logActivity.mockResolvedValue();

      const createData: CreateWorkspace = {
        name: 'Test Workspace',
        description: 'Test Description',
        plan: 'small_business'
      };

      const result = await workspaceService.createWorkspace('user1', createData);

      expect(result).toEqual(mockWorkspace);
      expect(mockWorkspaceRepository.createWorkspace).toHaveBeenCalledWith('user1', {
        ...createData,
        settings: expect.objectContaining({
          allowDocumentSharing: true,
          maxBulkDocuments: 50,
          allowExternalSharing: false
        })
      });
      expect(mockWorkspaceRepository.logActivity).toHaveBeenCalled();
    });

    it('should set enterprise settings for enterprise plan', async () => {
      const mockWorkspace: Workspace = {
        id: '1',
        name: 'Enterprise Workspace',
        description: '',
        ownerId: 'user1',
        plan: 'enterprise',
        settings: {
          allowDocumentSharing: true,
          requireApprovalForSharing: false,
          defaultDocumentRetention: 30,
          allowBulkProcessing: true,
          maxBulkDocuments: 1000,
          allowExternalSharing: true,
          auditLogging: true
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
        memberCount: 1,
        documentCount: 0,
        storageUsed: 0,
        storageLimit: 10737418240
      };

      mockWorkspaceRepository.createWorkspace.mockResolvedValue(mockWorkspace);
      mockWorkspaceRepository.logActivity.mockResolvedValue();

      const createData: CreateWorkspace = {
        name: 'Enterprise Workspace',
        plan: 'enterprise'
      };

      await workspaceService.createWorkspace('user1', createData);

      expect(mockWorkspaceRepository.createWorkspace).toHaveBeenCalledWith('user1', {
        ...createData,
        settings: expect.objectContaining({
          maxBulkDocuments: 1000,
          allowExternalSharing: true
        })
      });
    });
  });

  describe('getWorkspace', () => {
    it('should return workspace if user has access', async () => {
      const mockWorkspace: Workspace = {
        id: '1',
        name: 'Test Workspace',
        description: '',
        ownerId: 'user1',
        plan: 'small_business',
        settings: {} as any,
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
        memberCount: 1,
        documentCount: 0,
        storageUsed: 0,
        storageLimit: 10737418240
      };

      const mockMembers: WorkspaceMember[] = [
        {
          id: '1',
          workspaceId: '1',
          userId: 'user1',
          role: 'owner',
          permissions: {} as any,
          invitedBy: 'user1',
          invitedAt: new Date(),
          joinedAt: new Date(),
          status: 'active'
        }
      ];

      mockWorkspaceRepository.findWorkspaceById.mockResolvedValue(mockWorkspace);
      mockWorkspaceRepository.getWorkspaceMembers.mockResolvedValue(mockMembers);

      const result = await workspaceService.getWorkspace('1', 'user1');

      expect(result).toEqual(mockWorkspace);
      expect(mockWorkspaceRepository.findWorkspaceById).toHaveBeenCalledWith('1');
      expect(mockWorkspaceRepository.getWorkspaceMembers).toHaveBeenCalledWith('1');
    });

    it('should return null if user does not have access', async () => {
      const mockWorkspace: Workspace = {
        id: '1',
        name: 'Test Workspace',
        description: '',
        ownerId: 'user1',
        plan: 'small_business',
        settings: {} as any,
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
        memberCount: 1,
        documentCount: 0,
        storageUsed: 0,
        storageLimit: 10737418240
      };

      const mockMembers: WorkspaceMember[] = [
        {
          id: '1',
          workspaceId: '1',
          userId: 'user1',
          role: 'owner',
          permissions: {} as any,
          invitedBy: 'user1',
          invitedAt: new Date(),
          joinedAt: new Date(),
          status: 'active'
        }
      ];

      mockWorkspaceRepository.findWorkspaceById.mockResolvedValue(mockWorkspace);
      mockWorkspaceRepository.getWorkspaceMembers.mockResolvedValue(mockMembers);

      const result = await workspaceService.getWorkspace('1', 'user2');

      expect(result).toBeNull();
    });

    it('should return null if workspace not found', async () => {
      mockWorkspaceRepository.findWorkspaceById.mockResolvedValue(null);

      const result = await workspaceService.getWorkspace('nonexistent', 'user1');

      expect(result).toBeNull();
    });
  });

  describe('inviteMember', () => {
    it('should create invitation if user has permission', async () => {
      const mockMembers: WorkspaceMember[] = [
        {
          id: '1',
          workspaceId: '1',
          userId: 'user1',
          role: 'owner',
          permissions: {
            canInviteMembers: true
          } as any,
          invitedBy: 'user1',
          invitedAt: new Date(),
          joinedAt: new Date(),
          status: 'active'
        }
      ];

      const mockInvitation = {
        id: '1',
        workspaceId: '1',
        email: 'newuser@example.com',
        role: 'member' as const,
        permissions: {} as any,
        invitedBy: 'user1',
        invitedAt: new Date(),
        expiresAt: new Date(),
        status: 'pending' as const,
        token: 'token123'
      };

      mockWorkspaceRepository.getWorkspaceMembers.mockResolvedValue(mockMembers);
      mockWorkspaceRepository.createInvitation.mockResolvedValue(mockInvitation);
      mockWorkspaceRepository.logActivity.mockResolvedValue();

      const result = await workspaceService.inviteMember('1', 'user1', {
        email: 'newuser@example.com',
        role: 'member'
      });

      expect(result).toEqual(mockInvitation);
      expect(mockWorkspaceRepository.createInvitation).toHaveBeenCalled();
      expect(mockWorkspaceRepository.logActivity).toHaveBeenCalled();
    });

    it('should throw error if user lacks permission', async () => {
      const mockMembers: WorkspaceMember[] = [
        {
          id: '1',
          workspaceId: '1',
          userId: 'user1',
          role: 'member',
          permissions: {
            canInviteMembers: false
          } as any,
          invitedBy: 'user1',
          invitedAt: new Date(),
          joinedAt: new Date(),
          status: 'active'
        }
      ];

      mockWorkspaceRepository.getWorkspaceMembers.mockResolvedValue(mockMembers);

      await expect(workspaceService.inviteMember('1', 'user1', {
        email: 'newuser@example.com',
        role: 'member'
      })).rejects.toThrow('Insufficient permissions to invite members');
    });

    it('should throw error if user is already a member', async () => {
      const mockMembers: WorkspaceMember[] = [
        {
          id: '1',
          workspaceId: '1',
          userId: 'user1',
          role: 'owner',
          permissions: {
            canInviteMembers: true
          } as any,
          invitedBy: 'user1',
          invitedAt: new Date(),
          joinedAt: new Date(),
          status: 'active'
        },
        {
          id: '2',
          workspaceId: '1',
          userId: 'user2',
          role: 'member',
          permissions: {} as any,
          invitedBy: 'user1',
          invitedAt: new Date(),
          joinedAt: new Date(),
          status: 'active',
          // Additional field for checking existing membership
          email: 'existing@example.com'
        } as any
      ];

      mockWorkspaceRepository.getWorkspaceMembers.mockResolvedValue(mockMembers);

      await expect(workspaceService.inviteMember('1', 'user1', {
        email: 'existing@example.com',
        role: 'member'
      })).rejects.toThrow('User is already a member of this workspace');
    });
  });

  describe('removeMember', () => {
    it('should remove member if user has permission', async () => {
      const mockMembers: WorkspaceMember[] = [
        {
          id: '1',
          workspaceId: '1',
          userId: 'user1',
          role: 'owner',
          permissions: {
            canManageWorkspace: true
          } as any,
          invitedBy: 'user1',
          invitedAt: new Date(),
          joinedAt: new Date(),
          status: 'active'
        },
        {
          id: '2',
          workspaceId: '1',
          userId: 'user2',
          role: 'member',
          permissions: {} as any,
          invitedBy: 'user1',
          invitedAt: new Date(),
          joinedAt: new Date(),
          status: 'active'
        }
      ];

      mockWorkspaceRepository.getWorkspaceMembers.mockResolvedValue(mockMembers);
      mockWorkspaceRepository.removeWorkspaceMember.mockResolvedValue(true);
      mockWorkspaceRepository.logActivity.mockResolvedValue();

      const result = await workspaceService.removeMember('1', 'user2', 'user1');

      expect(result).toBe(true);
      expect(mockWorkspaceRepository.removeWorkspaceMember).toHaveBeenCalledWith('1', 'user2');
      expect(mockWorkspaceRepository.logActivity).toHaveBeenCalled();
    });

    it('should throw error when trying to remove owner', async () => {
      const mockMembers: WorkspaceMember[] = [
        {
          id: '1',
          workspaceId: '1',
          userId: 'user1',
          role: 'owner',
          permissions: {
            canManageWorkspace: true
          } as any,
          invitedBy: 'user1',
          invitedAt: new Date(),
          joinedAt: new Date(),
          status: 'active'
        }
      ];

      mockWorkspaceRepository.getWorkspaceMembers.mockResolvedValue(mockMembers);

      await expect(workspaceService.removeMember('1', 'user1', 'user1'))
        .rejects.toThrow('Cannot remove workspace owner');
    });

    it('should throw error if user lacks permission', async () => {
      const mockMembers: WorkspaceMember[] = [
        {
          id: '1',
          workspaceId: '1',
          userId: 'user1',
          role: 'member',
          permissions: {
            canManageWorkspace: false
          } as any,
          invitedBy: 'user1',
          invitedAt: new Date(),
          joinedAt: new Date(),
          status: 'active'
        }
      ];

      mockWorkspaceRepository.getWorkspaceMembers.mockResolvedValue(mockMembers);

      await expect(workspaceService.removeMember('1', 'user2', 'user1'))
        .rejects.toThrow('Insufficient permissions to remove member');
    });
  });
});