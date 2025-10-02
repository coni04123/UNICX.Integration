import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { QRInvitation } from '../../schemas/qr-invitation.schema';
import * as QRCode from 'qrcode';
import * as crypto from 'crypto';

export interface QRCodeJobData {
  invitationId: string;
  payload: Record<string, any>;
  tenantId: string;
}

@Injectable()
@Processor('qr-code')
export class QRCodeProcessor {
  private readonly logger = new Logger(QRCodeProcessor.name);

  constructor(
    @InjectModel(QRInvitation.name)
    private qrInvitationModel: Model<QRInvitation>,
  ) {}

  @Process('generate-qr')
  async handleGenerateQR(job: Job<QRCodeJobData>) {
    const { invitationId, payload, tenantId } = job.data;

    try {
      this.logger.log(`Generating QR code for invitation ${invitationId}`);

      // Generate unique QR code ID
      const qrCodeId = crypto.randomUUID();

      // Encrypt payload
      const encryptedPayload = this.encryptPayload(JSON.stringify(payload));

      // Generate QR code image
      const qrCodeImage = await QRCode.toDataURL(JSON.stringify({
        qrCodeId,
        tenantId,
        timestamp: Date.now(),
      }));

      // Update invitation with QR code data
      await this.qrInvitationModel.findByIdAndUpdate(invitationId, {
        qrCodeId,
        encryptedPayload,
        qrCodeImage,
      });

      this.logger.log(`QR code generated successfully for invitation ${invitationId}`);
    } catch (error) {
      this.logger.error(`Failed to generate QR code for invitation ${invitationId}:`, error);
      throw error;
    }
  }

  @Process('generate-bulk-qr')
  async handleBulkQRGeneration(job: Job<QRCodeJobData[]>) {
    const qrCodes = job.data;

    for (const qrCode of qrCodes) {
      try {
        await this.handleGenerateQR({ data: qrCode } as Job<QRCodeJobData>);
      } catch (error) {
        this.logger.error(`Failed to process bulk QR generation:`, error);
        // Continue with next QR code
      }
    }
  }

  private encryptPayload(payload: string): string {
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(process.env.QR_CODE_ENCRYPTION_KEY || 'default-key', 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(algorithm, key);
    
    let encrypted = cipher.update(payload, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
  }

  private decryptPayload(encryptedPayload: string): string {
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(process.env.QR_CODE_ENCRYPTION_KEY || 'default-key', 'salt', 32);
    const [ivHex, encrypted] = encryptedPayload.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipher(algorithm, key);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}
