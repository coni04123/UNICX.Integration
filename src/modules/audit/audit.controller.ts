import { Controller, Get, Query, UseGuards, Logger, Req } from '@nestjs/common';
import { Request } from 'express';
import { AuditService, AuditAction } from '../../common/audit/audit.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantGuard } from '../auth/tenant.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators';
import { UserRole } from '../../common/schemas/user.schema';
// Removed GetUser import as it doesn't exist

@Controller('audit')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class AuditController {
  private readonly logger = new Logger(AuditController.name);

  constructor(private readonly auditService: AuditService) {}

  @Get('logs')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.TENANT_ADMIN)
  async getAuditLogs(
    @Req() req: Request,
    @Query('userId') userId?: string,
    @Query('action') action?: AuditAction,
    @Query('resource') resource?: string,
    @Query('resourceId') resourceId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    try {
      const tenantId = req.user['tenantId'];
      const filters: any = {};
      
      if (userId) filters.userId = userId;
      if (action) filters.action = action;
      if (resource) filters.resource = resource;
      if (resourceId) filters.resourceId = resourceId;
      if (startDate) filters.startDate = new Date(startDate);
      if (endDate) filters.endDate = new Date(endDate);
      if (limit) filters.limit = parseInt(limit, 10);
      if (offset) filters.offset = parseInt(offset, 10);

      const result = await this.auditService.getAuditLogs(tenantId, filters);
      
      return {
        success: true,
        data: result.logs,
        total: result.total,
        limit: filters.limit || 100,
        offset: filters.offset || 0,
      };
    } catch (error) {
      this.logger.error('Failed to get audit logs:', error);
      throw error;
    }
  }

  @Get('stats')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.TENANT_ADMIN)
  async getAuditStats(
    @Req() req: Request,
    @Query('days') days?: string,
  ) {
    try {
      const tenantId = req.user['tenantId'];
      const daysToAnalyze = days ? parseInt(days, 10) : 30;
      const stats = await this.auditService.getAuditStats(tenantId, daysToAnalyze);
      
      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      this.logger.error('Failed to get audit stats:', error);
      throw error;
    }
  }

  @Get('actions')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.TENANT_ADMIN)
  async getAuditActions() {
    return {
      success: true,
      data: Object.values(AuditAction),
    };
  }
}
