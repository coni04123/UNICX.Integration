import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WhatsAppSession, SessionStatus } from '../../schemas/whatsapp-session.schema';
import { User, RegistrationStatus } from '../../schemas/user.schema';

@Processor('cleanup')
export class CleanupProcessor {
  private readonly logger = new Logger(CleanupProcessor.name);

  constructor(
    @InjectModel(WhatsAppSession.name)
    private whatsappSessionModel: Model<WhatsAppSession>,
    @InjectModel(User.name)
    private userModel: Model<User>,
  ) {}

  @Process('expired-sessions')
  async handleExpiredSessions(job: Job) {
    this.logger.debug('Processing expired sessions cleanup');

    const now = new Date();
    const expiredSessions = await this.whatsappSessionModel.find({
      status: SessionStatus.QR_REQUIRED,
      qrCodeExpiresAt: { $lt: now },
      isActive: true,
    });

    for (const session of expiredSessions) {
      await this.whatsappSessionModel.findByIdAndUpdate(session._id, {
        status: SessionStatus.DISCONNECTED,
        qrCode: null,
        qrCodeExpiresAt: null,
      });

      // Update user status if needed
      if (session.userId) {
        await this.userModel.findByIdAndUpdate(session.userId, {
          registrationStatus: RegistrationStatus.INVITED,
        });
      }
    }

    return { processed: expiredSessions.length };
  }
}