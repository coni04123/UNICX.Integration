import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../../schemas/user.schema';
import { WhatsAppSession } from '../../schemas/whatsapp-session.schema';
import { EmailService } from '../../../modules/email/email.service';

@Processor('email')
export class EmailProcessor {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(
    @InjectModel(User.name)
    private userModel: Model<User>,
    @InjectModel(WhatsAppSession.name)
    private whatsappSessionModel: Model<WhatsAppSession>,
    private emailService: EmailService,
  ) {}

  @Process('send-invitation')
  async handleInvitation(job: Job<{ userId: string }>) {
    const { userId } = job.data;
    this.logger.debug(`Processing invitation email for user ${userId}`);

    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    // Get WhatsApp QR code if available
    let qrCodeData = null;
    if (user.phoneNumber) {
      const session = await this.whatsappSessionModel.findOne({
        userId: user._id,
        isActive: true,
      });
      if (session?.qrCode) {
        qrCodeData = {
          qrCode: session.qrCode,
          expiresAt: session.qrCodeExpiresAt,
        };
      }
    }

    // Send appropriate email
    if (qrCodeData) {
      const tempPassword = Math.random().toString(36).slice(-8);
      await this.emailService.sendInvitationEmailWithQR(user.email, {
        firstName: user.firstName,
        lastName: user.lastName,
        qrCode: qrCodeData.qrCode,
        sessionId: `whatsapp-${user.phoneNumber.slice(1)}`,
        tempPassword,
        expiresAt: qrCodeData.expiresAt,
      });
    } else {
      await this.emailService.sendInvitationEmail(user.email, 'invitation', {
        firstName: user.firstName,
        lastName: user.lastName,
        subject: 'Welcome to UNICX',
      });
    }

    return { success: true };
  }
}