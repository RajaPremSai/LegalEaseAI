import { Router } from 'express';
import { 
  CreateWorkspaceSchema, 
  UpdateWorkspaceSchema, 
  InviteMemberSchema 
} from '@legal-ai/shared';
import { WorkspaceService } from '../services/workspaceService';
import { WorkspaceRepository } from '../database/repositories/workspaceRepository';
import { authenticateToken } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { pool } from '../database/connection';

const router = Router();

// Initialize services
const workspaceRepository = new WorkspaceRepository(pool);
const workspaceService = new WorkspaceService(workspaceRepository);

/**
 * POST /api/workspaces
 * Create a new workspace
 */
router.post('/',
  authenticateToken,
  validateRequest(CreateWorkspaceSchema),
  async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User authentication required'
        });
      }

      const workspace = await workspaceService.createWorkspace(userId, req.body);
      
      res.status(201).json({
        success: true,
        data: workspace
      });
    } catch (error) {
      console.error('Create workspace error:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create workspace'
      });
    }
  }
);

/**
 * GET /api/workspaces
 * Get user's workspaces
 */
router.get('/',
  authenticateToken,
  async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User authentication required'
        });
      }

      const workspaces = await workspaceService.getUserWorkspaces(userId);
      
      res.json({
        success: true,
        data: workspaces
      });
    } catch (error) {
      console.error('Get workspaces error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch workspaces'
      });
    }
  }
);

/**
 * GET /api/workspaces/:id
 * Get workspace by ID
 */
router.get('/:id',
  authenticateToken,
  async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User authentication required'
        });
      }

      const workspace = await workspaceService.getWorkspace(id, userId);
      
      if (!workspace) {
        return res.status(404).json({
          success: false,
          error: 'Workspace not found or access denied'
        });
      }

      res.json({
        success: true,
        data: workspace
      });
    } catch (error) {
      console.error('Get workspace error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch workspace'
      });
    }
  }
);

/**
 * PUT /api/workspaces/:id
 * Update workspace
 */
router.put('/:id',
  authenticateToken,
  validateRequest(UpdateWorkspaceSchema),
  async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User authentication required'
        });
      }

      const workspace = await workspaceService.updateWorkspace(id, userId, req.body);
      
      if (!workspace) {
        return res.status(404).json({
          success: false,
          error: 'Workspace not found'
        });
      }

      res.json({
        success: true,
        data: workspace
      });
    } catch (error) {
      console.error('Update workspace error:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update workspace'
      });
    }
  }
);

/**
 * DELETE /api/workspaces/:id
 * Delete workspace
 */
router.delete('/:id',
  authenticateToken,
  async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User authentication required'
        });
      }

      const success = await workspaceService.deleteWorkspace(id, userId);
      
      if (!success) {
        return res.status(404).json({
          success: false,
          error: 'Workspace not found'
        });
      }

      res.json({
        success: true,
        message: 'Workspace deleted successfully'
      });
    } catch (error) {
      console.error('Delete workspace error:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete workspace'
      });
    }
  }
);

/**
 * GET /api/workspaces/:id/members
 * Get workspace members
 */
router.get('/:id/members',
  authenticateToken,
  async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User authentication required'
        });
      }

      const members = await workspaceService.getWorkspaceMembers(id, userId);
      
      res.json({
        success: true,
        data: members
      });
    } catch (error) {
      console.error('Get workspace members error:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch workspace members'
      });
    }
  }
);

/**
 * POST /api/workspaces/:id/invite
 * Invite member to workspace
 */
router.post('/:id/invite',
  authenticateToken,
  validateRequest(InviteMemberSchema),
  async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User authentication required'
        });
      }

      const invitation = await workspaceService.inviteMember(id, userId, req.body);
      
      res.status(201).json({
        success: true,
        data: invitation
      });
    } catch (error) {
      console.error('Invite member error:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to invite member'
      });
    }
  }
);

/**
 * POST /api/workspaces/accept-invitation/:token
 * Accept workspace invitation
 */
router.post('/accept-invitation/:token',
  authenticateToken,
  async (req, res) => {
    try {
      const { token } = req.params;
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User authentication required'
        });
      }

      const member = await workspaceService.acceptInvitation(token, userId);
      
      if (!member) {
        return res.status(400).json({
          success: false,
          error: 'Invalid or expired invitation'
        });
      }

      res.json({
        success: true,
        data: member
      });
    } catch (error) {
      console.error('Accept invitation error:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to accept invitation'
      });
    }
  }
);

/**
 * PUT /api/workspaces/:id/members/:userId
 * Update member role and permissions
 */
router.put('/:id/members/:userId',
  authenticateToken,
  async (req, res) => {
    try {
      const { id, userId: targetUserId } = req.params;
      const { role, permissions } = req.body;
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User authentication required'
        });
      }

      const member = await workspaceService.updateMemberRole(id, targetUserId, userId, role, permissions);
      
      if (!member) {
        return res.status(404).json({
          success: false,
          error: 'Member not found'
        });
      }

      res.json({
        success: true,
        data: member
      });
    } catch (error) {
      console.error('Update member error:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update member'
      });
    }
  }
);

/**
 * DELETE /api/workspaces/:id/members/:userId
 * Remove member from workspace
 */
router.delete('/:id/members/:userId',
  authenticateToken,
  async (req, res) => {
    try {
      const { id, userId: targetUserId } = req.params;
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User authentication required'
        });
      }

      const success = await workspaceService.removeMember(id, targetUserId, userId);
      
      if (!success) {
        return res.status(404).json({
          success: false,
          error: 'Member not found'
        });
      }

      res.json({
        success: true,
        message: 'Member removed successfully'
      });
    } catch (error) {
      console.error('Remove member error:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to remove member'
      });
    }
  }
);

/**
 * GET /api/workspaces/:id/activities
 * Get workspace activity log
 */
router.get('/:id/activities',
  authenticateToken,
  async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User authentication required'
        });
      }

      const activities = await workspaceService.getWorkspaceActivities(id, userId, limit, offset);
      
      res.json({
        success: true,
        data: activities,
        pagination: {
          limit,
          offset,
          total: activities.length
        }
      });
    } catch (error) {
      console.error('Get workspace activities error:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch workspace activities'
      });
    }
  }
);

export default router;