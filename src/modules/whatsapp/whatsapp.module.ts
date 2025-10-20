import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppSession, WhatsAppSessionSchema } from '../../common/schemas/whatsapp-session.schema';
import { Message, MessageSchema } from '../../common/schemas/message.schema';
import { UsersModule } from '../users/users.module';
import { EntitiesModule } from '../entities/entities.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WhatsAppSession.name, schema: WhatsAppSessionSchema },
      { name: Message.name, schema: MessageSchema },
    ]),
    forwardRef(() => UsersModule),
    forwardRef(() => EntitiesModule),
  ],
  controllers: [WhatsAppController],
  providers: [WhatsAppService],
  exports: [WhatsAppService],
})
export class WhatsAppModule {}

