import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../../common/schemas/user.schema';
import { WhatsAppSession, WhatsAppSessionSchema } from '../../common/schemas/whatsapp-session.schema';
import { UserManagementService } from './user-management.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: WhatsAppSession.name, schema: WhatsAppSessionSchema },
    ]),
  ],
  providers: [UserManagementService],
  exports: [UserManagementService],
})
export class UserManagementModule {}
