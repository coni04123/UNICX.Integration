# External Numbers Feature Documentation

## Overview

The External Numbers feature allows analysts to identify and distinguish messages from unregistered E164 phone numbers (external interlocutors) from registered users within the system.

## Feature Description

**As an analyst, I want to identify messages with unregistered E164 numbers so that I can distinguish external interlocutors.**

### Scenario: External Tag
- **Given** a conversation with unregistered E164
- **When** the message is displayed  
- **Then** it must show the tag "External"

## Implementation Details

### 1. Database Schema Changes

#### Message Schema Updates
```typescript
// Added to Message schema
@Prop({ default: false })
isExternalNumber: boolean; // True if sender is not a registered user

@Prop({ type: String })
externalSenderName: string; // Display name for external senders

@Prop({ type: String })
externalSenderPhone: string; // Cleaned phone number for external senders
```

#### Database Indexes
```typescript
// Added indexes for performance
MessageSchema.index({ isExternalNumber: 1, tenantId: 1 });
MessageSchema.index({ externalSenderPhone: 1 });
```

### 2. WhatsApp Service Updates

#### External Number Detection Logic
```typescript
// Check if sender is a registered user
const cleanedPhoneNumber = this.cleanPhoneNumber(message.from);
const registeredUser = await this.checkIfRegisteredUser(cleanedPhoneNumber, session.tenantId);
const contactInfo = await this.getContactInfo(message);

const isExternalNumber = !registeredUser;
const externalSenderName = isExternalNumber ? contactInfo.name : null;
const externalSenderPhone = isExternalNumber ? cleanedPhoneNumber : null;
```

#### Helper Methods Added
- `checkIfRegisteredUser()` - Checks if phone number belongs to registered user
- `getContactInfo()` - Extracts contact information from WhatsApp
- `cleanPhoneNumber()` - Formats phone numbers to E164 standard

### 3. API Endpoints

#### Updated Messages Endpoint
```
GET /api/v1/whatsapp/messages?isExternal=true
```

**Query Parameters:**
- `isExternal` (boolean) - Filter by external numbers (true/false)

#### New External Messages Endpoint
```
GET /api/v1/whatsapp/messages/external
```

**Query Parameters:**
- `page` (number) - Page number
- `limit` (number) - Items per page  
- `search` (string) - Search in message content
- `startDate` (string) - Start date filter
- `endDate` (string) - End date filter

### 4. Message Response Format

#### Updated Message Object
```json
{
  "whatsappMessageId": "string",
  "from": "string",
  "to": "string", 
  "content": "string",
  "isExternalNumber": true,
  "externalSenderName": "John Doe",
  "externalSenderPhone": "+1234567890",
  "userId": null,
  "metadata": {
    "senderContactName": "John Doe",
    "senderContactPhone": "+1234567890", 
    "isExternalSender": true,
    "registeredUserInfo": null
  }
}
```

## Usage Examples

### 1. Get All External Messages
```bash
curl -X GET "http://localhost:3000/api/v1/whatsapp/messages/external" \
  -H "Authorization: Bearer <token>"
```

### 2. Filter Messages by External Status
```bash
# Get only external messages
curl -X GET "http://localhost:3000/api/v1/whatsapp/messages?isExternal=true" \
  -H "Authorization: Bearer <token>"

# Get only registered user messages  
curl -X GET "http://localhost:3000/api/v1/whatsapp/messages?isExternal=false" \
  -H "Authorization: Bearer <token>"
```

### 3. Search External Messages
```bash
curl -X GET "http://localhost:3000/api/v1/whatsapp/messages/external?search=urgent&page=1&limit=10" \
  -H "Authorization: Bearer <token>"
```

## Frontend Integration

### Message Display Component
```typescript
interface MessageDisplayProps {
  message: {
    isExternalNumber: boolean;
    externalSenderName?: string;
    userId?: string;
    // ... other message properties
  };
}

const MessageDisplay: React.FC<MessageDisplayProps> = ({ message }) => {
  return (
    <div className="message">
      <div className="message-header">
        {message.isExternalNumber ? (
          <span className="external-tag">External</span>
        ) : (
          <span className="registered-tag">Registered</span>
        )}
        <span className="sender-name">
          {message.isExternalNumber 
            ? message.externalSenderName 
            : message.userId?.firstName + ' ' + message.userId?.lastName
          }
        </span>
      </div>
      <div className="message-content">
        {message.content}
      </div>
    </div>
  );
};
```

### External Messages Filter
```typescript
const MessageFilters: React.FC = () => {
  const [showExternalOnly, setShowExternalOnly] = useState(false);
  
  const fetchMessages = () => {
    const params = showExternalOnly ? { isExternal: 'true' } : {};
    // Fetch messages with filters
  };
  
  return (
    <div className="filters">
      <label>
        <input 
          type="checkbox" 
          checked={showExternalOnly}
          onChange={(e) => setShowExternalOnly(e.target.checked)}
        />
        Show External Messages Only
      </label>
    </div>
  );
};
```

## Business Logic

### External Number Detection Rules
1. **Phone Number Validation**: All phone numbers are cleaned and formatted to E164 standard
2. **User Lookup**: System checks if phone number exists in registered users within the same tenant
3. **Contact Information**: For external numbers, system extracts contact name from WhatsApp
4. **Tagging**: Messages are automatically tagged as external or registered

### Performance Considerations
- **Database Indexes**: Added indexes on `isExternalNumber` and `externalSenderPhone` for fast queries
- **Caching**: User lookups could be cached for better performance
- **Batch Processing**: External number detection happens during message processing

## Security & Privacy

### Data Protection
- **Phone Number Privacy**: External phone numbers are stored securely
- **Contact Information**: Only basic contact info (name, phone) is stored
- **Tenant Isolation**: External number detection is scoped to tenant

### Access Control
- **Role-Based Access**: External message filtering respects user roles
- **Tenant Boundaries**: Users can only see external messages within their tenant

## Monitoring & Analytics

### Metrics to Track
- **External Message Count**: Number of messages from external numbers
- **External Contact Count**: Number of unique external contacts
- **Response Rate**: Response rate to external messages
- **Conversion Rate**: Rate of external contacts becoming registered users

### Logging
```typescript
// Log external number detection
this.logger.log(`Message from ${cleanedPhoneNumber}: ${isExternalNumber ? 'EXTERNAL' : 'REGISTERED'} - ${contactInfo.name}`);
```

## Testing

### Unit Tests
```typescript
describe('External Number Detection', () => {
  it('should detect external number correctly', async () => {
    const phoneNumber = '+1234567890';
    const tenantId = new Types.ObjectId();
    
    // Mock no registered user found
    jest.spyOn(userModel, 'findOne').mockResolvedValue(null);
    
    const result = await whatsappService.checkIfRegisteredUser(phoneNumber, tenantId);
    expect(result).toBeNull();
  });
  
  it('should detect registered user correctly', async () => {
    const phoneNumber = '+1234567890';
    const tenantId = new Types.ObjectId();
    const mockUser = { _id: 'user123', firstName: 'John', lastName: 'Doe' };
    
    jest.spyOn(userModel, 'findOne').mockResolvedValue(mockUser);
    
    const result = await whatsappService.checkIfRegisteredUser(phoneNumber, tenantId);
    expect(result).toEqual(mockUser);
  });
});
```

### Integration Tests
```typescript
describe('External Messages API', () => {
  it('should return only external messages', async () => {
    const response = await request(app)
      .get('/api/v1/whatsapp/messages/external')
      .set('Authorization', `Bearer ${token}`);
      
    expect(response.status).toBe(200);
    expect(response.body.messages.every(msg => msg.isExternalNumber)).toBe(true);
  });
});
```

## Future Enhancements

### Potential Improvements
1. **Contact Management**: Allow users to add external contacts to address book
2. **Auto-Response**: Automatic responses to external messages
3. **Contact Import**: Import external contacts from WhatsApp
4. **Analytics Dashboard**: Dedicated dashboard for external message analytics
5. **Integration**: Integration with CRM systems for external contact management

### Configuration Options
```typescript
// Future configuration options
interface ExternalNumberConfig {
  autoTagExternal: boolean;
  storeContactInfo: boolean;
  allowExternalReplies: boolean;
  externalMessageRetention: number; // days
}
```

## Troubleshooting

### Common Issues

#### 1. External Numbers Not Detected
**Problem**: Messages from external numbers not tagged as external
**Solution**: 
- Check if phone number format is correct (E164)
- Verify user lookup query is working
- Check tenant isolation logic

#### 2. Performance Issues
**Problem**: Slow queries when filtering external messages
**Solution**:
- Verify database indexes are created
- Check query optimization
- Consider caching user lookups

#### 3. Missing Contact Information
**Problem**: External sender names showing as "Unknown"
**Solution**:
- Check WhatsApp contact API integration
- Verify contact information extraction logic
- Handle edge cases in contact name parsing

## API Reference

### GET /api/v1/whatsapp/messages/external
Get messages from external (unregistered) numbers only.

**Query Parameters:**
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 20)
- `search` (string, optional): Search in message content
- `startDate` (string, optional): Start date filter (ISO format)
- `endDate` (string, optional): End date filter (ISO format)

**Response:**
```json
{
  "messages": [
    {
      "whatsappMessageId": "string",
      "from": "string",
      "content": "string",
      "isExternalNumber": true,
      "externalSenderName": "string",
      "externalSenderPhone": "string",
      "createdAt": "2023-01-01T00:00:00.000Z"
    }
  ],
  "total": 100,
  "page": 1,
  "limit": 20,
  "totalPages": 5
}
```

### GET /api/v1/whatsapp/messages?isExternal=true
Filter messages by external status.

**Query Parameters:**
- `isExternal` (boolean): Filter by external numbers (true/false)
- All other standard message query parameters

**Response:** Standard message response format with external number information included.
