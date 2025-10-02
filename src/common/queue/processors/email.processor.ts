import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { QRInvitation, QRInvitationStatus } from '../../schemas/qr-invitation.schema';
import { EmailService } from '../../../modules/email/email.service';

export interface EmailJobData {
  invitationId: string;
  email: string;
  templateId: string;
  templateData: Record<string, any>;
  tenantId: string;
}

@Injectable()
@Processor('email')
export class EmailProcessor {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(
    @InjectModel(QRInvitation.name)
    private qrInvitationModel: Model<QRInvitation>,
    private emailService: EmailService,
  ) {}

  @Process('send-invitation')
  async handleSendInvitation(job: Job<EmailJobData>) {
    const { invitationId, email, templateId, templateData, tenantId } = job.data;

    try {
      this.logger.log(`Processing email invitation for ${email}`);

      // Update invitation status to sent
      await this.qrInvitationModel.findByIdAndUpdate(invitationId, {
        status: QRInvitationStatus.SENT,
        'emailDelivery.sentAt': new Date(),
        'emailDelivery.attemptCount': 1,
      });

      // Send email
      await this.emailService.sendInvitationEmail(email, templateId, templateData);

      // Update delivery status
      await this.qrInvitationModel.findByIdAndUpdate(invitationId, {
        'emailDelivery.deliveredAt': new Date(),
        'emailDelivery.isDelivered': true,
      });

      this.logger.log(`Email invitation sent successfully to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send email invitation to ${email}:`, error);

      // Update failure status
      await this.qrInvitationModel.findByIdAndUpdate(invitationId, {
        status: QRInvitationStatus.FAILED,
        'emailDelivery.errorMessage': error.message,
      });

      throw error;
    }
  }

  @Process('send-bulk-invitations')
  async handleBulkInvitations(job: Job<EmailJobData[]>) {
    const invitations = job.data;

    for (const invitation of invitations) {
      try {
        await this.handleSendInvitation({ data: invitation } as Job<EmailJobData>);
      } catch (error) {
        this.logger.error(`Failed to process bulk invitation:`, error);
        // Continue with next invitation
      }
    }
  }
}
