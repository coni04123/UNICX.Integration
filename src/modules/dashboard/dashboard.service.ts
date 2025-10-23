import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UsersService } from '../users/users.service';
import { EntitiesService } from '../entities/entities.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { User } from '../../common/schemas/user.schema';
import { Entity } from '../../common/schemas/entity.schema';
import { Message } from '../../common/schemas/message.schema';
import { WhatsAppSession, SessionStatus } from '../../common/schemas/whatsapp-session.schema';
import { AuditLog } from '../../common/schemas/audit-log.schema';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Entity.name) private entityModel: Model<Entity>,
    @InjectModel(Message.name) private messageModel: Model<Message>,
    @InjectModel(WhatsAppSession.name) private whatsappSessionModel: Model<WhatsAppSession>,
    @InjectModel(AuditLog.name) private auditLogModel: Model<AuditLog>,
    private usersService: UsersService,
    private entitiesService: EntitiesService,
    private whatsappService: WhatsAppService,
  ) {}

  async getDashboardStats(tenantId: string) {
    try {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Get entity statistics
      const entityStats = await this.getEntityStats(tenantId);
      
      // Get message statistics
      const messageStats = await this.getMessageStats(tenantId, yesterday, now);
      
      // Get user statistics
      const userStats = await this.getUserStats(tenantId);

      return {
        entities: entityStats,
        messages: messageStats,
        users: userStats,
      };
    } catch (error) {
      this.logger.error('Failed to get dashboard stats:', error);
      throw error;
    }
  }

  private async getEntityStats(tenantId: string) {
    // Convert tenantId string to ObjectId
    const tenantObjectId = new Types.ObjectId(tenantId);
    
    this.logger.log(`Getting entity stats for tenant: ${tenantId} (ObjectId: ${tenantObjectId})`);
    
    // Query entities where tenantId matches OR _id matches (for root entities)
    const totalEntities = await this.entityModel.countDocuments({ 
      $or: [
        { tenantId: tenantObjectId },
        { _id: tenantObjectId }
      ],
      isActive: true 
    });
    
    this.logger.log(`Total entities found: ${totalEntities}`);

    const companies = await this.entityModel.countDocuments({ 
      $or: [
        { tenantId: tenantObjectId },
        { _id: tenantObjectId }
      ],
      type: 'company',
      isActive: true 
    });

    const departments = await this.entityModel.countDocuments({ 
      $or: [
        { tenantId: tenantObjectId },
        { _id: tenantObjectId }
      ],
      type: 'department',
      isActive: true 
    });

    // Count users with phone numbers (E164 users)
    const e164Users = await this.userModel.countDocuments({ 
      tenantId: tenantObjectId, 
      phoneNumber: { $exists: true, $ne: null },
      isActive: true 
    });

    // Calculate registration rate
    const totalUsers = await this.userModel.countDocuments({ 
      tenantId: tenantObjectId, 
      isActive: true 
    });
    const registeredUsers = await this.userModel.countDocuments({ 
      tenantId: tenantObjectId, 
      registrationStatus: 'registered',
      isActive: true 
    });
    const registrationRate = totalUsers > 0 ? Math.round((registeredUsers / totalUsers) * 100) : 0;

    // Calculate change from last week
    const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const entitiesLastWeek = await this.entityModel.countDocuments({ 
      $or: [
        { tenantId: tenantObjectId },
        { _id: tenantObjectId }
      ],
      isActive: true,
      createdAt: { $lte: lastWeek }
    });
    const change = totalEntities - entitiesLastWeek;

    return {
      total: totalEntities,
      companies,
      departments,
      e164Users,
      registrationRate,
      change: {
        value: Math.abs(change),
        period: 'vs last week',
        type: change >= 0 ? 'increase' : 'decrease',
      },
    };
  }

  private async getMessageStats(tenantId: string, startDate: Date, endDate: Date) {
    // Convert tenantId string to ObjectId
    const tenantObjectId = new Types.ObjectId(tenantId);
    
    this.logger.log(`Getting message stats for tenant: ${tenantId} (ObjectId: ${tenantObjectId})`);
    this.logger.log(`Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
    
    // Messages sent in last 24 hours (outbound messages)
    const sent24h = await this.messageModel.countDocuments({
      tenantId: tenantObjectId,
      direction: 'outbound',
      createdAt: { $gte: startDate, $lte: endDate },
      isActive: true,
    });
    
    this.logger.log(`Messages sent in 24h: ${sent24h}`);

    // Total monitored messages (messages from registered users)
    const monitored = await this.messageModel.countDocuments({
      tenantId: tenantObjectId,
      isExternalNumber: false,
      isActive: true,
    });
    
    this.logger.log(`Monitored messages: ${monitored}`);

    // External messages (from users without phone numbers in our system)
    const external = await this.messageModel.countDocuments({
      tenantId: tenantObjectId,
      isExternalNumber: true,
      isActive: true,
    });
    
    this.logger.log(`External messages: ${external}`);

    // Active conversations (unique phone numbers that sent messages in last 24h)
    const activeConversations = await this.messageModel.distinct('from', {
      tenantId: tenantObjectId,
      createdAt: { $gte: startDate, $lte: endDate },
      isActive: true,
    });
    
    this.logger.log(`Active conversations: ${activeConversations.length}`);

    // Calculate change from previous day
    const previousDayStart = new Date(startDate.getTime() - 24 * 60 * 60 * 1000);
    const previousDayEnd = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
    const sentPreviousDay = await this.messageModel.countDocuments({
      tenantId: tenantObjectId,
      direction: 'outbound',
      createdAt: { $gte: previousDayStart, $lte: previousDayEnd },
      isActive: true,
    });
    const change = sent24h - sentPreviousDay;

    return {
      sent24h,
      monitored,
      external,
      activeConversations: activeConversations.length,
      change: {
        value: Math.abs(change),
        period: 'vs yesterday',
        type: change >= 0 ? 'increase' : 'decrease',
      },
    };
  }

  private async getUserStats(tenantId: string) {
    // Convert tenantId string to ObjectId
    const tenantObjectId = new Types.ObjectId(tenantId);
    
    this.logger.log(`Getting user stats for tenant: ${tenantId} (ObjectId: ${tenantObjectId})`);
    
    const totalUsers = await this.userModel.countDocuments({ 
      tenantId: tenantObjectId, 
      isActive: true 
    });
    
    this.logger.log(`Total users: ${totalUsers}`);

    const monitoredUsers = await this.userModel.countDocuments({ 
      tenantId: tenantObjectId, 
      phoneNumber: { $exists: true, $ne: null },
      isActive: true 
    });
    
    this.logger.log(`Monitored users: ${monitoredUsers}`);

    // Calculate change from last week
    const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const usersLastWeek = await this.userModel.countDocuments({ 
      tenantId: tenantObjectId, 
      isActive: true,
      createdAt: { $lte: lastWeek }
    });
    const change = totalUsers - usersLastWeek;

    return {
      total: totalUsers,
      monitored: monitoredUsers,
      change: {
        value: Math.abs(change),
        period: 'vs last week',
        type: change >= 0 ? 'increase' : 'decrease',
      },
    };
  }

  async getSystemHealth(tenantId: string) {
    try {
      // Convert tenantId string to ObjectId
      const tenantObjectId = new Types.ObjectId(tenantId);
      
      // Check WhatsApp sessions health
      const totalSessions = await this.whatsappSessionModel.countDocuments({ tenantId: tenantObjectId });
      const activeSessions = await this.whatsappSessionModel.countDocuments({ 
        tenantId: tenantObjectId, 
        status: 'ready' 
      });

      // Check recent message activity
      const lastHour = new Date(Date.now() - 60 * 60 * 1000);
      const recentMessages = await this.messageModel.countDocuments({
        tenantId: tenantObjectId,
        createdAt: { $gte: lastHour },
      });

      // Check user registration activity
      const recentRegistrations = await this.userModel.countDocuments({
        tenantId: tenantObjectId,
        registrationStatus: 'registered',
        createdAt: { $gte: lastHour },
      });

      return {
        whatsappSessions: {
          total: totalSessions,
          active: activeSessions,
          health: totalSessions > 0 ? (activeSessions / totalSessions) * 100 : 0,
        },
        messageActivity: {
          recentMessages,
          status: recentMessages > 0 ? 'active' : 'idle',
        },
        userActivity: {
          recentRegistrations,
          status: recentRegistrations > 0 ? 'active' : 'idle',
        },
        overallHealth: 'healthy', // This could be more sophisticated
      };
    } catch (error) {
      this.logger.error('Failed to get system health:', error);
      throw error;
    }
  }

  async getRecentActivity(tenantId: string, limit: number = 10) {
    try {
      this.logger.log(`Getting recent activity for tenant: ${tenantId}, limit: ${limit}`);
      const activities = [];

      // Get recent audit logs
      const auditLogs = await this.auditLogModel
        .find({ tenantId: new Types.ObjectId(tenantId), isActive: true })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      this.logger.log(`Found ${auditLogs.length} audit logs`);

      // Convert audit logs to activity items
      for (const log of auditLogs) {
        const activity = {
          id: log._id.toString(),
          type: this.mapActionToActivityType(log.action as string),
          title: this.generateActivityTitle(log.action as string, log.resource as string),
          description: this.generateActivityDescription(log),
          timestamp: (log as any).createdAt || new Date(),
          user: log.userEmail || 'System',
          status: log.result === 'SUCCESS' ? 'success' : 'error',
          action: log.action || 'UNKNOWN',
          resource: log.resource || 'UNKNOWN',
          metadata: {
            action: log.action,
            resource: log.resource,
            resourceName: log.resourceName,
          },
        };
        activities.push(activity);
      }

      // If we don't have enough audit logs, add system events
      if (activities.length < limit) {
        const systemEvents = await this.getSystemEvents(tenantId, limit - activities.length);
        activities.push(...systemEvents);
      }

      // If still no activities, return fallback activities
      if (activities.length === 0) {
        this.logger.log('No activities found, returning fallback activities');
        return this.getFallbackActivities();
      }

      this.logger.log(`Returning ${activities.length} activities`);
      return activities.slice(0, limit);
    } catch (error) {
      this.logger.error('Failed to get recent activity:', error);
      // Return fallback activities instead of throwing
      return this.getFallbackActivities();
    }
  }

  private mapActionToActivityType(action: string): string {
    const actionMap: Record<string, string> = {
      'SESSION_CREATE': 'system',
      'SESSION_DELETE': 'system',
      'MESSAGE_SEND': 'message',
      'MESSAGE_RECEIVE': 'message',
      'CREATE': 'user_action',
      'UPDATE': 'user_action',
      'DELETE': 'user_action',
      'LOGIN': 'system',
      'LOGOUT': 'system',
      'CONFIG_CHANGE': 'config_change',
    };
    return actionMap[action] || 'user_action';
  }

  private generateActivityTitle(action: string, resource: string): string {
    const actionText = action.replace(/_/g, ' ').toLowerCase();
    const resourceText = resource.replace(/_/g, ' ').toLowerCase();
    return `${actionText.charAt(0).toUpperCase() + actionText.slice(1)} ${resourceText}`;
  }

  private generateActivityDescription(log: any): string {
    if (log.errorMessage) {
      return `Failed: ${log.errorMessage}`;
    }
    
    const details = [];
    if (log.resourceName) {
      details.push(log.resourceName);
    }
    if (log.metadata?.details) {
      details.push(log.metadata.details);
    }
    
    return details.length > 0 ? details.join(' - ') : `${log.action} performed on ${log.resource}`;
  }

  private async getSystemEvents(tenantId: string, limit: number) {
    const events = [];
    
    // Get recent WhatsApp sessions
    const recentSessions = await this.whatsappSessionModel
      .find({ tenantId: new Types.ObjectId(tenantId) })
      .sort({ createdAt: -1 })
      .limit(Math.min(limit, 3))
      .lean();

    for (const session of recentSessions) {
      events.push({
        id: session._id.toString(),
        type: 'system',
        title: session.status === SessionStatus.READY ? 'WhatsApp Session Connected' : 'WhatsApp Session Created',
        description: `Session for ${session.phoneNumber || 'unknown number'}`,
        timestamp: (session as any).createdAt || new Date(),
        user: 'System',
        status: session.status === SessionStatus.READY ? 'success' : 'warning',
        action: 'SESSION_CREATE',
        resource: 'WHATSAPP_SESSION',
        metadata: {
          action: 'SESSION_CREATE',
          resource: 'WHATSAPP_SESSION',
          resourceName: session.phoneNumber || 'Unknown',
        },
      });
    }

    // Get recent users
    if (events.length < limit) {
      const recentUsers = await this.userModel
        .find({ tenantId: new Types.ObjectId(tenantId), isActive: true })
        .sort({ createdAt: -1 })
        .limit(Math.min(limit - events.length, 2))
        .lean();

      for (const user of recentUsers) {
        events.push({
          id: user._id.toString(),
          type: 'user_action',
          title: 'New User Registered',
          description: `${user.firstName} ${user.lastName} (${user.email})`,
          timestamp: (user as any).createdAt || new Date(),
          user: 'System',
          status: 'success',
          action: 'CREATE',
          resource: 'USER',
          metadata: {
            action: 'CREATE',
            resource: 'USER',
            resourceName: `${user.firstName} ${user.lastName}`,
          },
        });
      }
    }

    return events;
  }

  private getFallbackActivities() {
    return [
      {
        id: '1',
        type: 'system',
        title: 'System Initialized',
        description: 'Welcome to UNICX! Your dashboard is ready.',
        timestamp: new Date(),
        user: 'System',
        status: 'success',
        action: 'SYSTEM_INIT',
        resource: 'SYSTEM',
        metadata: {
          action: 'SYSTEM_INIT',
          resource: 'SYSTEM',
          resourceName: 'System',
        },
      },
    ];
  }
}
