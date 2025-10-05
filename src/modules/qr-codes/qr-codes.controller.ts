import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { QrCodesService } from './qr-codes.service';
import { CreateQRInvitationDto } from './dto/create-qr-invitation.dto';
import { BulkCreateQRInvitationDto } from './dto/create-qr-invitation.dto';
import { ScanQRCodeDto } from './dto/create-qr-invitation.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles, RequireTenant } from '../auth/decorators';
import { UserRole } from '../../common/schemas/user.schema';
import { QRInvitationStatus } from '../../common/schemas/qr-invitation.schema';

@ApiTags('QR Codes')
@Controller('qr-codes')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class QrCodesController {
  constructor(private readonly qrCodesService: QrCodesService) {}

  @Post('invitations')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.TENANT_ADMIN)
  @RequireTenant()
  @ApiOperation({ summary: 'Create QR invitation' })
  @ApiResponse({ status: 201, description: 'QR invitation created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async createInvitation(@Body() createDto: CreateQRInvitationDto, @Request() req) {
    return this.qrCodesService.createInvitation(createDto, req.user.sub);
  }

  @Post('invitations/bulk')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.TENANT_ADMIN)
  @RequireTenant()
  @ApiOperation({ summary: 'Bulk create QR invitations' })
  @ApiResponse({ status: 201, description: 'QR invitations created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async bulkCreateInvitations(@Body() bulkDto: BulkCreateQRInvitationDto, @Request() req) {
    return this.qrCodesService.bulkCreateInvitations(bulkDto, req.user.sub);
  }

  @Post('scan')
  @ApiOperation({ summary: 'Scan QR code' })
  @ApiResponse({ status: 200, description: 'QR code scanned successfully' })
  @ApiResponse({ status: 400, description: 'Invalid QR code' })
  async scanQRCode(@Body() scanDto: ScanQRCodeDto) {
    return this.qrCodesService.scanQRCode(scanDto);
  }

  @Get('invitations')
  @RequireTenant()
  @ApiOperation({ summary: 'Get all QR invitations' })
  @ApiQuery({ name: 'status', required: false, enum: QRInvitationStatus })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'email', required: false })
  @ApiQuery({ name: 'expired', required: false })
  @ApiResponse({ status: 200, description: 'QR invitations retrieved successfully' })
  async findAll(@Query() query: any, @Request() req) {
    return this.qrCodesService.findAll(req.user.tenantId, query);
  }

  @Get('invitations/stats')
  @RequireTenant()
  @ApiOperation({ summary: 'Get QR invitation statistics' })
  @ApiResponse({ status: 200, description: 'QR invitation statistics retrieved successfully' })
  async getStats(@Request() req) {
    return this.qrCodesService.getInvitationStats(req.user.tenantId);
  }

  @Get('invitations/:id')
  @RequireTenant()
  @ApiOperation({ summary: 'Get QR invitation by ID' })
  @ApiResponse({ status: 200, description: 'QR invitation retrieved successfully' })
  @ApiResponse({ status: 404, description: 'QR invitation not found' })
  async findOne(@Param('id') id: string, @Request() req) {
    return this.qrCodesService.findOne(id, req.user.tenantId);
  }

  @Get('by-qr-code/:qrCodeId')
  @ApiOperation({ summary: 'Get QR invitation by QR code ID' })
  @ApiResponse({ status: 200, description: 'QR invitation retrieved successfully' })
  @ApiResponse({ status: 404, description: 'QR invitation not found' })
  async findByQRCodeId(@Param('qrCodeId') qrCodeId: string) {
    return this.qrCodesService.findByQRCodeId(qrCodeId);
  }

  @Post('invitations/:id/resend')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.TENANT_ADMIN)
  @RequireTenant()
  @ApiOperation({ summary: 'Resend QR invitation email' })
  @ApiResponse({ status: 200, description: 'QR invitation resent successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'QR invitation not found' })
  async resendInvitation(@Param('id') id: string, @Request() req) {
    return this.qrCodesService.resendInvitation(id, req.user.tenantId);
  }

  @Delete('invitations/:id')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.TENANT_ADMIN)
  @RequireTenant()
  @ApiOperation({ summary: 'Cancel QR invitation' })
  @ApiResponse({ status: 200, description: 'QR invitation cancelled successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'QR invitation not found' })
  async cancelInvitation(@Param('id') id: string, @Request() req) {
    await this.qrCodesService.cancelInvitation(id, req.user.tenantId);
    return { message: 'QR invitation cancelled successfully' };
  }

  @Post('cleanup')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.TENANT_ADMIN)
  @RequireTenant()
  @ApiOperation({ summary: 'Cleanup expired QR invitations' })
  @ApiResponse({ status: 200, description: 'Expired QR invitations cleaned up successfully' })
  async cleanupExpired(@Request() req) {
    const count = await this.qrCodesService.cleanupExpiredInvitations(req.user.tenantId);
    return { message: `${count} expired invitations cleaned up` };
  }
}
