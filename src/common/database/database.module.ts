import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Entity, EntitySchema } from '../schemas/entity.schema';
import { User, UserSchema } from '../schemas/user.schema';
import { QRInvitation, QRInvitationSchema } from '../schemas/qr-invitation.schema';
import { OnboardingProgress, OnboardingProgressSchema } from '../schemas/onboarding-progress.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Entity.name, schema: EntitySchema },
      { name: User.name, schema: UserSchema },
      { name: QRInvitation.name, schema: QRInvitationSchema },
      { name: OnboardingProgress.name, schema: OnboardingProgressSchema },
    ]),
  ],
  exports: [MongooseModule],
})
export class DatabaseModule {}
