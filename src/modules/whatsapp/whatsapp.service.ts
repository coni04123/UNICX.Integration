import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Client, LocalAuth, MessageMedia } from 'whatsapp-web.js';
import * as QRCode from 'qrcode';
import { ConfigService } from '@nestjs/config';
import { WhatsAppSession, SessionStatus } from '../../common/schemas/whatsapp-session.schema';
import { Message, MessageDirection, MessageStatus, MessageType } from '../../common/schemas/message.schema';
import { User } from '../../common/schemas/user.schema';
import { Types } from 'mongoose';
import * as os from 'os';
import { EntitiesService } from '../entities/entities.service';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class WhatsAppService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WhatsAppService.name);
  private clients: Map<string, Client> = new Map();

  constructor(
    @InjectModel(WhatsAppSession.name)
    private sessionModel: Model<WhatsAppSession>,
    @InjectModel(Message.name)
    private messageModel: Model<Message>,
    @InjectModel(User.name)
    private userModel: Model<User>,
    private configService: ConfigService,
    private entityService: EntitiesService,
    private storageService: StorageService,
  ) {}

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

    // Get entity path before creating session
    const entityObjectId = new Types.ObjectId(entityId);
    const entity = await this.entityService.findOne(entityId, null);

    console.log(entity);
    
    if (!entity.entityIdPath || entity.entityIdPath.length) {
      this.logger.warn(`Failed to get entity path for entity: ${entityId}`);
    }

    // Check if session already exists
    let session = await this.sessionModel.findOne({ sessionId });
    
    if (!session) {
      session = await this.sessionModel.create({
        _id: new Types.ObjectId(),
        sessionId,
        userId,
        entityId: entityObjectId,
        entityIdPath: entity.entityIdPath,
        tenantId: new Types.ObjectId(tenantId),
        status: SessionStatus.CONNECTING,
        createdBy: invitedBy,
      });
    } else {
      // Update existing session with entity path
      session = await this.sessionModel.findOneAndUpdate(
        { sessionId },
        { 
          entityIdPath: entity.entityIdPath,
          lastActivityAt: new Date()
        },
        { new: true }
      );
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

    let chromePath;

    console.log(os.platform());

    if (os.platform() === "win32") {
      // Windows
      chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
    } else if (os.platform() === "linux") {
      // Linux
      // Check common paths
      chromePath = "/usr/bin/chromium-browser"; // or "/usr/bin/chromium-browser"
    } else if (os.platform() === "darwin") {
      // macOS
      chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
    }

    const client = new Client({
      authStrategy: new LocalAuth({ clientId: sessionId }),
      puppeteer: {
        executablePath: chromePath, // path to Chrome
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

      // Check if message already exists
      const existingMessage = await this.messageModel.findOne({ 
        whatsappMessageId: message.id._serialized 
      });
      
      if (existingMessage) {
        this.logger.debug(`Skipping duplicate message: ${message.id._serialized}`);
        return;
      }

      // Get entity with path
      const entity = await this.entityService.findOne(session.entityId.toString(), null);
      if (!entity.entityIdPath || entity.entityIdPath.length === 0) {
        this.logger.warn(`Failed to get entity path for entity: ${session.entityId}`);
      }

      // Check if message is a reply
      let quotedMessage = null;
      if (message.hasQuotedMsg) {
        try {
          // Get the quoted message
          quotedMessage = await message.getQuotedMessage();
          this.logger.log(`Reply detected - Original message: ${quotedMessage.id._serialized} from ${quotedMessage.from}`);
        } catch (error) {
          this.logger.warn(`Failed to fetch quoted message: ${error.message}`);
        }
      }

      let mediaUrl = null;
      if (message.hasMedia) {
        mediaUrl = await this.handleMediaUpload(message);
      }

      // Check if sender is a registered user (external number detection)
      const cleanedPhoneNumber = this.cleanPhoneNumber(message.from);
      const registeredUser = await this.checkIfRegisteredUser(cleanedPhoneNumber, session.tenantId);
      const contactInfo = await this.getContactInfo(message);
      
      const isExternalNumber = !registeredUser;
      const externalSenderName = isExternalNumber ? contactInfo.name : null;
      const externalSenderPhone = isExternalNumber ? cleanedPhoneNumber : null;

      this.logger.log(`Message from ${cleanedPhoneNumber}: ${isExternalNumber ? 'EXTERNAL' : 'REGISTERED'} - ${contactInfo.name}`);

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
        entityIdPath: entity.entityIdPath,
        tenantId: session.tenantId,
        // External number detection fields
        isExternalNumber,
        externalSenderName,
        externalSenderPhone,
        userId: registeredUser ? registeredUser._id : null,
        metadata: {
          hasMedia: message.hasMedia,
          isForwarded: message.isForwarded,
          isStarred: message.isStarred,
          mediaType: message.type,
          caption: message.caption,
          // Add reply metadata
          isReply: message.hasQuotedMsg,
          quotedMessageId: quotedMessage?.id?._serialized,
          quotedMessageFrom: quotedMessage?.from,
          quotedMessageBody: quotedMessage?.body,
          // External number metadata
          senderContactName: contactInfo.name,
          senderContactPhone: contactInfo.phone,
          isExternalSender: isExternalNumber,
          registeredUserInfo: registeredUser ? {
            firstName: registeredUser.firstName,
            lastName: registeredUser.lastName,
            email: registeredUser.email,
            role: registeredUser.role
          } : null,
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

      // Check if message already exists
      const existingMessage = await this.messageModel.findOne({ 
        whatsappMessageId: message.id._serialized 
      });
      
      if (existingMessage) {
        this.logger.debug(`Skipping duplicate message: ${message.id._serialized}`);
        return;
      }

      // Get entity with path
      const entity = await this.entityService.findOne(session.entityId.toString(), null);
      if (!entity.entityIdPath || entity.entityIdPath.length === 0) {
        this.logger.warn(`Failed to get entity path for entity: ${session.entityId}`);
      }

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
        entityIdPath: entity.entityIdPath,
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
      const fileName = `${message.id._serialized}.${extension}`;

      // Convert base64 to buffer
      const buffer = Buffer.from(data, 'base64');

      // Upload to cloud storage using StorageService
      const uploadResult = await this.storageService.uploadFile(
        buffer,
        fileName,
        mimetype,
        'whatsapp-media',
      );

      this.logger.log(`Media uploaded to cloud storage: ${uploadResult.url}`);
      // Return proxy URL instead of direct cloud storage URL
      return uploadResult.proxyUrl;
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

  async sendMediaMessage(
    sessionId: string,
    to: string,
    message: string,
    mediaBuffer: Buffer,
    contentType: string,
    mediaType: 'image' | 'video' | 'audio' | 'document',
    userId: string,
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
      // Create MessageMedia from buffer
      const media = new MessageMedia(contentType, mediaBuffer.toString('base64'));
      
      // Send message with media
      const sentMessage = await client.sendMessage(to, media, { caption: message });
      
      // Get entity with path
      const entity = await this.entityService.findOne(session.entityId.toString(), null);
      if (!entity.entityIdPath || entity.entityIdPath.length === 0) {
        this.logger.warn(`Failed to get entity path for entity: ${session.entityId}`);
      }

      // Create message record
      const messageData = await this.messageModel.create({
        whatsappMessageId: sentMessage.id._serialized,
        sessionId: session._id,
        entityId: session.entityId,
        entityIdPath: entity.entityIdPath || [],
        direction: MessageDirection.OUTBOUND,
        from: session.phoneNumber,
        to: to,
        content: message,
        messageType: this.getMessageType(mediaType),
        status: MessageStatus.SENT,
        mediaUrl: null, // Will be set by storage service
        metadata: {
          mediaType,
          contentType,
          size: mediaBuffer.length,
        },
        timestamp: new Date(),
        userId: new Types.ObjectId(userId),
        tenantId: session.tenantId,
      });

      this.logger.log(`Media message sent successfully: ${sentMessage.id._serialized}`);
      return messageData;
    } catch (error) {
      this.logger.error(`Failed to send media message: ${error.message}`);
      throw error;
    }
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
        
        // Upload media to cloud storage using StorageService
        const extension = content.mimetype.split('/')[1];
        const fileName = `${sentMessage.id._serialized}.${extension}`;
        
        const buffer = Buffer.from(content.data, 'base64');
        const uploadResult = await this.storageService.uploadFile(
          buffer,
          fileName,
          content.mimetype,
          'whatsapp-media',
        );
        
        mediaUrl = uploadResult.proxyUrl;
      }

      // Get entity with path
      const entity = await this.entityService.findOne(session.entityId.toString(), null);
      if (!entity.entityIdPath || entity.entityIdPath.length === 0) {
        this.logger.warn(`Failed to get entity path for entity: ${session.entityId}`);
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
        entityIdPath: entity.entityIdPath,
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
    if (filters?.entityId) {
      const entityId = new Types.ObjectId(filters.entityId);
      // Check if the entity ID is in the entityIdPath array
      query.entityIdPath = entityId;
    }
    if (filters?.userId) query.userId = new Types.ObjectId(filters.userId);
    if (filters?.direction) query.direction = filters.direction;
    if (filters?.status) query.status = filters.status;
    if (filters?.type) query.type = filters.type;
    if (filters?.from) query.from = { $regex: filters.from, $options: 'i' };
    if (filters?.to) query.to = { $regex: filters.to, $options: 'i' };
    if (filters?.conversationId) query.conversationId = filters.conversationId;
    if (filters?.isExternal !== undefined) query.isExternalNumber = filters.isExternal === 'true';

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

    // Enhance messages with external tag information
    const enhancedMessages = messages.map(msg => ({
      ...msg.toObject(),
      // Add external tag for frontend
      tags: msg.isExternalNumber ? ['External'] : [],
      // Add display information
      displayName: msg.externalSenderName || msg.metadata?.senderContactName || 'Unknown',
      displayPhone: msg.externalSenderPhone || msg.from,
    }));

    return {
      messages: enhancedMessages as any,
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
          // Add external number detection
          isExternalNumber: { $last: '$isExternalNumber' },
          externalSenderName: { $last: '$externalSenderName' },
          externalSenderPhone: { $last: '$externalSenderPhone' },
          // Get contact info from the most recent message
          contactName: { $last: '$metadata.senderContactName' },
          contactPhone: { $last: '$metadata.senderContactPhone' },
        },
      },
      { $sort: { lastMessageAt: -1 } },
    ]);

    // Enhance conversation data with external tag information
    const enhancedConversations = conversations.map(conv => ({
      ...conv,
      conversationId: conv._id,
      // Determine if this conversation is with an external number
      isExternal: conv.isExternalNumber || false,
      // Get display name - prefer external sender name, fallback to contact name
      displayName: conv.externalSenderName || conv.contactName || 'Unknown',
      // Get display phone
      displayPhone: conv.externalSenderPhone || conv.contactPhone || conv._id,
      // Add external tag for frontend
      tags: conv.isExternalNumber ? ['External'] : [],
    }));

    return enhancedConversations;
  }

  /**
   * Check if a phone number belongs to a registered user
   * @param phoneNumber E164 formatted phone number
   * @param tenantId Tenant ID to check within
   * @returns User document if registered, null if external
   */
  private async checkIfRegisteredUser(phoneNumber: string, tenantId: Types.ObjectId): Promise<any> {
    try {
      // Find user by phone number within the tenant
      const user = await this.userModel.findOne({
        phoneNumber: phoneNumber,
        tenantId: tenantId,
        isActive: true,
        registrationStatus: { $in: ['registered', 'invited'] }
      }).select('firstName lastName email phoneNumber role');

      return user;
    } catch (error) {
      this.logger.error(`Error checking registered user for ${phoneNumber}:`, error);
      return null;
    }
  }

  /**
   * Extract contact information from WhatsApp message
   * @param message WhatsApp message object
   * @returns Contact info object
   */
  private async getContactInfo(message: any): Promise<{ name: string; phone: string }> {
    try {
      // Try to get contact info from WhatsApp
      const contact = await message.getContact();
      const name = contact.pushname || contact.name || contact.shortName || '';
      const phone = contact.number || message.from;
      
      return {
        name: name.trim() || 'Unknown',
        phone: phone
      };
    } catch (error) {
      this.logger.warn(`Failed to get contact info for ${message.from}:`, error);
      return {
        name: 'Unknown',
        phone: message.from
      };
    }
  }

  /**
   * Clean and format phone number to E164 format
   * @param phoneNumber Raw phone number
   * @returns Cleaned E164 phone number
   */
  private cleanPhoneNumber(phoneNumber: string): string {
    // Remove any non-digit characters except +
    let cleaned = phoneNumber.replace(/[^\d+]/g, '');
    
    // If it doesn't start with +, assume it needs country code
    if (!cleaned.startsWith('+')) {
      // This is a simplified approach - in production you might want to use a library like libphonenumber
      // For now, we'll just return the original number
      cleaned = '+' + cleaned;
    }
    
    return cleaned;
  }
}

