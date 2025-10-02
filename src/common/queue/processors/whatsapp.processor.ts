import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, WhatsAppConnectionStatus } from '../../schemas/user.schema';
import { ConfigService } from '@nestjs/config';

export interface WhatsAppJobData {
  userId: string;
  message: string;
  templateId?: string;
  tenantId: string;
}

@Injectable()
@Processor('whatsapp')
export class WhatsAppProcessor {
  private readonly logger = new Logger(WhatsAppProcessor.name);

  constructor(
    @InjectModel(User.name)
    private userModel: Model<User>,
    private configService: ConfigService,
  ) {}

  @Process('send-message')
  async handleSendMessage(job: Job<WhatsAppJobData>) {
    const { userId, message, templateId, tenantId } = job.data;

    try {
      this.logger.log(`Sending WhatsApp message to user ${userId}`);

      const user = await this.userModel.findById(userId);
      if (!user) {
        throw new Error(`User ${userId} not found`);
      }

      // Update connection status to connecting
      await this.userModel.findByIdAndUpdate(userId, {
        whatsappConnectionStatus: WhatsAppConnectionStatus.CONNECTING,
      });

      // Send WhatsApp message via API
      const response = await this.sendWhatsAppMessage(user.phoneNumber, message, templateId);

      if (response.success) {
        // Update connection status to connected
        await this.userModel.findByIdAndUpdate(userId, {
          whatsappConnectionStatus: WhatsAppConnectionStatus.CONNECTED,
          whatsappConnectedAt: new Date(),
        });

        this.logger.log(`WhatsApp message sent successfully to user ${userId}`);
      } else {
        throw new Error(response.error || 'Failed to send WhatsApp message');
      }
    } catch (error) {
      this.logger.error(`Failed to send WhatsApp message to user ${userId}:`, error);

      // Update connection status to failed
      await this.userModel.findByIdAndUpdate(userId, {
        whatsappConnectionStatus: WhatsAppConnectionStatus.FAILED,
      });

      throw error;
    }
  }

  @Process('send-bulk-messages')
  async handleBulkMessages(job: Job<WhatsAppJobData[]>) {
    const messages = job.data;

    for (const message of messages) {
      try {
        await this.handleSendMessage({ data: message } as Job<WhatsAppJobData>);
      } catch (error) {
        this.logger.error(`Failed to process bulk WhatsApp message:`, error);
        // Continue with next message
      }
    }
  }

  private async sendWhatsAppMessage(phoneNumber: string, message: string, templateId?: string) {
    const apiUrl = this.configService.get<string>('whatsapp.apiUrl');
    const accessToken = this.configService.get<string>('whatsapp.accessToken');
    const phoneNumberId = this.configService.get<string>('whatsapp.phoneNumberId');

    if (!apiUrl || !accessToken || !phoneNumberId) {
      throw new Error('WhatsApp configuration is incomplete');
    }

    try {
      const response = await fetch(`${apiUrl}/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: phoneNumber,
          type: templateId ? 'template' : 'text',
          ...(templateId ? {
            template: {
              name: templateId,
              language: { code: 'en' },
            }
          } : {
            text: { body: message }
          }),
        }),
      });

      const result = await response.json();

      if (response.ok) {
        return { success: true, data: result };
      } else {
        return { success: false, error: result.error?.message || 'Unknown error' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}
