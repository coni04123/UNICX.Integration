import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { QRInvitation, QRInvitationStatus } from '../../schemas/qr-invitation.schema';

export interface CleanupJobData {
  type: 'expired-qr-codes' | 'old-scan-events' | 'failed-invitations';
  tenantId?: string;
  olderThanDays?: number;
}

@Injectable()
@Processor('cleanup')
export class CleanupProcessor {
  private readonly logger = new Logger(CleanupProcessor.name);

  constructor(
    @InjectModel(QRInvitation.name)
    private qrInvitationModel: Model<QRInvitation>,
  ) {}

  @Process('cleanup-expired-qr-codes')
  async handleCleanupExpiredQRCodes(job: Job<CleanupJobData>) {
    const { tenantId, olderThanDays = 7 } = job.data;

    try {
      this.logger.log('Starting cleanup of expired QR codes');

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const query: any = {
        expiresAt: { $lt: cutoffDate },
        status: { $in: [QRInvitationStatus.EXPIRED, QRInvitationStatus.FAILED] },
      };

      if (tenantId) {
        query.tenantId = tenantId;
      }

      const result = await this.qrInvitationModel.deleteMany(query);

      this.logger.log(`Cleaned up ${result.deletedCount} expired QR codes`);
    } catch (error) {
      this.logger.error('Failed to cleanup expired QR codes:', error);
      throw error;
    }
  }

  @Process('cleanup-old-scan-events')
  async handleCleanupOldScanEvents(job: Job<CleanupJobData>) {
    const { tenantId, olderThanDays = 30 } = job.data;

    try {
      this.logger.log('Starting cleanup of old scan events');

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const query: any = {
        'scanEvents.scannedAt': { $lt: cutoffDate },
      };

      if (tenantId) {
        query.tenantId = tenantId;
      }

      const result = await this.qrInvitationModel.updateMany(
        query,
        {
          $pull: {
            scanEvents: {
              scannedAt: { $lt: cutoffDate }
            }
          }
        }
      );

      this.logger.log(`Cleaned up old scan events from ${result.modifiedCount} invitations`);
    } catch (error) {
      this.logger.error('Failed to cleanup old scan events:', error);
      throw error;
    }
  }

  @Process('cleanup-failed-invitations')
  async handleCleanupFailedInvitations(job: Job<CleanupJobData>) {
    const { tenantId, olderThanDays = 14 } = job.data;

    try {
      this.logger.log('Starting cleanup of failed invitations');

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const query: any = {
        status: QRInvitationStatus.FAILED,
        createdAt: { $lt: cutoffDate },
      };

      if (tenantId) {
        query.tenantId = tenantId;
      }

      const result = await this.qrInvitationModel.deleteMany(query);

      this.logger.log(`Cleaned up ${result.deletedCount} failed invitations`);
    } catch (error) {
      this.logger.error('Failed to cleanup failed invitations:', error);
      throw error;
    }
  }
}
