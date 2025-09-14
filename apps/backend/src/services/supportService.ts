/**
 * Support Service
 * Handles customer support operations including tickets, chat, and system status
 */

import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

export interface SupportTicket {
  id: string;
  ticketNumber: string;
  userId: string;
  subject: string;
  description: string;
  category: 'technical' | 'billing' | 'feature' | 'bug' | 'general';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'waiting_user' | 'resolved' | 'closed';
  assignedTo?: string;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  attachments: string[];
  messages: TicketMessage[];
}

export interface TicketMessage {
  id: string;
  ticketId: string;
  userId?: string;
  agentId?: string;
  message: string;
  attachments: string[];
  createdAt: Date;
  isInternal: boolean;
}

export interface ChatSession {
  id: string;
  userId: string;
  status: 'waiting' | 'connected' | 'ended';
  agentId?: string;
  createdAt: Date;
  endedAt?: Date;
  estimatedWaitTime: number;
  messages: ChatMessage[];
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  senderId: string;
  senderType: 'user' | 'agent' | 'system';
  message: string;
  timestamp: Date;
}

export interface SystemStatus {
  overall: 'operational' | 'degraded' | 'outage';
  services: {
    [serviceName: string]: {
      status: 'operational' | 'degraded' | 'outage';
      responseTime?: number;
      uptime?: number;
    };
  };
  lastUpdated: Date;
  activeIncidents: Incident[];
}

export interface Incident {
  id: string;
  title: string;
  description: string;
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
  severity: 'minor' | 'major' | 'critical';
  affectedServices: string[];
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
}

export class SupportService {
  private tickets: Map<string, SupportTicket> = new Map();
  private chatSessions: Map<string, ChatSession> = new Map();
  private systemStatus: SystemStatus;

  constructor() {
    this.initializeSystemStatus();
    this.startStatusMonitoring();
  }

  async createTicket(ticketData: {
    userId: string;
    subject: string;
    description: string;
    category: SupportTicket['category'];
    priority: SupportTicket['priority'];
    attachments: string[];
  }): Promise<SupportTicket> {
    const ticketId = uuidv4();
    const ticketNumber = this.generateTicketNumber();

    const ticket: SupportTicket = {
      id: ticketId,
      ticketNumber,
      userId: ticketData.userId,
      subject: ticketData.subject,
      description: ticketData.description,
      category: ticketData.category,
      priority: ticketData.priority,
      status: 'open',
      createdAt: new Date(),
      updatedAt: new Date(),
      attachments: ticketData.attachments,
      messages: []
    };

    this.tickets.set(ticketId, ticket);

    // Auto-assign based on category and priority
    await this.autoAssignTicket(ticket);

    // Send notification to support team
    await this.notifySupportTeam(ticket);

    // Send confirmation email to user
    await this.sendTicketConfirmation(ticket);

    logger.info('Support ticket created', { 
      ticketId, 
      ticketNumber, 
      category: ticketData.category, 
      priority: ticketData.priority 
    });

    return ticket;
  }

  async getUserTickets(userId: string, options: {
    status?: string;
    page: number;
    limit: number;
  }): Promise<{
    items: SupportTicket[];
    page: number;
    limit: number;
    total: number;
    pages: number;
  }> {
    const userTickets = Array.from(this.tickets.values())
      .filter(ticket => ticket.userId === userId)
      .filter(ticket => !options.status || ticket.status === options.status)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = userTickets.length;
    const pages = Math.ceil(total / options.limit);
    const startIndex = (options.page - 1) * options.limit;
    const items = userTickets.slice(startIndex, startIndex + options.limit);

    return {
      items,
      page: options.page,
      limit: options.limit,
      total,
      pages
    };
  }

  async getTicket(ticketId: string, userId: string): Promise<SupportTicket | null> {
    const ticket = this.tickets.get(ticketId);
    
    if (!ticket || ticket.userId !== userId) {
      return null;
    }

    return ticket;
  }

  async addTicketMessage(ticketId: string, messageData: {
    userId: string;
    message: string;
    attachments: string[];
  }): Promise<TicketMessage> {
    const ticket = this.tickets.get(ticketId);
    
    if (!ticket || ticket.userId !== messageData.userId) {
      throw new Error('Ticket not found or access denied');
    }

    const message: TicketMessage = {
      id: uuidv4(),
      ticketId,
      userId: messageData.userId,
      message: messageData.message,
      attachments: messageData.attachments,
      createdAt: new Date(),
      isInternal: false
    };

    ticket.messages.push(message);
    ticket.updatedAt = new Date();
    
    // Update ticket status if it was waiting for user response
    if (ticket.status === 'waiting_user') {
      ticket.status = 'in_progress';
    }

    // Notify assigned agent
    if (ticket.assignedTo) {
      await this.notifyAgent(ticket, message);
    }

    logger.info('Ticket message added', { ticketId, messageId: message.id });

    return message;
  }

  async createChatSession(userId: string, initialMessage?: string): Promise<ChatSession> {
    const sessionId = uuidv4();
    const estimatedWaitTime = await this.calculateWaitTime();

    const session: ChatSession = {
      id: sessionId,
      userId,
      status: 'waiting',
      createdAt: new Date(),
      estimatedWaitTime,
      messages: []
    };

    if (initialMessage) {
      session.messages.push({
        id: uuidv4(),
        sessionId,
        senderId: userId,
        senderType: 'user',
        message: initialMessage,
        timestamp: new Date()
      });
    }

    this.chatSessions.set(sessionId, session);

    // Try to connect to available agent
    await this.tryConnectToAgent(session);

    logger.info('Chat session created', { sessionId, userId, estimatedWaitTime });

    return session;
  }

  async getChatAvailability(): Promise<{
    isAvailable: boolean;
    estimatedWaitTime: number;
    businessHours: {
      timezone: string;
      hours: { [day: string]: { open: string; close: string } };
    };
    timezone: string;
  }> {
    const now = new Date();
    const currentHour = now.getHours();
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.

    // Business hours: Monday-Friday 9 AM - 6 PM EST, Saturday 10 AM - 4 PM EST
    const isBusinessHours = (
      (currentDay >= 1 && currentDay <= 5 && currentHour >= 9 && currentHour < 18) ||
      (currentDay === 6 && currentHour >= 10 && currentHour < 16)
    );

    const availableAgents = await this.getAvailableAgents();
    const isAvailable = isBusinessHours && availableAgents.length > 0;
    const estimatedWaitTime = await this.calculateWaitTime();

    return {
      isAvailable,
      estimatedWaitTime,
      businessHours: {
        timezone: 'EST',
        hours: {
          monday: { open: '09:00', close: '18:00' },
          tuesday: { open: '09:00', close: '18:00' },
          wednesday: { open: '09:00', close: '18:00' },
          thursday: { open: '09:00', close: '18:00' },
          friday: { open: '09:00', close: '18:00' },
          saturday: { open: '10:00', close: '16:00' },
          sunday: { open: 'closed', close: 'closed' }
        }
      },
      timezone: 'EST'
    };
  }

  async getSystemStatus(): Promise<SystemStatus> {
    return this.systemStatus;
  }

  private generateTicketNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substr(2, 4).toUpperCase();
    return `TKT-${timestamp}-${random}`;
  }

  private async autoAssignTicket(ticket: SupportTicket): Promise<void> {
    // Simple assignment logic based on category and priority
    const agents = await this.getAvailableAgents();
    
    if (agents.length === 0) {
      return; // No agents available
    }

    // Priority assignment
    let assignedAgent: string;
    
    if (ticket.priority === 'urgent' || ticket.priority === 'high') {
      // Assign to senior agents first
      assignedAgent = agents.find(agent => agent.level === 'senior')?.id || agents[0].id;
    } else {
      // Round-robin assignment
      assignedAgent = agents[Math.floor(Math.random() * agents.length)].id;
    }

    ticket.assignedTo = assignedAgent;
    ticket.status = 'in_progress';

    logger.info('Ticket auto-assigned', { ticketId: ticket.id, assignedTo: assignedAgent });
  }

  private async notifySupportTeam(ticket: SupportTicket): Promise<void> {
    // In a real implementation, this would send notifications via email, Slack, etc.
    logger.info('Support team notified of new ticket', { 
      ticketId: ticket.id, 
      priority: ticket.priority,
      category: ticket.category 
    });
  }

  private async sendTicketConfirmation(ticket: SupportTicket): Promise<void> {
    // In a real implementation, this would send an email confirmation
    logger.info('Ticket confirmation sent', { 
      ticketId: ticket.id, 
      ticketNumber: ticket.ticketNumber 
    });
  }

  private async notifyAgent(ticket: SupportTicket, message: TicketMessage): Promise<void> {
    // In a real implementation, this would notify the assigned agent
    logger.info('Agent notified of ticket update', { 
      ticketId: ticket.id, 
      agentId: ticket.assignedTo,
      messageId: message.id 
    });
  }

  private async calculateWaitTime(): Promise<number> {
    const activeSessions = Array.from(this.chatSessions.values())
      .filter(session => session.status === 'waiting').length;
    
    const availableAgents = await this.getAvailableAgents();
    
    if (availableAgents.length === 0) {
      return 30; // 30 minutes if no agents available
    }

    // Estimate 5 minutes per person in queue per agent
    return Math.max(1, Math.ceil(activeSessions / availableAgents.length) * 5);
  }

  private async getAvailableAgents(): Promise<Array<{ id: string; level: string }>> {
    // Mock agent availability - in real implementation, this would check actual agent status
    const mockAgents = [
      { id: 'agent-1', level: 'senior' },
      { id: 'agent-2', level: 'junior' },
      { id: 'agent-3', level: 'senior' }
    ];

    // Simulate some agents being available based on business hours
    const now = new Date();
    const currentHour = now.getHours();
    const isBusinessHours = currentHour >= 9 && currentHour < 18;

    return isBusinessHours ? mockAgents : [];
  }

  private async tryConnectToAgent(session: ChatSession): Promise<void> {
    const availableAgents = await this.getAvailableAgents();
    
    if (availableAgents.length > 0) {
      // In a real implementation, this would connect to an actual agent
      // For now, we'll just update the estimated wait time
      session.estimatedWaitTime = Math.max(1, session.estimatedWaitTime - 5);
    }
  }

  private initializeSystemStatus(): void {
    this.systemStatus = {
      overall: 'operational',
      services: {
        'document-analysis': { status: 'operational', responseTime: 2.5, uptime: 99.9 },
        'ai-processing': { status: 'operational', responseTime: 1.8, uptime: 99.8 },
        'file-upload': { status: 'operational', responseTime: 0.5, uptime: 99.95 },
        'user-authentication': { status: 'operational', responseTime: 0.3, uptime: 99.99 },
        'database': { status: 'operational', responseTime: 0.1, uptime: 99.9 }
      },
      lastUpdated: new Date(),
      activeIncidents: []
    };
  }

  private startStatusMonitoring(): void {
    // Update system status every 5 minutes
    setInterval(async () => {
      await this.updateSystemStatus();
    }, 5 * 60 * 1000);
  }

  private async updateSystemStatus(): Promise<void> {
    try {
      // In a real implementation, this would check actual service health
      // For now, we'll simulate occasional issues
      
      const services = Object.keys(this.systemStatus.services);
      
      for (const service of services) {
        const currentStatus = this.systemStatus.services[service];
        
        // Simulate 99.9% uptime
        const isHealthy = Math.random() > 0.001;
        
        if (isHealthy) {
          currentStatus.status = 'operational';
          currentStatus.responseTime = this.generateResponseTime(service);
        } else {
          currentStatus.status = 'degraded';
          currentStatus.responseTime = (currentStatus.responseTime || 1) * 2;
        }
      }

      // Update overall status
      const hasOutages = Object.values(this.systemStatus.services)
        .some(service => service.status === 'outage');
      const hasDegradation = Object.values(this.systemStatus.services)
        .some(service => service.status === 'degraded');

      if (hasOutages) {
        this.systemStatus.overall = 'outage';
      } else if (hasDegradation) {
        this.systemStatus.overall = 'degraded';
      } else {
        this.systemStatus.overall = 'operational';
      }

      this.systemStatus.lastUpdated = new Date();

      logger.debug('System status updated', { status: this.systemStatus.overall });

    } catch (error) {
      logger.error('Error updating system status', { error: error.message });
    }
  }

  private generateResponseTime(service: string): number {
    const baseTimes = {
      'document-analysis': 2.5,
      'ai-processing': 1.8,
      'file-upload': 0.5,
      'user-authentication': 0.3,
      'database': 0.1
    };

    const baseTime = baseTimes[service] || 1.0;
    // Add some random variation (±20%)
    return baseTime * (0.8 + Math.random() * 0.4);
  }
}