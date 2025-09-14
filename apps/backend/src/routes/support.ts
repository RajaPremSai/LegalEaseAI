/**
 * Customer Support and Feedback API Routes
 * Handles support tickets, feedback collection, and help resources
 */

import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateUser } from '../middleware/auth';
import { SupportService } from '../services/supportService';
import { FeedbackService } from '../services/feedbackService';
import { HelpService } from '../services/helpService';
import { logger } from '../utils/logger';

const router = express.Router();
const supportService = new SupportService();
const feedbackService = new FeedbackService();
const helpService = new HelpService();

// Support ticket endpoints
router.post('/tickets',
  authenticateUser,
  [
    body('subject').isLength({ min: 5, max: 200 }).withMessage('Subject must be 5-200 characters'),
    body('description').isLength({ min: 10, max: 2000 }).withMessage('Description must be 10-2000 characters'),
    body('category').isIn(['technical', 'billing', 'feature', 'bug', 'general']).withMessage('Invalid category'),
    body('priority').isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { subject, description, category, priority, attachments } = req.body;
      const userId = req.user.id;

      const ticket = await supportService.createTicket({
        userId,
        subject,
        description,
        category,
        priority,
        attachments: attachments || []
      });

      logger.info('Support ticket created', { ticketId: ticket.id, userId });

      res.status(201).json({
        success: true,
        ticket: {
          id: ticket.id,
          subject: ticket.subject,
          status: ticket.status,
          createdAt: ticket.createdAt,
          ticketNumber: ticket.ticketNumber
        }
      });

    } catch (error) {
      logger.error('Error creating support ticket', { error: error.message, userId: req.user?.id });
      res.status(500).json({ error: 'Failed to create support ticket' });
    }
  }
);

router.get('/tickets',
  authenticateUser,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { status, page = 1, limit = 10 } = req.query;

      const tickets = await supportService.getUserTickets(userId, {
        status: status as string,
        page: parseInt(page as string),
        limit: parseInt(limit as string)
      });

      res.json({
        success: true,
        tickets: tickets.items,
        pagination: {
          page: tickets.page,
          limit: tickets.limit,
          total: tickets.total,
          pages: tickets.pages
        }
      });

    } catch (error) {
      logger.error('Error fetching support tickets', { error: error.message, userId: req.user?.id });
      res.status(500).json({ error: 'Failed to fetch support tickets' });
    }
  }
);

router.get('/tickets/:ticketId',
  authenticateUser,
  async (req, res) => {
    try {
      const { ticketId } = req.params;
      const userId = req.user.id;

      const ticket = await supportService.getTicket(ticketId, userId);

      if (!ticket) {
        return res.status(404).json({ error: 'Ticket not found' });
      }

      res.json({
        success: true,
        ticket
      });

    } catch (error) {
      logger.error('Error fetching support ticket', { error: error.message, ticketId: req.params.ticketId });
      res.status(500).json({ error: 'Failed to fetch support ticket' });
    }
  }
);

router.post('/tickets/:ticketId/messages',
  authenticateUser,
  [
    body('message').isLength({ min: 1, max: 1000 }).withMessage('Message must be 1-1000 characters')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { ticketId } = req.params;
      const { message, attachments } = req.body;
      const userId = req.user.id;

      const ticketMessage = await supportService.addTicketMessage(ticketId, {
        userId,
        message,
        attachments: attachments || []
      });

      res.status(201).json({
        success: true,
        message: ticketMessage
      });

    } catch (error) {
      logger.error('Error adding ticket message', { error: error.message, ticketId: req.params.ticketId });
      res.status(500).json({ error: 'Failed to add message to ticket' });
    }
  }
);

// Feedback endpoints
router.post('/feedback',
  [
    body('type').isIn(['bug', 'feature', 'improvement', 'compliment', 'complaint']).withMessage('Invalid feedback type'),
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
    body('message').isLength({ min: 10, max: 1000 }).withMessage('Message must be 10-1000 characters'),
    body('email').optional().isEmail().withMessage('Invalid email address')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { type, rating, message, email, page, feature } = req.body;
      const userId = req.user?.id;

      const feedback = await feedbackService.submitFeedback({
        userId,
        type,
        rating,
        message,
        email,
        page,
        feature,
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip
      });

      logger.info('Feedback submitted', { feedbackId: feedback.id, type, rating });

      res.status(201).json({
        success: true,
        message: 'Thank you for your feedback!',
        feedbackId: feedback.id
      });

    } catch (error) {
      logger.error('Error submitting feedback', { error: error.message });
      res.status(500).json({ error: 'Failed to submit feedback' });
    }
  }
);

// Help and documentation endpoints
router.get('/help/articles',
  async (req, res) => {
    try {
      const { category, search, page = 1, limit = 20 } = req.query;

      const articles = await helpService.getHelpArticles({
        category: category as string,
        search: search as string,
        page: parseInt(page as string),
        limit: parseInt(limit as string)
      });

      res.json({
        success: true,
        articles: articles.items,
        pagination: {
          page: articles.page,
          limit: articles.limit,
          total: articles.total,
          pages: articles.pages
        }
      });

    } catch (error) {
      logger.error('Error fetching help articles', { error: error.message });
      res.status(500).json({ error: 'Failed to fetch help articles' });
    }
  }
);

router.get('/help/articles/:articleId',
  async (req, res) => {
    try {
      const { articleId } = req.params;

      const article = await helpService.getHelpArticle(articleId);

      if (!article) {
        return res.status(404).json({ error: 'Article not found' });
      }

      // Track article view
      await helpService.trackArticleView(articleId, req.user?.id, req.ip);

      res.json({
        success: true,
        article
      });

    } catch (error) {
      logger.error('Error fetching help article', { error: error.message, articleId: req.params.articleId });
      res.status(500).json({ error: 'Failed to fetch help article' });
    }
  }
);

router.post('/help/articles/:articleId/helpful',
  [
    body('helpful').isBoolean().withMessage('Helpful must be true or false')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { articleId } = req.params;
      const { helpful } = req.body;
      const userId = req.user?.id;

      await helpService.rateArticle(articleId, userId, helpful);

      res.json({
        success: true,
        message: 'Thank you for your feedback!'
      });

    } catch (error) {
      logger.error('Error rating help article', { error: error.message, articleId: req.params.articleId });
      res.status(500).json({ error: 'Failed to rate article' });
    }
  }
);

// FAQ endpoints
router.get('/faq',
  async (req, res) => {
    try {
      const { category, search } = req.query;

      const faqs = await helpService.getFAQs({
        category: category as string,
        search: search as string
      });

      res.json({
        success: true,
        faqs
      });

    } catch (error) {
      logger.error('Error fetching FAQs', { error: error.message });
      res.status(500).json({ error: 'Failed to fetch FAQs' });
    }
  }
);

// Live chat endpoints
router.post('/chat/sessions',
  authenticateUser,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { initialMessage } = req.body;

      const chatSession = await supportService.createChatSession(userId, initialMessage);

      res.status(201).json({
        success: true,
        session: {
          id: chatSession.id,
          status: chatSession.status,
          estimatedWaitTime: chatSession.estimatedWaitTime
        }
      });

    } catch (error) {
      logger.error('Error creating chat session', { error: error.message, userId: req.user?.id });
      res.status(500).json({ error: 'Failed to create chat session' });
    }
  }
);

router.get('/chat/availability',
  async (req, res) => {
    try {
      const availability = await supportService.getChatAvailability();

      res.json({
        success: true,
        availability: {
          isAvailable: availability.isAvailable,
          estimatedWaitTime: availability.estimatedWaitTime,
          businessHours: availability.businessHours,
          timezone: availability.timezone
        }
      });

    } catch (error) {
      logger.error('Error checking chat availability', { error: error.message });
      res.status(500).json({ error: 'Failed to check chat availability' });
    }
  }
);

// System status endpoint
router.get('/status',
  async (req, res) => {
    try {
      const status = await supportService.getSystemStatus();

      res.json({
        success: true,
        status: {
          overall: status.overall,
          services: status.services,
          lastUpdated: status.lastUpdated,
          incidents: status.activeIncidents
        }
      });

    } catch (error) {
      logger.error('Error fetching system status', { error: error.message });
      res.status(500).json({ error: 'Failed to fetch system status' });
    }
  }
);

export default router;