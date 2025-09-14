import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { translationService } from '../services/translationService';
import { authMiddleware } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import { logger } from '../utils/logger';

const router = Router();

// Apply authentication and rate limiting to all translation routes
router.use(authMiddleware);
router.use(rateLimitMiddleware);

/**
 * POST /api/translation/translate
 * Translate text to target language
 */
router.post(
  '/translate',
  [
    body('text')
      .isString()
      .isLength({ min: 1, max: 10000 })
      .withMessage('Text must be between 1 and 10000 characters'),
    body('targetLanguage')
      .isString()
      .isLength({ min: 2, max: 5 })
      .withMessage('Target language must be a valid language code'),
    body('sourceLanguage')
      .optional()
      .isString()
      .isLength({ min: 2, max: 5 })
      .withMessage('Source language must be a valid language code'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array(),
        });
      }

      const { text, targetLanguage, sourceLanguage } = req.body;

      if (!translationService.isLanguageSupported(targetLanguage)) {
        return res.status(400).json({
          error: 'Unsupported target language',
          supportedLanguages: translationService.getSupportedLanguages(),
        });
      }

      const translation = await translationService.translateText({
        text,
        targetLanguage,
        sourceLanguage,
      });

      res.json({
        success: true,
        data: translation,
      });
    } catch (error) {
      logger.error('Translation request failed:', error);
      res.status(500).json({
        error: 'Translation failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * POST /api/translation/analysis/:analysisId
 * Translate document analysis to target language
 */
router.post(
  '/analysis/:analysisId',
  [
    param('analysisId')
      .isUUID()
      .withMessage('Analysis ID must be a valid UUID'),
    body('targetLanguage')
      .isString()
      .isLength({ min: 2, max: 5 })
      .withMessage('Target language must be a valid language code'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array(),
        });
      }

      const { analysisId } = req.params;
      const { targetLanguage } = req.body;

      if (!translationService.isLanguageSupported(targetLanguage)) {
        return res.status(400).json({
          error: 'Unsupported target language',
          supportedLanguages: translationService.getSupportedLanguages(),
        });
      }

      // TODO: Fetch analysis from database using analysisId
      // For now, we'll return a placeholder response
      const mockAnalysis = {
        summary: 'This is a sample legal document analysis.',
        keyTerms: [
          {
            term: 'contract',
            definition: 'A legally binding agreement between two or more parties',
            importance: 'high',
          },
        ],
        risks: [
          {
            category: 'legal',
            severity: 'medium',
            description: 'This clause may limit your rights',
            recommendation: 'Consider negotiating this term',
          },
        ],
        recommendations: [
          'Review the termination clause carefully',
          'Ensure you understand the liability limitations',
        ],
      };

      const translatedAnalysis = await translationService.translateAnalysis(
        mockAnalysis,
        targetLanguage
      );

      res.json({
        success: true,
        data: {
          analysisId,
          language: targetLanguage,
          analysis: translatedAnalysis,
        },
      });
    } catch (error) {
      logger.error('Analysis translation failed:', error);
      res.status(500).json({
        error: 'Analysis translation failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * GET /api/translation/legal-terms
 * Get legal terms dictionary for a specific language
 */
router.get(
  '/legal-terms',
  [
    query('language')
      .isString()
      .isLength({ min: 2, max: 5 })
      .withMessage('Language must be a valid language code'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array(),
        });
      }

      const { language } = req.query as { language: string };

      if (!translationService.isLanguageSupported(language)) {
        return res.status(400).json({
          error: 'Unsupported language',
          supportedLanguages: translationService.getSupportedLanguages(),
        });
      }

      const legalTerms = translationService.getLegalTermsForLanguage(language);

      res.json({
        success: true,
        data: {
          language,
          terms: legalTerms,
        },
      });
    } catch (error) {
      logger.error('Legal terms request failed:', error);
      res.status(500).json({
        error: 'Failed to fetch legal terms',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * POST /api/translation/detect-language
 * Detect the language of provided text
 */
router.post(
  '/detect-language',
  [
    body('text')
      .isString()
      .isLength({ min: 10, max: 5000 })
      .withMessage('Text must be between 10 and 5000 characters for accurate detection'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array(),
        });
      }

      const { text } = req.body;

      const detectedLanguage = await translationService.detectLanguage(text);

      res.json({
        success: true,
        data: {
          detectedLanguage,
          isSupported: translationService.isLanguageSupported(detectedLanguage),
        },
      });
    } catch (error) {
      logger.error('Language detection failed:', error);
      res.status(500).json({
        error: 'Language detection failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * GET /api/translation/supported-languages
 * Get list of supported languages
 */
router.get('/supported-languages', (req, res) => {
  try {
    const supportedLanguages = translationService.getSupportedLanguages();
    
    res.json({
      success: true,
      data: {
        languages: supportedLanguages,
        count: supportedLanguages.length,
      },
    });
  } catch (error) {
    logger.error('Failed to get supported languages:', error);
    res.status(500).json({
      error: 'Failed to get supported languages',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export { router as translationRouter };