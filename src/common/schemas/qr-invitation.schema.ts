import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type QRInvitationDocument = QRInvitation & Document;

export enum QRInvitationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  SCANNED = 'scanned',
  EXPIRED = 'expired',
  FAILED = 'failed',
}

@Schema({ timestamps: true })
export class EmailDeliveryTracking {
  @Prop({ required: true })
  sentAt: Date;

  @Prop({ required: true, default: 1 })
  attemptCount: number;

  @Prop()
  deliveredAt: Date;

  @Prop()
  bouncedAt: Date;

  @Prop()
  complaintAt: Date;

  @Prop()
  errorMessage: string;

  @Prop()
  providerMessageId: string;

  @Prop({ default: false })
  isDelivered: boolean;

  @Prop({ default: false })
  isBounced: boolean;

  @Prop({ default: false })
  isComplaint: boolean;
}

@Schema({ timestamps: true })
export class ScanEvent {
  @Prop({ required: true })
  scannedAt: Date;

  @Prop()
  ipAddress: string;

  @Prop()
  userAgent: string;

  @Prop()
  deviceInfo: string;

  @Prop()
  location: string;
}

@Schema({ timestamps: true })
export class QRInvitation {
  @Prop({ type: Types.ObjectId, auto: true })
  _id: Types.ObjectId;

  @Prop({ required: true, unique: true })
  qrCodeId: string;

  @Prop({ required: true })
  encryptedPayload: string;

  @Prop({ required: true, enum: QRInvitationStatus, default: QRInvitationStatus.PENDING })
  status: QRInvitationStatus;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  email: string;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ type: EmailDeliveryTracking })
  emailDelivery: EmailDeliveryTracking;

  @Prop({ type: [ScanEvent], default: [] })
  scanEvents: ScanEvent[];

  @Prop()
  templateId: string;

  @Prop({ type: Object, default: {} })
  templateData: Record<string, any>;

  @Prop({ required: true, default: true })
  isActive: boolean;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const QRInvitationSchema = SchemaFactory.createForClass(QRInvitation);

// Indexes for performance
QRInvitationSchema.index({ qrCodeId: 1 }, { unique: true });
QRInvitationSchema.index({ userId: 1 });
QRInvitationSchema.index({ isActive: 1 });
QRInvitationSchema.index({ status: 1 });
QRInvitationSchema.index({ expiresAt: 1 });
QRInvitationSchema.index({ email: 1 });
QRInvitationSchema.index({ createdAt: 1 });

// TTL index for automatic cleanup of expired invitations
QRInvitationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
