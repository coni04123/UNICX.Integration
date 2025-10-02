import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AuditLogDocument = AuditLog & Document;

export enum AuditAction {
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
  LOGIN = 'login',
  LOGOUT = 'logout',
  INVITE = 'invite',
  SCAN = 'scan',
  RESET = 'reset',
}

@Schema({ timestamps: true })
export class AuditLog {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  userEmail: string;

  @Prop({ required: true })
  tenantId: string;

  @Prop({ required: true, enum: AuditAction })
  action: AuditAction;

  @Prop({ required: true })
  resource: string;

  @Prop()
  resourceId: string;

  @Prop({ type: Object, default: {} })
  oldValues: Record<string, any>;

  @Prop({ type: Object, default: {} })
  newValues: Record<string, any>;

  @Prop()
  ipAddress: string;

  @Prop()
  userAgent: string;

  @Prop()
  endpoint: string;

  @Prop()
  method: string;

  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>;

  @Prop()
  createdAt: Date;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);

// Indexes for performance
AuditLogSchema.index({ userId: 1, createdAt: -1 });
AuditLogSchema.index({ tenantId: 1, createdAt: -1 });
AuditLogSchema.index({ action: 1, createdAt: -1 });
AuditLogSchema.index({ resource: 1, resourceId: 1 });
AuditLogSchema.index({ createdAt: -1 });

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectModel(AuditLog.name)
    private auditLogModel: Model<AuditLog>,
  ) {}

  async log(
    userId: string,
    userEmail: string,
    tenantId: string,
    action: AuditAction,
    resource: string,
    resourceId?: string,
    oldValues?: Record<string, any>,
    newValues?: Record<string, any>,
    ipAddress?: string,
    userAgent?: string,
    endpoint?: string,
    method?: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    try {
      const auditLog = new this.auditLogModel({
        userId,
        userEmail,
        tenantId,
        action,
        resource,
        resourceId,
        oldValues: oldValues || {},
        newValues: newValues || {},
        ipAddress,
        userAgent,
        endpoint,
        method,
        metadata: metadata || {},
      });

      await auditLog.save();
    } catch (error) {
      this.logger.error('Failed to create audit log:', error);
      // Don't throw error to avoid breaking the main operation
    }
  }

  async getAuditLogs(
    tenantId: string,
    filters?: {
      userId?: string;
      action?: AuditAction;
      resource?: string;
      resourceId?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    },
  ): Promise<{ logs: AuditLog[]; total: number }> {
    const query: any = { tenantId };

    if (filters?.userId) {
      query.userId = filters.userId;
    }

    if (filters?.action) {
      query.action = filters.action;
    }

    if (filters?.resource) {
      query.resource = filters.resource;
    }

    if (filters?.resourceId) {
      query.resourceId = filters.resourceId;
    }

    if (filters?.startDate || filters?.endDate) {
      query.createdAt = {};
      if (filters.startDate) {
        query.createdAt.$gte = filters.startDate;
      }
      if (filters.endDate) {
        query.createdAt.$lte = filters.endDate;
      }
    }

    const total = await this.auditLogModel.countDocuments(query);

    const logs = await this.auditLogModel
      .find(query)
      .sort({ createdAt: -1 })
      .limit(filters?.limit || 100)
      .skip(filters?.offset || 0);

    return { logs, total };
  }

  async getAuditStats(tenantId: string, days: number = 30): Promise<any> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const stats = await this.auditLogModel.aggregate([
      {
        $match: {
          tenantId,
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: '$action',
          count: { $sum: 1 },
          uniqueUsers: { $addToSet: '$userId' },
        },
      },
      {
        $project: {
          action: '$_id',
          count: 1,
          uniqueUsers: { $size: '$uniqueUsers' },
        },
      },
    ]);

    const dailyStats = await this.auditLogModel.aggregate([
      {
        $match: {
          tenantId,
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 },
      },
    ]);

    return {
      actionStats: stats,
      dailyStats,
      totalLogs: await this.auditLogModel.countDocuments({ tenantId, createdAt: { $gte: startDate } }),
    };
  }

  async cleanupOldLogs(daysToKeep: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await this.auditLogModel.deleteMany({
      createdAt: { $lt: cutoffDate },
    });

    this.logger.log(`Cleaned up ${result.deletedCount} old audit logs`);
    return result.deletedCount;
  }
}
