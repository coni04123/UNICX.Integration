import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../common/database/database.module';
import { QueueModule } from '../../common/queue/queue.module';
import { QrCodesService } from './qr-codes.service';
import { QrCodesController } from './qr-codes.controller';

@Module({
  imports: [DatabaseModule, QueueModule],
  controllers: [QrCodesController],
  providers: [QrCodesService],
  exports: [QrCodesService],
})
export class QrCodesModule {}
