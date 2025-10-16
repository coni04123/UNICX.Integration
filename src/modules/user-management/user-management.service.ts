import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserRole, RegistrationStatus } from '../../common/schemas/user.schema';
import { WhatsAppSession, SessionStatus } from '../../common/schemas/whatsapp-session.schema';

@Injectable()
export class UserManagementService {
  private readonly logger = new Logger(UserManagementService.name);

  constructor(
    @InjectModel(User.name)
    private userModel: Model<User>,
    @InjectModel(WhatsAppSession.name)
    private whatsappSessionModel: Model<WhatsAppSession>,
  ) {}

  /**
   * Get WhatsApp QR code for a user
   */
  async getWhatsAppQR(userId: string): Promise<{ qrCode: string; expiresAt: Date; sessionId: string } | null> {
    const user = await this.userModel.findById(userId);
    if (!user?.phoneNumber) {
      return null;
    }

    const sessionId = `whatsapp-${user.phoneNumber.slice(1)}`;
    const session = await this.whatsappSessionModel.findOne({
      sessionId,
      status: SessionStatus.QR_REQUIRED,
      isActive: true,
    });

    if (!session?.qrCode || !session?.qrCodeExpiresAt) {
      return null;
    }

    return {
      qrCode: session.qrCode,
      expiresAt: session.qrCodeExpiresAt,
      sessionId: session.sessionId,
    };
  }

  /**
   * Track user onboarding progress through status updates
   */
  async updateUserProgress(userId: string, status: RegistrationStatus): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, {
      registrationStatus: status,
      updatedAt: new Date(),
    });
  }

  /**
   * Get user progress statistics
   */
  async getUserProgressStats(tenantId?: string): Promise<any> {
    const matchQuery: any = { isActive: true };
    if (tenantId) {
      matchQuery.tenantId = new Types.ObjectId(tenantId);
    }

    const stats = await this.userModel.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$registrationStatus',
          count: { $sum: 1 },
        },
      },
    ]);

    return {
      byStatus: stats,
      total: await this.userModel.countDocuments(matchQuery),
    };
  }
}
