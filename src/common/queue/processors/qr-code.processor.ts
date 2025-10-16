import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WhatsAppSession, SessionStatus } from '../../schemas/whatsapp-session.schema';
import { User, RegistrationStatus } from '../../schemas/user.schema';

@Processor('qr-code')
export class QRCodeProcessor {
  private readonly logger = new Logger(QRCodeProcessor.name);

  constructor(
    @InjectModel(WhatsAppSession.name)
    private whatsappSessionModel: Model<WhatsAppSession>,
    @InjectModel(User.name)
    private userModel: Model<User>,
  ) {}

  @Process('generate')
  async handleGeneration(job: Job<{ userId: string }>) {
    const { userId } = job.data;
    this.logger.debug(`Processing QR code generation for user ${userId}`);

    const user = await this.userModel.findById(userId);
    if (!user?.phoneNumber) {
      throw new Error(`User ${userId} not found or has no phone number`);
    }

    const sessionId = `whatsapp-${user.phoneNumber.slice(1)}`;
    const session = await this.whatsappSessionModel.findOne({
      sessionId,
      isActive: true,
    });

    if (!session) {
      throw new Error(`WhatsApp session not found for user ${userId}`);
    }

    // QR code generation is handled by WhatsApp service
    // This processor just ensures the session exists and is ready

    return { success: true, sessionId };
  }
}