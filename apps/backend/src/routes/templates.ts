import { Router } from 'express';
import { 
  TemplateSearchSchema, 
  TemplateCustomizationSchema, 
  TemplateComparisonRequestSchema 
} from '@legal-ai/shared';
import { TemplateService } from '../services/templateService';
import { TemplateRepository } from '../database/repositories/templateRepository';
import { DocumentRepository } from '../database/repositories/document.repository';
import { AIAnalysisService } from '../services/aiAnalysis';
import { authenticateToken } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { pool } from '../database/connection';

const router = Router();

// Initialize services
const templateRepository = new TemplateRepository(pool);
const documentRepository = new DocumentRepository(pool);
const aiAnalysisService = new AIAnalysisService();
const templateService = new TemplateService(templateRepository, documentRepository, aiAnalysisService);

/**
 * GET /api/templates/search
 * Search for document templates
 */
router.get('/search', async (req, res) => {
  try {
    const searchParams = TemplateSearchSchema.parse(req.query);
    const templates = await templateService.searchTemplates(searchParams);
    
    res.json({
      success: true,
      data: templates,
      pagination: {
        limit: searchParams.limit || 20,
        offset: searchParams.offset || 0,
        total: templates.length
      }
    });
  } catch (error) {
    console.error('Template search error:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Invalid search parameters'
    });
  }
});

/**
 * GET /api/templates/popular
 * Get popular templates
 */
router.get('/popular', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const templates = await templateService.getPopularTemplates(limit);
    
    res.json({
      success: true,
      data: templates
    });
  } catch (error) {
    console.error('Popular templates error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch popular templates'
    });
  }
});

/**
 * GET /api/templates/:id
 * Get template by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const template = await templateService.getTemplateById(id);
    
    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    res.json({
      success: true,
      data: template
    });
  } catch (error) {
    console.error('Get template error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch template'
    });
  }
});

/**
 * POST /api/templates/:id/customize
 * Customize a template with user values
 */
router.post('/:id/customize', 
  authenticateToken,
  validateRequest(TemplateCustomizationSchema),
  async (req, res) => {
    try {
      const { id } = req.params;
      const customization = { ...req.body, templateId: id };
      
      const customizedContent = await templateService.customizeTemplate(customization);
      
      res.json({
        success: true,
        data: {
          templateId: id,
          customizedContent
        }
      });
    } catch (error) {
      console.error('Template customization error:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Customization failed'
      });
    }
  }
);

/**
 * POST /api/templates/:id/compare
 * Compare user document with template
 */
router.post('/:id/compare',
  authenticateToken,
  validateRequest(TemplateComparisonRequestSchema),
  async (req, res) => {
    try {
      const { id: templateId } = req.params;
      const { documentId } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User authentication required'
        });
      }

      const comparison = await templateService.compareWithTemplate(templateId, documentId, userId);
      
      res.json({
        success: true,
        data: comparison
      });
    } catch (error) {
      console.error('Template comparison error:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Comparison failed'
      });
    }
  }
);

/**
 * POST /api/templates/:id/download
 * Download template (tracks usage)
 */
router.post('/:id/download',
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

      const template = await templateService.downloadTemplate(id, userId);
      
      res.json({
        success: true,
        data: template
      });
    } catch (error) {
      console.error('Template download error:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Download failed'
      });
    }
  }
);

/**
 * GET /api/templates/categories
 * Get available template categories
 */
router.get('/categories', async (req, res) => {
  try {
    const categories = [
      { value: 'contract', label: 'General Contracts', description: 'Standard business contracts and agreements' },
      { value: 'lease', label: 'Lease Agreements', description: 'Residential and commercial lease agreements' },
      { value: 'terms_of_service', label: 'Terms of Service', description: 'Website and application terms of service' },
      { value: 'privacy_policy', label: 'Privacy Policies', description: 'Data privacy and protection policies' },
      { value: 'loan_agreement', label: 'Loan Agreements', description: 'Personal and business loan contracts' },
      { value: 'employment', label: 'Employment Contracts', description: 'Employment agreements and contracts' },
      { value: 'nda', label: 'Non-Disclosure Agreements', description: 'Confidentiality and non-disclosure agreements' },
      { value: 'other', label: 'Other Documents', description: 'Miscellaneous legal documents' }
    ];

    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Categories error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch categories'
    });
  }
});

/**
 * GET /api/templates/industries
 * Get available industries
 */
router.get('/industries', async (req, res) => {
  try {
    const industries = [
      'Technology',
      'Healthcare',
      'Finance',
      'Real Estate',
      'Retail',
      'Manufacturing',
      'Education',
      'Legal Services',
      'Consulting',
      'Non-Profit',
      'Government',
      'Other'
    ];

    res.json({
      success: true,
      data: industries
    });
  } catch (error) {
    console.error('Industries error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch industries'
    });
  }
});

export default router;