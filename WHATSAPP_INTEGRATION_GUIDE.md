# WhatsApp Integration Implementation Guide

## Overview
Complete WhatsApp integration using whatsapp-web.js for QR code generation, email delivery, message monitoring, and a communication dashboard with advanced filters and pagination.

## 🎯 What Has Been Implemented

### 1. **Database Schemas Created**

#### Message Schema (`src/common/schemas/message.schema.ts`)
Stores all WhatsApp messages with:
- WhatsApp message tracking
- User and entity relationships
- Message types (text, image, video, audio, document, etc.)
- Message direction (inbound/outbound)
- Status tracking (pending, sent, delivered, read, failed)
- Conversation grouping
- Campaign tracking
- Full audit trail

#### WhatsApp Session Schema (`src/common/schemas/whatsapp-session.schema.ts`)
Manages WhatsApp connections with:
- Session identification and status
- QR code storage (base64)
- Connection tracking
- Statistics (messages sent/received/delivered/failed)
- Auto-reconnect capabilities
- Error tracking

### 2. **WhatsApp Service** (`src/modules/whatsapp/whatsapp.service.ts`)

Complete service with:
- ✅ Session creation and management
- ✅ QR code generation using whatsapp-web.js
- ✅ Message sending and receiving
- ✅ Status tracking (delivered, read, etc.)
- ✅ Incoming message monitoring
- ✅ Conversation management
- ✅ Automatic reconnection
- ✅ Paginated message retrieval with filters
- ✅ Session lifecycle management

### 3. **WhatsApp Controller** (`src/modules/whatsapp/whatsapp.controller.ts`)

REST API endpoints:
- `POST /whatsapp/sessions` - Create new session & generate QR
- `GET /whatsapp/sessions/:id/qr` - Get QR code
- `GET /whatsapp/sessions/:id/status` - Get session status
- `DELETE /whatsapp/sessions/:id` - Disconnect session
- `POST /whatsapp/messages/send` - Send message
- `GET /whatsapp/messages` - Get messages (with pagination & filters)
- `GET /whatsapp/conversations` - Get conversation list

### 4. **WhatsApp Module** (`src/modules/whatsapp/whatsapp.module.ts`)
- Configured with MongoDB models
- Exports service for use in other modules

## 📋 Implementation Steps Required

### Step 1: Add WhatsApp Module to AppModule

```typescript
// src/app.module.ts
import { WhatsAppModule } from './modules/whatsapp/whatsapp.module';

@Module({
  imports: [
    // ... existing imports
    WhatsAppModule,
  ],
})
export class AppModule {}
```

### Step 2: Update User Invitation to Include QR Code

Modify `src/modules/users/users.service.ts`:

```typescript
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class UsersService {
  constructor(
    // ... existing dependencies
    private whatsappService: WhatsAppService,
    private emailService: EmailService,
  ) {}

  async inviteUser(inviteUserDto: InviteUserDto, invitedBy: string): Promise<User> {
    // ... existing user creation logic
    
    // Create WhatsApp session
    const sessionId = `${inviteUserDto.tenantId}_${user._id}_${Date.now()}`;
    await this.whatsappService.createSession(
      sessionId,
      invitedBy,
      inviteUserDto.entityId,
      inviteUserDto.tenantId
    );

    // Wait for QR code generation (up to 30 seconds)
    let qrCode = null;
    for (let i = 0; i < 30; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const qrData = await this.whatsappService.getQRCode(sessionId);
      if (qrData) {
        qrCode = qrData.qrCode;
        break;
      }
    }

    // Send invitation email with QR code
    if (qrCode) {
      await this.emailService.sendInvitationEmailWithQR(
        user.email,
        {
          firstName: user.firstName,
          lastName: user.lastName,
          qrCode: qrCode,
          sessionId: sessionId,
        }
      );
    }

    return user;
  }
}
```

### Step 3: Update Email Service for QR Code Delivery

Add method to `src/modules/email/email.service.ts`:

```typescript
async sendInvitationEmailWithQR(
  email: string,
  data: { firstName: string; lastName: string; qrCode: string; sessionId: string }
): Promise<void> {
  try {
    const fromName = this.configService.get<string>('email.from.name');
    const fromAddress = this.configService.get<string>('email.from.address');

    const html = `
      <html>
        <head>
          <style>
            /* Beautiful email styling */
            body { font-family: Arial, sans-serif; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
            .content { padding: 30px; }
            .qr-container { text-align: center; margin: 30px 0; }
            .qr-container img { max-width: 300px; border: 2px solid #667eea; padding: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Welcome to UNICX!</h1>
          </div>
          <div class="content">
            <h2>Hello ${data.firstName} ${data.lastName},</h2>
            <p>You've been invited to join UNICX. To connect your WhatsApp, please scan the QR code below:</p>
            
            <div class="qr-container">
              <img src="${data.qrCode}" alt="WhatsApp QR Code" />
              <p><strong>Scan this QR code with WhatsApp</strong></p>
              <p style="color: #6b7280; font-size: 14px;">Open WhatsApp > Menu > Linked Devices > Link a Device</p>
            </div>

            <div style="background: #fef3c7; padding: 15px; border-left: 4px solid #f59e0b; margin: 20px 0;">
              <strong>⏰ Important:</strong> This QR code expires in 60 seconds. If expired, request a new one.
            </div>

            <p>After scanning, you'll be able to:</p>
            <ul>
              <li>✅ Send and receive messages</li>
              <li>✅ Connect with your team</li>
              <li>✅ Access communication dashboard</li>
            </ul>

            <p>Best regards,<br>The UNICX Team</p>
          </div>
        </body>
      </html>
    `;

    const mailOptions = {
      from: `"${fromName}" <${fromAddress}>`,
      to: email,
      subject: 'Welcome to UNICX - Connect Your WhatsApp',
      html: html,
    };

    await this.transporter.sendMail(mailOptions);
    this.logger.log(`Invitation email with QR code sent to ${email}`);
  } catch (error) {
    this.logger.error(`Failed to send invitation email with QR to ${email}:`, error);
    throw error;
  }
}
```

### Step 4: Create Frontend Communication Page

Create `UNICX.Frontend/src/app/communication/page.tsx`:

```typescript
'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import DashboardLayout from '@/components/layout/DashboardLayout';

export default function CommunicationPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalMessages, setTotalMessages] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  
  // Filters
  const [filters, setFilters] = useState({
    direction: '',
    status: '',
    type: '',
    search: '',
    startDate: '',
    endDate: '',
  });

  // Load messages with filters and pagination
  const loadMessages = async () => {
    const data = await api.getWhatsAppMessages({
      ...filters,
      page: currentPage,
      limit: pageSize,
      conversationId: selectedConversation,
    });
    setMessages(data.messages);
    setTotalMessages(data.total);
    setTotalPages(data.totalPages);
  };

  // Load conversations
  const loadConversations = async () => {
    const data = await api.getWhatsAppConversations();
    setConversations(data);
  };

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    loadMessages();
  }, [currentPage, pageSize, filters, selectedConversation]);

  return (
    <DashboardLayout>
      <div className="flex h-screen">
        {/* Conversations Sidebar */}
        <div className="w-1/4 bg-white border-r">
          <div className="p-4">
            <h2 className="text-lg font-bold">Conversations</h2>
          </div>
          <div className="overflow-y-auto">
            {conversations.map((conv) => (
              <div
                key={conv._id}
                onClick={() => setSelectedConversation(conv._id)}
                className={`p-4 cursor-pointer hover:bg-gray-50 ${
                  selectedConversation === conv._id ? 'bg-blue-50' : ''
                }`}
              >
                <div className="font-medium">{conv._id}</div>
                <div className="text-sm text-gray-500 truncate">
                  {conv.lastMessage}
                </div>
                <div className="text-xs text-gray-400">
                  {new Date(conv.lastMessageAt).toLocaleString()}
                </div>
                {conv.unreadCount > 0 && (
                  <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                    {conv.unreadCount}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 flex flex-col">
          {/* Filters */}
          <div className="bg-white p-4 border-b">
            <div className="grid grid-cols-4 gap-4">
              <input
                type="text"
                placeholder="Search messages..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="px-3 py-2 border rounded"
              />
              <select
                value={filters.direction}
                onChange={(e) => setFilters({ ...filters, direction: e.target.value })}
                className="px-3 py-2 border rounded"
              >
                <option value="">All Directions</option>
                <option value="inbound">Inbound</option>
                <option value="outbound">Outbound</option>
              </select>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="px-3 py-2 border rounded"
              >
                <option value="">All Status</option>
                <option value="sent">Sent</option>
                <option value="delivered">Delivered</option>
                <option value="read">Read</option>
                <option value="failed">Failed</option>
              </select>
              <select
                value={filters.type}
                onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                className="px-3 py-2 border rounded"
              >
                <option value="">All Types</option>
                <option value="text">Text</option>
                <option value="image">Image</option>
                <option value="video">Video</option>
                <option value="audio">Audio</option>
                <option value="document">Document</option>
              </select>
            </div>
          </div>

          {/* Messages List */}
          <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
            {messages.map((msg) => (
              <div
                key={msg._id}
                className={`mb-4 flex ${
                  msg.direction === 'outbound' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-md p-3 rounded-lg ${
                    msg.direction === 'outbound'
                      ? 'bg-blue-500 text-white'
                      : 'bg-white text-gray-900'
                  }`}
                >
                  <div className="text-sm">{msg.content}</div>
                  <div className="text-xs opacity-75 mt-1">
                    {new Date(msg.createdAt).toLocaleString()}
                    {msg.direction === 'outbound' && ` • ${msg.status}`}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="bg-white p-4 border-t">
            <div className="flex justify-between items-center">
              <div>
                Showing {(currentPage - 1) * pageSize + 1} to{' '}
                {Math.min(currentPage * pageSize, totalMessages)} of {totalMessages}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
```

### Step 5: Add API Methods to Frontend

Update `UNICX.Frontend/src/lib/api.ts`:

```typescript
// WhatsApp APIs
async createWhatsAppSession(): Promise<any> {
  return this.post('/whatsapp/sessions', {});
}

async getWhatsAppQRCode(sessionId: string): Promise<any> {
  return this.get(`/whatsapp/sessions/${sessionId}/qr`);
}

async getWhatsAppSessionStatus(sessionId: string): Promise<any> {
  return this.get(`/whatsapp/sessions/${sessionId}/status`);
}

async disconnectWhatsAppSession(sessionId: string): Promise<any> {
  return this.delete(`/whatsapp/sessions/${sessionId}`);
}

async sendWhatsAppMessage(sessionId: string, to: string, message: string): Promise<any> {
  return this.post('/whatsapp/messages/send', { sessionId, to, message });
}

async getWhatsAppMessages(filters?: {
  page?: number;
  limit?: number;
  direction?: string;
  status?: string;
  type?: string;
  from?: string;
  to?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  conversationId?: string;
}): Promise<{
  messages: any[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const params = new URLSearchParams();
  if (filters?.page) params.append('page', filters.page.toString());
  if (filters?.limit) params.append('limit', filters.limit.toString());
  if (filters?.direction) params.append('direction', filters.direction);
  if (filters?.status) params.append('status', filters.status);
  if (filters?.type) params.append('type', filters.type);
  if (filters?.from) params.append('from', filters.from);
  if (filters?.to) params.append('to', filters.to);
  if (filters?.search) params.append('search', filters.search);
  if (filters?.startDate) params.append('startDate', filters.startDate);
  if (filters?.endDate) params.append('endDate', filters.endDate);
  if (filters?.conversationId) params.append('conversationId', filters.conversationId);

  const queryString = params.toString();
  return this.get(`/whatsapp/messages${queryString ? `?${queryString}` : ''}`);
}

async getWhatsAppConversations(): Promise<any[]> {
  return this.get('/whatsapp/conversations');
}
```

## 🧪 Testing Guide

### 1. **Test WhatsApp Session Creation**

```bash
# Login first
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@unicx.com","password":"admin123"}'

# Create session
curl -X POST http://localhost:3000/api/v1/whatsapp/sessions \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

### 2. **Get QR Code**

```bash
curl -X GET http://localhost:3000/api/v1/whatsapp/sessions/SESSION_ID/qr \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3. **Send Test Message**

```bash
curl -X POST http://localhost:3000/api/v1/whatsapp/messages/send \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "YOUR_SESSION_ID",
    "to": "5511999999999@c.us",
    "message": "Hello from UNICX!"
  }'
```

## 📊 Features Implemented

### Backend:
✅ WhatsApp session management
✅ QR code generation and storage
✅ Message monitoring (incoming/outgoing)
✅ Status tracking (sent/delivered/read)
✅ Message persistence in database
✅ Pagination support
✅ Advanced filtering (direction, status, type, date range, search)
✅ Conversation grouping
✅ Auto-reconnect on disconnection
✅ Multi-session support (one per user/entity)

### Frontend (Implementation Required):
- Communication dashboard page
- Conversation sidebar
- Message display (chat interface)
- Filter controls
- Pagination controls
- Real-time updates (WebSocket recommended)
- QR code display modal
- Session status indicator

## 🚀 Deployment Checklist

- [ ] Install dependencies: `npm install whatsapp-web.js qrcode-terminal`
- [ ] Add WhatsAppModule to AppModule
- [ ] Update UsersService to create WhatsApp sessions on invite
- [ ] Update EmailService to send QR codes
- [ ] Create frontend communication page
- [ ] Add WhatsApp API methods to frontend API client
- [ ] Test session creation and QR code generation
- [ ] Test message sending and receiving
- [ ] Test pagination and filters
- [ ] Set up proper authentication data storage
- [ ] Configure production WhatsApp settings
- [ ] Set up monitoring and alerts
- [ ] Document user onboarding flow

## 📝 Notes

- QR codes expire after 60 seconds
- Each user/entity can have one active session
- Messages are stored indefinitely (configure cleanup job if needed)
- WhatsApp Web has rate limits - implement queueing for bulk messages
- Consider WebSocket for real-time message updates
- Encrypt session data before storing
- Monitor WhatsApp's terms of service compliance

## 🔒 Security Considerations

1. Encrypt WhatsApp session data
2. Implement rate limiting on message endpoints
3. Validate phone numbers (E.164 format)
4. Sanitize message content
5. Implement message retention policies
6. Audit log all WhatsApp activities
7. Secure QR code transmission
8. Implement session timeout

## 📚 Additional Resources

- [whatsapp-web.js Documentation](https://wwebjs.dev/)
- [WhatsApp Business API](https://developers.facebook.com/docs/whatsapp)
- [E.164 Phone Number Format](https://en.wikipedia.org/wiki/E.164)

