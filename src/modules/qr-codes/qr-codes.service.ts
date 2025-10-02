import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { QRInvitation, QRInvitationStatus } from '../../common/schemas/qr-invitation.schema';
import { User } from '../../common/schemas/user.schema';
import { CreateQRInvitationDto } from './dto/create-qr-invitation.dto';
import { BulkCreateQRInvitationDto } from './dto/bulk-create-qr-invitation.dto';
import { ScanQRCodeDto } from './dto/scan-qr-code.dto';
import * as crypto from 'crypto';

@Injectable()
export class QrCodesService {
  constructor(
    @InjectModel(QRInvitation.name)
    private qrInvitationModel: Model<QRInvitation>,
    @InjectModel(User.name)
    private userModel: Model<User>,
    @InjectQueue('email') private emailQueue: Queue,
    @InjectQueue('qr-code') private qrCodeQueue: Queue,
  ) {}

  async createInvitation(createDto: CreateQRInvitationDto, createdBy: string): Promise<QRInvitation> {
    const { userId, email, templateId, templateData, tenantId, expiryHours } = createDto;

    // Validate user exists
    const user = await this.userModel.findOne({
      _id: userId,
      tenantId,
      isActive: true,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if user already has a pending invitation
    const existingInvitation = await this.qrInvitationModel.findOne({
      userId,
      tenantId,
      status: { $in: [QRInvitationStatus.PENDING, QRInvitationStatus.SENT] },
      isActive: true,
    });

    if (existingInvitation) {
      throw new BadRequestException('User already has a pending invitation');
    }

    // Calculate expiration date
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + (expiryHours || 24));

    // Create invitation
    const invitation = new this.qrInvitationModel({
      userId,
      tenantId,
      email,
      templateId,
      templateData: templateData || {},
      expiresAt,
      createdBy,
    });

    const savedInvitation = await invitation.save();

    // Generate QR code asynchronously
    await this.qrCodeQueue.add('generate-qr', {
      invitationId: savedInvitation._id.toString(),
      payload: {
        userId: user._id.toString(),
        email: user.email,
        tenantId,
        invitationId: savedInvitation._id.toString(),
      },
      tenantId,
    });

    // Send email asynchronously
    await this.emailQueue.add('send-invitation', {
      invitationId: savedInvitation._id.toString(),
      email,
      templateId,
      templateData: templateData || {},
      tenantId,
    });

    return savedInvitation;
  }

  async bulkCreateInvitations(bulkDto: BulkCreateQRInvitationDto, createdBy: string): Promise<{
    success: number;
    failed: number;
    errors: any[];
  }> {
    const { invitations, tenantId } = bulkDto;
    let success = 0;
    let failed = 0;
    const errors: any[] = [];

    for (const invitationData of invitations) {
      try {
        await this.createInvitation({ ...invitationData, tenantId }, createdBy);
        success++;
      } catch (error) {
        failed++;
        errors.push({
          invitation: invitationData,
          error: error.message,
        });
      }
    }

    return { success, failed, errors };
  }

  async findAll(tenantId: string, filters?: any): Promise<QRInvitation[]> {
    const query: any = { tenantId, isActive: true };

    if (filters?.status) {
      query.status = filters.status;
    }

    if (filters?.userId) {
      query.userId = filters.userId;
    }

    if (filters?.email) {
      query.email = { $regex: filters.email, $options: 'i' };
    }

    if (filters?.expired) {
      if (filters.expired === 'true') {
        query.expiresAt = { $lt: new Date() };
      } else {
        query.expiresAt = { $gte: new Date() };
      }
    }

    return this.qrInvitationModel.find(query)
      .populate('userId', 'firstName lastName email phoneNumber')
      .sort({ createdAt: -1 });
  }

  async findOne(id: string, tenantId: string): Promise<QRInvitation> {
    const invitation = await this.qrInvitationModel.findOne({
      _id: id,
      tenantId,
      isActive: true,
    }).populate('userId', 'firstName lastName email phoneNumber');

    if (!invitation) {
      throw new NotFoundException('QR invitation not found');
    }

    return invitation;
  }

  async findByQRCodeId(qrCodeId: string): Promise<QRInvitation> {
    const invitation = await this.qrInvitationModel.findOne({
      qrCodeId,
      isActive: true,
    }).populate('userId', 'firstName lastName email phoneNumber');

    if (!invitation) {
      throw new NotFoundException('QR invitation not found');
    }

    return invitation;
  }

  async scanQRCode(scanDto: ScanQRCodeDto): Promise<{ success: boolean; message: string; user?: any }> {
    const { qrCodeId, ipAddress, userAgent, deviceInfo, location } = scanDto;

    try {
      const invitation = await this.findByQRCodeId(qrCodeId);

      // Check if invitation is expired
      if (invitation.expiresAt < new Date()) {
        await this.qrInvitationModel.findByIdAndUpdate(invitation._id, {
          status: QRInvitationStatus.EXPIRED,
        });

        return {
          success: false,
          message: 'QR code has expired',
        };
      }

      // Check if already scanned
      if (invitation.status === QRInvitationStatus.SCANNED) {
        return {
          success: false,
          message: 'QR code has already been scanned',
        };
      }

      // Add scan event
      const scanEvent = {
        scannedAt: new Date(),
        ipAddress,
        userAgent,
        deviceInfo,
        location,
      };

      await this.qrInvitationModel.findByIdAndUpdate(invitation._id, {
        status: QRInvitationStatus.SCANNED,
        $push: { scanEvents: scanEvent },
      });

      // Update user registration status
      await this.userModel.findByIdAndUpdate(invitation.userId, {
        registrationStatus: 'registered',
      });

      return {
        success: true,
        message: 'QR code scanned successfully',
        user: invitation.userId,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Invalid QR code',
      };
    }
  }

  async resendInvitation(id: string, tenantId: string): Promise<QRInvitation> {
    const invitation = await this.findOne(id, tenantId);

    if (invitation.status === QRInvitationStatus.SCANNED) {
      throw new BadRequestException('Cannot resend scanned invitation');
    }

    if (invitation.expiresAt < new Date()) {
      throw new BadRequestException('Cannot resend expired invitation');
    }

    // Increment attempt count
    await this.qrInvitationModel.findByIdAndUpdate(id, {
      'emailDelivery.attemptCount': invitation.emailDelivery.attemptCount + 1,
    });

    // Resend email
    await this.emailQueue.add('send-invitation', {
      invitationId: invitation._id.toString(),
      email: invitation.email,
      templateId: invitation.templateId,
      templateData: invitation.templateData,
      tenantId: invitation.tenantId,
    });

    return this.findOne(id, tenantId);
  }

  async cancelInvitation(id: string, tenantId: string): Promise<void> {
    const invitation = await this.findOne(id, tenantId);

    if (invitation.status === QRInvitationStatus.SCANNED) {
      throw new BadRequestException('Cannot cancel scanned invitation');
    }

    await this.qrInvitationModel.findByIdAndUpdate(id, {
      status: QRInvitationStatus.FAILED,
      isActive: false,
    });
  }

  async getInvitationStats(tenantId: string): Promise<any> {
    const stats = await this.qrInvitationModel.aggregate([
      { $match: { tenantId, isActive: true } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const totalInvitations = await this.qrInvitationModel.countDocuments({ tenantId, isActive: true });
    const expiredInvitations = await this.qrInvitationModel.countDocuments({
      tenantId,
      isActive: true,
      expiresAt: { $lt: new Date() },
    });

    const scanStats = await this.qrInvitationModel.aggregate([
      { $match: { tenantId, isActive: true, status: QRInvitationStatus.SCANNED } },
      {
        $group: {
          _id: null,
          totalScans: { $sum: { $size: '$scanEvents' } },
          avgScanTime: { $avg: { $subtract: ['$scanEvents.scannedAt', '$createdAt'] } },
        },
      },
    ]);

    return {
      totalInvitations,
      expiredInvitations,
      byStatus: stats,
      scanStats: scanStats[0] || { totalScans: 0, avgScanTime: 0 },
    };
  }

  async cleanupExpiredInvitations(tenantId?: string): Promise<number> {
    const query: any = {
      expiresAt: { $lt: new Date() },
      status: { $in: [QRInvitationStatus.PENDING, QRInvitationStatus.SENT] },
    };

    if (tenantId) {
      query.tenantId = tenantId;
    }

    const result = await this.qrInvitationModel.updateMany(query, {
      status: QRInvitationStatus.EXPIRED,
    });

    return result.modifiedCount;
  }

  private encryptQRData(data: any): string {
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(process.env.QR_CODE_ENCRYPTION_KEY || 'default-key', 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(algorithm, key);
    
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
  }

  private decryptQRData(encryptedData: string): any {
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(process.env.QR_CODE_ENCRYPTION_KEY || 'default-key', 'salt', 32);
    const [ivHex, encrypted] = encryptedData.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipher(algorithm, key);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  }
}
