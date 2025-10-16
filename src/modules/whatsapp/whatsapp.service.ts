import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Client, LocalAuth, MessageMedia } from 'whatsapp-web.js';
import * as QRCode from 'qrcode';
import { BlobServiceClient } from '@azure/storage-blob';
import { ConfigService } from '@nestjs/config';
import { WhatsAppSession, SessionStatus } from '../../common/schemas/whatsapp-session.schema';
import { Message, MessageDirection, MessageStatus, MessageType } from '../../common/schemas/message.schema';
import { Types } from 'mongoose';

@Injectable()
export class WhatsAppService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WhatsAppService.name);
  private clients: Map<string, Client> = new Map();

  private blobServiceClient: BlobServiceClient;
  private containerClient: any;

  constructor(
    @InjectModel(WhatsAppSession.name)
    private sessionModel: Model<WhatsAppSession>,
    @InjectModel(Message.name)
    private messageModel: Model<Message>,
    private configService: ConfigService,
  ) {
    // Initialize Azure Blob Storage
    const connectionString = this.configService.get<string>('storage.azure.connectionString');
    this.blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    this.containerClient = this.blobServiceClient.getContainerClient('whatsapp-media');
  }

  async onModuleInit() {
    this.logger.log('WhatsApp Service initialized');
    // Reconnect active sessions on startup
    await this.reconnectActiveSessions();
  }

  async onModuleDestroy() {
    this.logger.log('Destroying all WhatsApp clients');
    for (const [sessionId, client] of this.clients.entries()) {
      await this.disconnectSession(sessionId);
    }
  }

  async createSession(sessionId: string, userId: Types.ObjectId, invitedBy: string, entityId: string, tenantId: string): Promise<WhatsAppSession> {
    this.logger.log(`Creating new WhatsApp session: ${sessionId}`);

    // Check if session already exists
    let session = await this.sessionModel.findOne({ sessionId });
    
    if (!session) {
      session = await this.sessionModel.create({
        _id: new Types.ObjectId(),
        sessionId,
        userId,
        entityId: new Types.ObjectId(entityId),
        tenantId: new Types.ObjectId(tenantId),
        status: SessionStatus.CONNECTING,
        createdBy: invitedBy,
      });
    }

    // Initialize WhatsApp client
    await this.initializeClient(sessionId);

    return session;
  }

  private async initializeClient(sessionId: string): Promise<void> {
    if (this.clients.has(sessionId)) {
      this.logger.warn(`Client already exists for session: ${sessionId}`);
      return;
    }

    const client = new Client({
      authStrategy: new LocalAuth({ clientId: sessionId }),
      puppeteer: {
        executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", // path to Chrome
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      },
    });

    // QR Code event
    client.on('qr', async (qr) => {
      this.logger.log(`QR Code received for session: ${sessionId}`);
      await this.handleQRCode(sessionId, qr);
    });

    // Ready event
    client.on('ready', async () => {
      this.logger.log(`WhatsApp client ready for session: ${sessionId}`);
      await this.handleReady(sessionId, client);
    });

    // Authenticated event
    client.on('authenticated', async () => {
      this.logger.log(`WhatsApp client authenticated for session: ${sessionId}`);
      await this.updateSessionStatus(sessionId, SessionStatus.AUTHENTICATED);
    });

    // Disconnected event
    client.on('disconnected', async (reason) => {
      this.logger.warn(`WhatsApp client disconnected for session: ${sessionId}. Reason: ${reason}`);
      await this.handleDisconnected(sessionId, reason);
    });

    // Message event (incoming messages)
    client.on('message', async (message) => {
      await this.handleIncomingMessage(sessionId, message);
    });

    // Message create event (outgoing messages)
    client.on('message_create', async (message) => {
      if (message.fromMe) {
        await this.handleOutgoingMessage(sessionId, message);
      }
    });

    // Message acknowledgment
    client.on('message_ack', async (message, ack) => {
      await this.handleMessageAck(sessionId, message, ack);
    });

    this.clients.set(sessionId, client);
    await client.initialize();
  }

  private async handleQRCode(sessionId: string, qrData: string): Promise<void> {
    try {
      // Generate QR code as base64 image
      const qrCodeDataUrl = await QRCode.toDataURL(qrData);
      const qrCodeBase64 = qrCodeDataUrl.split(',')[1]; // Remove data:image/png;base64, prefix

      await this.sessionModel.findOneAndUpdate(
        { sessionId },
        {
          status: SessionStatus.QR_REQUIRED,
          qrCode: qrCodeBase64,
          qrCodeGeneratedAt: new Date(),
          qrCodeExpiresAt: new Date(Date.now() + 300000), // 5 minutes expiry
        },
      );

      this.logger.log(`QR Code generated and saved for session: ${sessionId}`);
    } catch (error) {
      this.logger.error(`Failed to handle QR code for session: ${sessionId}`, error);
    }
  }

  private async handleReady(sessionId: string, client: Client): Promise<void> {
    try {
      const info = client.info;
      
      await this.sessionModel.findOneAndUpdate(
        { sessionId },
        {
          status: SessionStatus.READY,
          phoneNumber: info.wid.user,
          whatsappName: info.pushname,
          whatsappId: info.wid._serialized,
          connectedAt: new Date(),
          lastActivityAt: new Date(),
          qrCode: null, // Clear QR code
        },
      );

      this.logger.log(`Session ready: ${sessionId} - ${info.pushname} (${info.wid.user})`);
    } catch (error) {
      this.logger.error(`Failed to handle ready event for session: ${sessionId}`, error);
    }
  }

  private async handleDisconnected(sessionId: string, reason: string): Promise<void> {
    await this.sessionModel.findOneAndUpdate(
      { sessionId },
      {
        status: SessionStatus.DISCONNECTED,
        disconnectedAt: new Date(),
        lastError: reason,
        lastErrorAt: new Date(),
      },
    );

    this.clients.delete(sessionId);
  }

  private async handleIncomingMessage(sessionId: string, message: any): Promise<void> {
    try {
      const session = await this.sessionModel.findOne({ sessionId });
      if (!session) return;

      let mediaUrl = null;
      if (message.hasMedia) {
        mediaUrl = await this.handleMediaUpload(message);
      }

      const messageData = {
        _id: new Types.ObjectId(),
        whatsappMessageId: message.id._serialized,
        from: message.from,
        to: message.to,
        type: this.getMessageType(message.type),
        direction: MessageDirection.INBOUND,
        content: message.body || '',
        mediaUrl,
        status: MessageStatus.DELIVERED,
        sentAt: new Date(message.timestamp * 1000),
        deliveredAt: new Date(),
        conversationId: message.from,
        entityId: session.entityId,
        tenantId: session.tenantId,
        metadata: {
          hasMedia: message.hasMedia,
          isForwarded: message.isForwarded,
          isStarred: message.isStarred,
          mediaType: message.type,
          caption: message.caption,
        },
      };

      await this.messageModel.create(messageData);
      
      // Update session statistics
      await this.sessionModel.findOneAndUpdate(
        { sessionId },
        {
          $inc: { messagesReceived: 1 },
          lastActivityAt: new Date(),
        },
      );

      this.logger.log(`Incoming message saved: ${message.id._serialized}`);
    } catch (error) {
      this.logger.error(`Failed to handle incoming message: ${error.message}`, error);
    }
  }

  private async handleOutgoingMessage(sessionId: string, message: any): Promise<void> {
    try {
      const session = await this.sessionModel.findOne({ sessionId });
      if (!session) return;

      let mediaUrl = null;
      if (message.hasMedia) {
        mediaUrl = await this.handleMediaUpload(message);
      }

      const messageData = {
        _id: new Types.ObjectId(),
        whatsappMessageId: message.id._serialized,
        from: message.from,
        to: message.to,
        type: this.getMessageType(message.type),
        direction: MessageDirection.OUTBOUND,
        content: message.body || '',
        mediaUrl,
        status: MessageStatus.SENT,
        sentAt: new Date(message.timestamp * 1000),
        conversationId: message.to,
        entityId: session.entityId,
        tenantId: session.tenantId,
        metadata: {
          hasMedia: message.hasMedia,
          isForwarded: message.isForwarded,
          isStarred: message.isStarred,
          mediaType: message.type,
          caption: message.caption,
        },
      };

      await this.messageModel.create(messageData);
      
      // Update session statistics
      await this.sessionModel.findOneAndUpdate(
        { sessionId },
        {
          $inc: { messagesSent: 1 },
          lastActivityAt: new Date(),
        },
      );

      this.logger.log(`Outgoing message saved: ${message.id._serialized}`);
    } catch (error) {
      this.logger.error(`Failed to handle outgoing message: ${error.message}`, error);
    }
  }

  private async handleMediaUpload(message: any): Promise<string | null> {
    try {
      const media = await message.downloadMedia();
      if (!media) return null;

      const { data, mimetype, filename } = media;
      const extension = mimetype.split('/')[1];
      const blobName = `${message.id._serialized}.${extension}`;
      const blockBlobClient = this.containerClient.getBlockBlobClient(blobName);

      // Convert base64 to buffer
      const buffer = Buffer.from(data, 'base64');

      // Upload to Azure Blob Storage
      await blockBlobClient.upload(buffer, buffer.length, {
        blobHTTPHeaders: {
          blobContentType: mimetype,
        },
      });

      // Return the URL
      return blockBlobClient.url;
    } catch (error) {
      this.logger.error(`Failed to upload media: ${error.message}`, error);
      return null;
    }
  }

  private async handleMessageAck(sessionId: string, message: any, ack: number): Promise<void> {
    try {
      const statusMap = new Map<number, MessageStatus>([
        [0, MessageStatus.PENDING],
        [1, MessageStatus.SENT],
        [2, MessageStatus.DELIVERED],
        [3, MessageStatus.READ],
        [-1, MessageStatus.FAILED],
      ]);

      const status = statusMap.get(ack) || MessageStatus.PENDING;
      const updateData: any = { status };

      if (status === MessageStatus.SENT) updateData.sentAt = new Date();
      if (status === MessageStatus.DELIVERED) updateData.deliveredAt = new Date();
      if (status === MessageStatus.READ) updateData.readAt = new Date();
      if (status === MessageStatus.FAILED) updateData.failedAt = new Date();

      await this.messageModel.findOneAndUpdate(
        { whatsappMessageId: message.id._serialized },
        updateData,
      );

      // Update session statistics
      if (status === MessageStatus.DELIVERED) {
        await this.sessionModel.findOneAndUpdate(
          { sessionId },
          { $inc: { messagesDelivered: 1 } },
        );
      } else if (status === MessageStatus.FAILED) {
        await this.sessionModel.findOneAndUpdate(
          { sessionId },
          { $inc: { messagesFailed: 1 } },
        );
      }
    } catch (error) {
      this.logger.error(`Failed to handle message ack: ${error.message}`, error);
    }
  }

  private getMessageType(type: string): MessageType {
    const typeMap: Record<string, MessageType> = {
      'chat': MessageType.TEXT,
      'image': MessageType.IMAGE,
      'video': MessageType.VIDEO,
      'audio': MessageType.AUDIO,
      'ptt': MessageType.AUDIO,
      'document': MessageType.DOCUMENT,
      'location': MessageType.LOCATION,
      'vcard': MessageType.CONTACT,
      'sticker': MessageType.STICKER,
    };
    return typeMap[type] || MessageType.TEXT;
  }

  async sendMessage(
    sessionId: string, 
    to: string, 
    content: string | MessageMedia, 
    userId: string,
    options: { caption?: string } = {}
  ): Promise<Message> {
    const client = this.clients.get(sessionId);
    if (!client) {
      throw new Error(`No active client for session: ${sessionId}`);
    }

    const session = await this.sessionModel.findOne({ sessionId });
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    try {
      let sentMessage;
      let messageType = MessageType.TEXT;
      let mediaUrl = null;

      if (typeof content === 'string') {
        // Text message
        sentMessage = await client.sendMessage(to, content);
      } else {
        // Media message
        sentMessage = await client.sendMessage(to, content, { caption: options.caption });
        messageType = this.getMessageType(content.mimetype.split('/')[0]);
        
        // Upload media to Azure Blob Storage
        const extension = content.mimetype.split('/')[1];
        const blobName = `${sentMessage.id._serialized}.${extension}`;
        const blockBlobClient = this.containerClient.getBlockBlobClient(blobName);
        
        const buffer = Buffer.from(content.data, 'base64');
        await blockBlobClient.upload(buffer, buffer.length, {
          blobHTTPHeaders: {
            blobContentType: content.mimetype,
          },
        });
        
        mediaUrl = blockBlobClient.url;
      }

      const messageData = await this.messageModel.create({
        whatsappMessageId: sentMessage.id._serialized,
        from: session.phoneNumber,
        to,
        type: messageType,
        direction: MessageDirection.OUTBOUND,
        content: typeof content === 'string' ? content : options.caption || '',
        mediaUrl,
        status: MessageStatus.SENT,
        sentAt: new Date(),
        conversationId: to,
        entityId: session.entityId,
        tenantId: session.tenantId,
        createdBy: userId,
        metadata: {
          hasMedia: mediaUrl !== null,
          mediaType: typeof content === 'string' ? null : content.mimetype,
          caption: options.caption,
        },
      });

      // Update session statistics
      await this.sessionModel.findOneAndUpdate(
        { sessionId },
        {
          $inc: { messagesSent: 1 },
          lastActivityAt: new Date(),
        },
      );

      this.logger.log(`Message sent successfully: ${sentMessage.id._serialized}`);
      return messageData;
    } catch (error) {
      this.logger.error(`Failed to send message: ${error.message}`, error);
      throw error;
    }
  }

  async getQRCode(sessionId: string): Promise<{ qrCode: string; expiresAt: Date } | null> {
    const session = await this.sessionModel.findOne({ sessionId });
    if (!session || !session.qrCode) {
      return null;
    }

    return {
      qrCode: `data:image/png;base64,${session.qrCode}`,
      expiresAt: session.qrCodeExpiresAt,
    };
  }

  async getSessionStatus(sessionId: string): Promise<WhatsAppSession | null> {
    return this.sessionModel.findOne({ sessionId });
  }

  async disconnectSession(sessionId: string): Promise<void> {
    const client = this.clients.get(sessionId);
    if (client) {
      await client.destroy();
      this.clients.delete(sessionId);
    }

    await this.sessionModel.findOneAndUpdate(
      { sessionId },
      {
        status: SessionStatus.DISCONNECTED,
        disconnectedAt: new Date(),
      },
    );

    this.logger.log(`Session disconnected: ${sessionId}`);
  }

  private async updateSessionStatus(sessionId: string, status: SessionStatus): Promise<void> {
    await this.sessionModel.findOneAndUpdate(
      { sessionId },
      { status, lastActivityAt: new Date() },
    );
  }

  private async reconnectActiveSessions(): Promise<void> {
    const activeSessions = await this.sessionModel.find({
      status: { $in: [SessionStatus.READY, SessionStatus.AUTHENTICATED] },
      isActive: true,
    });

    for (const session of activeSessions) {
      try {
        this.logger.log(`Reconnecting session: ${session.sessionId}`);
        await this.initializeClient(session.sessionId);
      } catch (error) {
        this.logger.error(`Failed to reconnect session: ${session.sessionId}`, error);
      }
    }
  }

  async getMessages(filters: any): Promise<{ messages: Message[], total: number, page: number, limit: number, totalPages: number }> {
    const query: any = { isActive: true };

    if (filters?.tenantId) query.tenantId = new Types.ObjectId(filters.tenantId);
    if (filters?.entityId) query.entityId = new Types.ObjectId(filters.entityId);
    if (filters?.userId) query.userId = new Types.ObjectId(filters.userId);
    if (filters?.direction) query.direction = filters.direction;
    if (filters?.status) query.status = filters.status;
    if (filters?.type) query.type = filters.type;
    if (filters?.from) query.from = { $regex: filters.from, $options: 'i' };
    if (filters?.to) query.to = { $regex: filters.to, $options: 'i' };
    if (filters?.conversationId) query.conversationId = filters.conversationId;

    if (filters?.search) {
      query.content = { $regex: filters.search, $options: 'i' };
    }

    if (filters?.startDate || filters?.endDate) {
      query.createdAt = {};
      if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
      if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
    }

    // Pagination
    const page = parseInt(filters?.page) || 1;
    const limit = parseInt(filters?.limit) || 20;
    const skip = (page - 1) * limit;

    const total = await this.messageModel.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    const messages = await this.messageModel
      .find(query)
      .populate('userId', 'firstName lastName email phoneNumber')
      .populate('entityId', 'name path type')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return {
      messages: messages as any,
      total,
      page,
      limit,
      totalPages,
    };
  }

  async getConversations(tenantId: string): Promise<any[]> {
    // Build match query - only include tenantId if provided (SystemAdmin has no tenantId)
    const matchQuery: any = { isActive: true };
    if (tenantId && tenantId !== '') {
      matchQuery.tenantId = new Types.ObjectId(tenantId);
    }

    const conversations = await this.messageModel.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$conversationId',
          lastMessage: { $last: '$content' },
          lastMessageAt: { $last: '$createdAt' },
          totalMessages: { $sum: 1 },
          unreadCount: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$direction', MessageDirection.INBOUND] }, { $ne: ['$status', MessageStatus.READ] }] },
                1,
                0,
              ],
            },
          },
        },
      },
      { $sort: { lastMessageAt: -1 } },
    ]);

    return conversations;
  }
}

