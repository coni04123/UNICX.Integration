import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { DatabaseModule } from '../database/database.module';
import { EmailModule } from '../../modules/email/email.module';
import { EmailProcessor } from './processors/email.processor';
import { QRCodeProcessor } from './processors/qr-code.processor';
import { WhatsAppProcessor } from './processors/whatsapp.processor';
import { CleanupProcessor } from './processors/cleanup.processor';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'email' },
      { name: 'qr-code' },
      { name: 'whatsapp' },
      { name: 'cleanup' },
    ),
    DatabaseModule, // Provides Mongoose models
    EmailModule,    // Provides EmailService
  ],
  providers: [
    EmailProcessor,
    QRCodeProcessor,
    WhatsAppProcessor,
    CleanupProcessor,
  ],
  exports: [BullModule],
})
export class QueueModule {}
