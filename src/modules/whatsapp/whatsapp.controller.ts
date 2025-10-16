import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { WhatsAppService } from './whatsapp.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles, RequireTenant } from '../auth/decorators';
import { UserRole } from '../../common/schemas/user.schema';

@ApiTags('WhatsApp')
@Controller('whatsapp')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class WhatsAppController {
  constructor(private readonly whatsappService: WhatsAppService) {}

  @Post('sessions')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.TENANT_ADMIN)
  @RequireTenant()
  @ApiOperation({ summary: 'Create new WhatsApp session and generate QR code' })
  @ApiResponse({ status: 201, description: 'Session created successfully' })
  async createSession(@Request() req) {
    const sessionId = `${req.user.tenantId}_${req.user.sub}_${Date.now()}`;
    return this.whatsappService.createSession(
      sessionId,
      req.user.sub,
      req.user.email,
      req.user.entityId,
      req.user.tenantId,
    );
  }

  @Get('sessions/:sessionId/qr')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.TENANT_ADMIN)
  @ApiOperation({ summary: 'Get QR code for WhatsApp session' })
  @ApiResponse({ status: 200, description: 'QR code retrieved successfully' })
  @ApiResponse({ status: 404, description: 'QR code not available' })
  async getQRCode(@Param('sessionId') sessionId: string) {
    const qrData = await this.whatsappService.getQRCode(sessionId);
    if (!qrData) {
      return {
        success: false,
        message: 'QR code not available. Session may be connected or QR code has expired.',
      };
    }
    return {
      success: true,
      ...qrData,
    };
  }

  @Get('sessions/:sessionId/status')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.TENANT_ADMIN)
  @ApiOperation({ summary: 'Get WhatsApp session status' })
  @ApiResponse({ status: 200, description: 'Session status retrieved successfully' })
  async getSessionStatus(@Param('sessionId') sessionId: string) {
    return this.whatsappService.getSessionStatus(sessionId);
  }

  @Delete('sessions/:sessionId')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.TENANT_ADMIN)
  @ApiOperation({ summary: 'Disconnect WhatsApp session' })
  @ApiResponse({ status: 200, description: 'Session disconnected successfully' })
  async disconnectSession(@Param('sessionId') sessionId: string) {
    await this.whatsappService.disconnectSession(sessionId);
    return {
      success: true,
      message: 'Session disconnected successfully',
    };
  }

  @Post('messages/send')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.TENANT_ADMIN)
  @RequireTenant()
  @ApiOperation({ summary: 'Send WhatsApp message' })
  @ApiResponse({ status: 200, description: 'Message sent successfully' })
  async sendMessage(
    @Body() body: { sessionId: string; to: string; message: string },
    @Request() req,
  ) {
    return this.whatsappService.sendMessage(
      body.sessionId,
      body.to,
      body.message,
      req.user.sub,
    );
  }

  @Get('messages')
  @RequireTenant()
  @ApiOperation({ summary: 'Get WhatsApp messages with pagination and filters' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page' })
  @ApiQuery({ name: 'direction', required: false, description: 'Message direction (inbound/outbound)' })
  @ApiQuery({ name: 'status', required: false, description: 'Message status' })
  @ApiQuery({ name: 'type', required: false, description: 'Message type' })
  @ApiQuery({ name: 'from', required: false, description: 'From phone number' })
  @ApiQuery({ name: 'to', required: false, description: 'To phone number' })
  @ApiQuery({ name: 'search', required: false, description: 'Search in message content' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Start date filter' })
  @ApiQuery({ name: 'endDate', required: false, description: 'End date filter' })
  @ApiResponse({ status: 200, description: 'Messages retrieved successfully with pagination' })
  async getMessages(@Query() query: any, @Request() req) {
    const filters = {
      ...query,
      tenantId: req.user.tenantId,
      entityId: query.entityId || req.user.entityId,
    };
    return this.whatsappService.getMessages(filters);
  }

  @Get('conversations')
  @RequireTenant()
  @ApiOperation({ summary: 'Get list of conversations' })
  @ApiResponse({ status: 200, description: 'Conversations retrieved successfully' })
  async getConversations(@Request() req) {
    return this.whatsappService.getConversations(req.user.tenantId);
  }
}

