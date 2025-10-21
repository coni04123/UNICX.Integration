import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UsersService } from '../users/users.service';
import { EntitiesService } from '../entities/entities.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { User } from '../../common/schemas/user.schema';
import { Entity } from '../../common/schemas/entity.schema';
import { Message } from '../../common/schemas/message.schema';
import { WhatsAppSession } from '../../common/schemas/whatsapp-session.schema';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Entity.name) private entityModel: Model<Entity>,
    @InjectModel(Message.name) private messageModel: Model<Message>,
    @InjectModel(WhatsAppSession.name) private whatsappSessionModel: Model<WhatsAppSession>,
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
    const totalEntities = await this.entityModel.countDocuments({ 
      tenantId, 
      isActive: true 
    });

    const companies = await this.entityModel.countDocuments({ 
      tenantId, 
      type: 'company',
      isActive: true 
    });

    const departments = await this.entityModel.countDocuments({ 
      tenantId, 
      type: 'department',
      isActive: true 
    });

    // Count users with phone numbers (E164 users)
    const e164Users = await this.userModel.countDocuments({ 
      tenantId, 
      phoneNumber: { $exists: true, $ne: null },
      isActive: true 
    });

    // Calculate registration rate
    const totalUsers = await this.userModel.countDocuments({ 
      tenantId, 
      isActive: true 
    });
    const registeredUsers = await this.userModel.countDocuments({ 
      tenantId, 
      registrationStatus: 'registered',
      isActive: true 
    });
    const registrationRate = totalUsers > 0 ? Math.round((registeredUsers / totalUsers) * 100) : 0;

    // Calculate change from last week
    const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const entitiesLastWeek = await this.entityModel.countDocuments({ 
      tenantId, 
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
    // Messages sent in last 24 hours
    const sent24h = await this.messageModel.countDocuments({
      tenantId,
      direction: 'outgoing',
      createdAt: { $gte: startDate, $lte: endDate },
    });

    // Total monitored messages (from users with phone numbers)
    const monitored = await this.messageModel.countDocuments({
      tenantId,
      'from.phoneNumber': { $exists: true, $ne: null },
    });

    // External messages (from users without phone numbers in our system)
    const external = await this.messageModel.countDocuments({
      tenantId,
      'from.phoneNumber': { $exists: false },
    });

    // Active conversations (unique phone numbers that sent messages in last 24h)
    const activeConversations = await this.messageModel.distinct('from.phoneNumber', {
      tenantId,
      createdAt: { $gte: startDate, $lte: endDate },
      'from.phoneNumber': { $exists: true, $ne: null },
    });

    // Calculate change from previous day
    const previousDayStart = new Date(startDate.getTime() - 24 * 60 * 60 * 1000);
    const previousDayEnd = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
    const sentPreviousDay = await this.messageModel.countDocuments({
      tenantId,
      direction: 'outgoing',
      createdAt: { $gte: previousDayStart, $lte: previousDayEnd },
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
    const totalUsers = await this.userModel.countDocuments({ 
      tenantId, 
      isActive: true 
    });

    const monitoredUsers = await this.userModel.countDocuments({ 
      tenantId, 
      phoneNumber: { $exists: true, $ne: null },
      isActive: true 
    });

    // Calculate change from last week
    const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const usersLastWeek = await this.userModel.countDocuments({ 
      tenantId, 
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
      // Check WhatsApp sessions health
      const totalSessions = await this.whatsappSessionModel.countDocuments({ tenantId });
      const activeSessions = await this.whatsappSessionModel.countDocuments({ 
        tenantId, 
        status: 'ready' 
      });

      // Check recent message activity
      const lastHour = new Date(Date.now() - 60 * 60 * 1000);
      const recentMessages = await this.messageModel.countDocuments({
        tenantId,
        createdAt: { $gte: lastHour },
      });

      // Check user registration activity
      const recentRegistrations = await this.userModel.countDocuments({
        tenantId,
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
}
