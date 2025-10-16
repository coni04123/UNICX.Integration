import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MessageDocument = Message & Document;

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  DOCUMENT = 'document',
  LOCATION = 'location',
  CONTACT = 'contact',
  STICKER = 'sticker',
}

export enum MessageStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed',
}

export enum MessageDirection {
  INBOUND = 'inbound',
  OUTBOUND = 'outbound',
}

@Schema({ timestamps: true })
export class Message {
  @Prop({ type: Types.ObjectId, auto: true })
  _id: Types.ObjectId;

  // WhatsApp Message ID
  @Prop({ required: true })
  whatsappMessageId: string;

  // Participant Information
  @Prop({ required: true })
  from: string; // Phone number in E.164 format

  @Prop({ required: true })
  to: string; // Phone number in E.164 format

  @Prop({ type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId; // Link to user if exists

  // Message Content
  @Prop({ required: true, enum: MessageType })
  type: MessageType;

  @Prop({ required: true, enum: MessageDirection })
  direction: MessageDirection;

  @Prop({ type: String })
  content: string; // Text content or caption

  @Prop({ type: String })
  mediaUrl: string; // URL to media file if applicable

  @Prop({ type: String })
  thumbnailUrl: string; // Thumbnail for media

  @Prop({ type: Object })
  metadata: Record<string, any>; // Additional metadata

  // Status Tracking
  @Prop({ required: true, enum: MessageStatus, default: MessageStatus.PENDING })
  status: MessageStatus;

  @Prop()
  sentAt: Date;

  @Prop()
  deliveredAt: Date;

  @Prop()
  readAt: Date;

  @Prop()
  failedAt: Date;

  @Prop()
  failureReason: string;

  // Conversation Tracking
  @Prop({ type: String })
  conversationId: string; // Group messages by conversation

  @Prop({ type: Types.ObjectId, ref: 'Message' })
  replyToMessageId: Types.ObjectId; // If this is a reply

  // Campaign Tracking
  @Prop({ type: Types.ObjectId, ref: 'Campaign' })
  campaignId: Types.ObjectId;

  @Prop({ type: String })
  templateName: string; // If sent via template

  // Entity & Tenant
  @Prop({ type: Types.ObjectId, ref: 'Entity', required: true })
  entityId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Entity', required: true })
  tenantId: Types.ObjectId;

  // Flags
  @Prop({ default: false })
  isStarred: boolean;

  @Prop({ default: false })
  isArchived: boolean;

  @Prop({ default: true })
  isActive: boolean;

  // Audit
  @Prop()
  createdBy: string;

  @Prop()
  updatedBy: string;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);

// Indexes for performance
MessageSchema.index({ whatsappMessageId: 1 }, { unique: true });
MessageSchema.index({ from: 1, to: 1 });
MessageSchema.index({ tenantId: 1, isActive: 1 });
MessageSchema.index({ entityId: 1 });
MessageSchema.index({ userId: 1 });
MessageSchema.index({ conversationId: 1 });
MessageSchema.index({ campaignId: 1 });
MessageSchema.index({ status: 1, tenantId: 1 });
MessageSchema.index({ direction: 1, tenantId: 1 });
MessageSchema.index({ type: 1, tenantId: 1 });
MessageSchema.index({ createdAt: -1 });
MessageSchema.index({ sentAt: -1 });

