import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { AuditService, AuditLog, AuditLogSchema } from '../audit/audit.service';
import { AuditMiddleware } from '../audit/audit.middleware';
import { RateLimitGuard } from './rate-limit.guard';
import { ValidationPipe } from '../validation/validation.pipe';
import { EncryptionService } from './encryption.service';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: AuditLog.name, schema: AuditLogSchema },
    ]),
  ],
  providers: [
    AuditService,
    AuditMiddleware,
    RateLimitGuard,
    ValidationPipe,
    EncryptionService,
  ],
  exports: [
    AuditService,
    AuditMiddleware,
    RateLimitGuard,
    ValidationPipe,
    EncryptionService,
  ],
})
export class SecurityModule {}
