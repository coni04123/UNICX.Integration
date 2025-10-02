# UNICX Integration Backend - Complete Implementation Guide

## 📋 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Database Schema Details](#database-schema-details)
3. [API Endpoints Reference](#api-endpoints-reference)
4. [Authentication & Authorization](#authentication--authorization)
5. [Business Logic & Services](#business-logic--services)
6. [Background Jobs & Queues](#background-jobs--queues)
7. [Security Implementation](#security-implementation)
8. [Deployment Guide](#deployment-guide)
9. [Testing Strategy](#testing-strategy)
10. [Monitoring & Maintenance](#monitoring--maintenance)

---

## 🏗️ Architecture Overview

### Technology Stack

- **Framework**: NestJS 10.x (TypeScript)
- **Database**: Azure CosmosDB with MongoDB API
- **Cache & Queue**: Redis + Bull
- **Authentication**: JWT with refresh tokens
- **Email**: SMTP / SendGrid
- **File Storage**: Azure Blob Storage / AWS S3
- **Documentation**: Swagger/OpenAPI

### Project Structure

```
src/
├── common/
│   ├── audit/                 # Audit logging system
│   ├── database/              # Database configuration
│   ├── health/                # Health checks & monitoring
│   ├── queue/                 # Background job processors
│   ├── schemas/               # MongoDB schemas
│   ├── security/              # Security services (encryption, rate limiting)
│   └── validation/            # Custom validators
├── config/
│   ├── configuration.ts       # Environment configuration
│   └── validation.ts          # Environment validation schema
├── modules/
│   ├── auth/                  # Authentication & authorization
│   ├── entities/              # Hierarchical entity management
│   ├── users/                 # User management
│   ├── qr-codes/              # QR code & invitation system
│   ├── onboarding/            # Onboarding progress tracking
│   └── email/                 # Email service
├── templates/                 # Email templates (Handlebars)
├── app.module.ts              # Main application module
└── main.ts                    # Application bootstrap
```

---

## 🗄️ Database Schema Details

### 1. Entity Collection (`entities`)

**Purpose**: Manage hierarchical organizational structure

**Schema**:
```typescript
{
  _id: ObjectId,                    // Unique identifier
  name: string,                     // Entity name
  type: enum['entity', 'company', 'department'],
  parentId: ObjectId | null,        // Reference to parent entity
  path: string,                     // Full hierarchy path
  tenantId: string,                 // Multi-tenant isolation
  level: number,                    // Depth in hierarchy (0=root)
  metadata: Object,                 // Flexible additional data
  isActive: boolean,                // Soft delete flag
  createdBy: string,                // User ID who created
  updatedBy: string,                // User ID who last updated
  createdAt: Date,                  // Creation timestamp
  updatedAt: Date                   // Last update timestamp
}
```

**Indexes**:
- `{ tenantId: 1, isActive: 1 }` - Multi-tenant queries
- `{ parentId: 1 }` - Child lookups
- `{ path: 1 }` - Hierarchy queries
- `{ type: 1, tenantId: 1 }` - Type-based filtering
- `{ level: 1, tenantId: 1 }` - Level-based queries

**Business Rules**:
1. Root entities have `parentId: null` and `level: 0`
2. Path is automatically generated: "Entity X > Company C1 > Sales"
3. Circular references are prevented
4. Cannot delete entities with active children or users
5. Moving entities recalculates paths for all descendants

**Example**:
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "name": "Sales Department",
  "type": "department",
  "parentId": "507f1f77bcf86cd799439010",
  "path": "ACME Corp > North America > Sales Department",
  "tenantId": "tenant-123",
  "level": 2,
  "metadata": {
    "manager": "John Doe",
    "budget": 100000,
    "location": "New York"
  },
  "isActive": true,
  "createdBy": "user-123",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

---

### 2. User Collection (`users`)

**Purpose**: Complete user lifecycle management

**Schema**:
```typescript
{
  _id: ObjectId,
  phoneNumber: string,              // E164 format (unique)
  firstName: string,
  lastName: string,
  email: string,                    // Unique
  password: string,                 // Bcrypt hashed
  registrationStatus: enum['pending', 'invited', 'registered', 'cancelled'],
  role: enum['SystemAdmin', 'TenantAdmin', 'User'],
  entityId: ObjectId,               // Reference to entity
  entityPath: string,               // Denormalized for performance
  tenantId: string,
  whatsappConnectionStatus: enum['disconnected', 'connecting', 'connected', 'failed'],
  whatsappConnectedAt: Date,
  qrInvitationHistory: [{
    qrCodeId: string,
    sentAt: Date,
    attemptCount: number,
    scannedAt: Date,
    expiredAt: Date,
    isExpired: boolean
  }],
  preferences: {
    language: string,               // Default: 'en'
    timezone: string,               // Default: 'UTC'
    emailNotifications: boolean,
    pushNotifications: boolean,
    whatsappNotifications: boolean
  },
  avatar: string,                   // URL to avatar image
  initials: string,                 // Auto-generated
  isOnline: boolean,
  lastSeenAt: Date,
  isActive: boolean,
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes**:
- `{ phoneNumber: 1 }` - Unique index
- `{ email: 1 }` - Unique index
- `{ tenantId: 1, isActive: 1 }` - Multi-tenant queries
- `{ entityId: 1 }` - Entity-based lookups
- `{ registrationStatus: 1, tenantId: 1 }` - Status filtering
- `{ role: 1, tenantId: 1 }` - Role-based queries
- `{ whatsappConnectionStatus: 1 }` - WhatsApp status queries

**Business Rules**:
1. Phone number must be in E164 format (+1234567890)
2. Email must be unique per tenant
3. Initials are auto-generated from first and last name
4. Registration workflow: pending → invited → registered
5. Maximum retry attempts for QR invitations: 3
6. Users inherit permissions from their entity hierarchy

---

### 3. QR Invitation Collection (`qrinvitations`)

**Purpose**: Track QR code invitations and email delivery

**Schema**:
```typescript
{
  _id: ObjectId,
  qrCodeId: string,                 // Unique QR identifier
  encryptedPayload: string,         // Encrypted user data
  status: enum['pending', 'sent', 'scanned', 'expired', 'failed'],
  userId: ObjectId,                 // Reference to user
  tenantId: string,
  email: string,
  expiresAt: Date,
  emailDelivery: {
    sentAt: Date,
    attemptCount: number,
    deliveredAt: Date,
    bouncedAt: Date,
    complaintAt: Date,
    errorMessage: string,
    providerMessageId: string,
    isDelivered: boolean,
    isBounced: boolean,
    isComplaint: boolean
  },
  scanEvents: [{
    scannedAt: Date,
    ipAddress: string,
    userAgent: string,
    deviceInfo: string,
    location: string
  }],
  templateId: string,
  templateData: Object,
  isActive: boolean,
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes**:
- `{ qrCodeId: 1 }` - Unique index
- `{ userId: 1 }` - User lookups
- `{ tenantId: 1, isActive: 1 }` - Multi-tenant queries
- `{ status: 1, tenantId: 1 }` - Status filtering
- `{ expiresAt: 1 }` - TTL index for automatic cleanup
- `{ email: 1 }` - Email lookups

**Business Rules**:
1. QR codes expire after 24 hours (configurable)
2. Maximum 3 scan attempts per invitation
3. Automatic cleanup of expired invitations
4. Email delivery tracking with retry logic
5. IP and user agent logging for security

---

### 4. Onboarding Progress Collection (`onboardingprogress`)

**Purpose**: Track tenant onboarding steps

**Schema**:
```typescript
{
  _id: ObjectId,
  tenantId: string,
  adminUserId: ObjectId,
  adminUserName: string,
  steps: [{
    stepId: string,
    stepName: string,
    stepDescription: string,
    status: enum['not_started', 'in_progress', 'completed', 'skipped', 'failed'],
    stepData: Object,
    startedAt: Date,
    completedAt: Date,
    estimatedDuration: number,      // Minutes
    actualDuration: number,         // Minutes
    prerequisites: [string],        // Array of stepIds
    isOptional: boolean,
    validationErrors: [string]
  }],
  progressPercentage: number,       // Auto-calculated
  startedAt: Date,
  estimatedCompletionAt: Date,
  completedAt: Date,
  isCompleted: boolean,
  isReset: boolean,
  resetAt: Date,
  resetBy: string,
  metadata: Object,
  isActive: boolean,
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes**:
- `{ tenantId: 1, isActive: 1 }` - Multi-tenant queries
- `{ adminUserId: 1 }` - Admin lookups
- `{ isCompleted: 1, tenantId: 1 }` - Completion filtering

**Business Rules**:
1. Progress percentage auto-calculated from completed steps
2. Prerequisites must be completed before starting dependent steps
3. Supports optional steps that don't affect progress
4. Can be reset and restarted
5. Tracks actual vs estimated duration

---

### 5. Audit Log Collection (`auditlogs`)

**Purpose**: Comprehensive activity tracking for compliance

**Schema**:
```typescript
{
  _id: ObjectId,
  userId: string,
  userEmail: string,
  tenantId: string,
  action: enum['create', 'read', 'update', 'delete', 'login', 'logout', 'invite', 'scan', 'reset'],
  resource: string,                 // Entity type (users, entities, etc.)
  resourceId: string,               // Specific resource ID
  oldValues: Object,                // Previous state
  newValues: Object,                // New state
  ipAddress: string,
  userAgent: string,
  endpoint: string,                 // API endpoint
  method: string,                   // HTTP method
  metadata: Object,
  createdAt: Date
}
```

**Indexes**:
- `{ userId: 1, createdAt: -1 }` - User activity queries
- `{ tenantId: 1, createdAt: -1 }` - Tenant activity queries
- `{ action: 1, createdAt: -1 }` - Action-based queries
- `{ resource: 1, resourceId: 1 }` - Resource audit trail
- `{ createdAt: -1 }` - Time-based queries

**Business Rules**:
1. All data modifications are logged
2. Sensitive data (passwords) is redacted
3. Retention period: 90 days (configurable)
4. Cannot be modified or deleted (immutable)

---

## 🔐 Authentication & Authorization

### JWT Token Structure

**Access Token**:
```json
{
  "sub": "user-id",
  "email": "user@example.com",
  "role": "TenantAdmin",
  "tenantId": "tenant-123",
  "entityId": "entity-456",
  "iat": 1234567890,
  "exp": 1234654290
}
```

**Refresh Token**: Same structure with longer expiration (7 days)

### Authentication Flow

1. **Login**: POST `/api/v1/auth/login`
   - Validates email/password
   - Returns access token + refresh token
   - Creates audit log entry

2. **Token Refresh**: POST `/api/v1/auth/refresh`
   - Validates refresh token
   - Issues new access token
   - Extends session

3. **Logout**: POST `/api/v1/auth/logout`
   - Invalidates tokens (future enhancement: token blacklist)
   - Creates audit log entry

### Authorization Levels

**1. SystemAdmin**
- Full access to all tenants
- Can create/modify/delete any resource
- Access to system-wide statistics
- Can impersonate other users (with audit trail)

**2. TenantAdmin**
- Full access within their tenant
- Can manage entities and users
- Can invite new users
- Cannot access other tenants

**3. User**
- Read access to their entity and sub-entities
- Can update their own profile
- Can view assigned resources
- Cannot manage other users

### Guards Implementation

**JwtAuthGuard**: Validates JWT token
**RolesGuard**: Checks user role
**TenantGuard**: Enforces tenant isolation

**Usage Example**:
```typescript
@UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
@Roles(UserRole.SYSTEM_ADMIN, UserRole.TENANT_ADMIN)
@RequireTenant()
@Post('entities')
async createEntity(@Body() dto: CreateEntityDto) {
  // Only SystemAdmin and TenantAdmin can create entities
  // Tenant isolation is enforced
}
```

---

## 📡 API Endpoints Reference

### Authentication Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/v1/auth/login` | User login | No |
| POST | `/api/v1/auth/refresh` | Refresh access token | No |
| POST | `/api/v1/auth/logout` | User logout | Yes |

### Entity Management Endpoints

| Method | Endpoint | Description | Auth Required | Roles |
|--------|----------|-------------|---------------|-------|
| POST | `/api/v1/entities` | Create entity | Yes | Admin |
| GET | `/api/v1/entities` | List entities | Yes | All |
| GET | `/api/v1/entities/:id` | Get entity | Yes | All |
| PATCH | `/api/v1/entities/:id` | Update entity | Yes | Admin |
| DELETE | `/api/v1/entities/:id` | Delete entity | Yes | Admin |
| GET | `/api/v1/entities/hierarchy` | Get hierarchy | Yes | All |
| PATCH | `/api/v1/entities/:id/move` | Move entity | Yes | Admin |
| GET | `/api/v1/entities/stats` | Get statistics | Yes | All |

### User Management Endpoints

| Method | Endpoint | Description | Auth Required | Roles |
|--------|----------|-------------|---------------|-------|
| POST | `/api/v1/users` | Create user | Yes | Admin |
| POST | `/api/v1/users/invite` | Invite user | Yes | Admin |
| POST | `/api/v1/users/bulk-invite` | Bulk invite | Yes | Admin |
| GET | `/api/v1/users` | List users | Yes | All |
| GET | `/api/v1/users/:id` | Get user | Yes | All |
| PATCH | `/api/v1/users/:id` | Update user | Yes | Admin |
| DELETE | `/api/v1/users/:id` | Delete user | Yes | Admin |
| GET | `/api/v1/users/stats` | Get statistics | Yes | All |
| GET | `/api/v1/users/search?q=` | Search users | Yes | All |

### QR Code & Invitation Endpoints

| Method | Endpoint | Description | Auth Required | Roles |
|--------|----------|-------------|---------------|-------|
| POST | `/api/v1/qr-codes/invitations` | Create invitation | Yes | Admin |
| POST | `/api/v1/qr-codes/invitations/bulk` | Bulk create | Yes | Admin |
| POST | `/api/v1/qr-codes/scan` | Scan QR code | No | Public |
| GET | `/api/v1/qr-codes/invitations` | List invitations | Yes | All |
| GET | `/api/v1/qr-codes/invitations/:id` | Get invitation | Yes | All |
| POST | `/api/v1/qr-codes/invitations/:id/resend` | Resend invitation | Yes | Admin |
| DELETE | `/api/v1/qr-codes/invitations/:id` | Cancel invitation | Yes | Admin |
| GET | `/api/v1/qr-codes/invitations/stats` | Get statistics | Yes | All |

### Onboarding Endpoints

| Method | Endpoint | Description | Auth Required | Roles |
|--------|----------|-------------|---------------|-------|
| POST | `/api/v1/onboarding/progress` | Create progress | Yes | Admin |
| GET | `/api/v1/onboarding/progress` | List progress | Yes | All |
| GET | `/api/v1/onboarding/progress/:id` | Get progress | Yes | All |
| PATCH | `/api/v1/onboarding/progress/:id/steps/:stepId` | Update step | Yes | Admin |
| POST | `/api/v1/onboarding/progress/:id/steps` | Add step | Yes | Admin |
| DELETE | `/api/v1/onboarding/progress/:id/steps/:stepId` | Remove step | Yes | Admin |
| POST | `/api/v1/onboarding/progress/:id/reset` | Reset progress | Yes | Admin |
| GET | `/api/v1/onboarding/progress/stats` | Get statistics | Yes | All |

### Health & Monitoring Endpoints

| Method | Endpoint | Description | Auth Required | Roles |
|--------|----------|-------------|---------------|-------|
| GET | `/health` | Health check | No | Public |
| GET | `/health/metrics` | System metrics | Yes | SystemAdmin |

---

## 🛠️ Business Logic & Services

### Entity Service

**Key Methods**:

1. **create(dto, userId)**: Creates new entity
   - Validates parent exists (if provided)
   - Prevents circular references
   - Generates path automatically
   - Calculates hierarchy level

2. **move(id, newParentId, userId)**: Moves entity
   - Validates new parent
   - Prevents circular references
   - Recalculates paths for all descendants
   - Updates hierarchy levels

3. **remove(id, userId)**: Soft deletes entity
   - Checks for child entities
   - Checks for active users
   - Fails if dependencies exist

**Performance Optimizations**:
- Indexed queries for fast lookups
- Denormalized path for hierarchy queries
- Caching for frequently accessed entities
- Batch operations for bulk updates

---

### User Service

**Key Methods**:

1. **create(dto, createdBy)**: Creates new user
   - Validates E164 phone number format
   - Checks for duplicates (phone/email)
   - Validates entity exists
   - Hashes password
   - Auto-generates initials

2. **inviteUser(dto, invitedBy)**: Invites new user
   - Creates user with 'invited' status
   - Generates temporary password
   - Queues QR code generation
   - Queues invitation email

3. **bulkInviteUsers(dto, invitedBy)**: Bulk invite
   - Processes invitations in parallel
   - Returns success/failure counts
   - Logs all errors for review

**E164 Validation**:
```typescript
import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';

if (!isValidPhoneNumber(phoneNumber)) {
  throw new BadRequestException('Invalid phone number format');
}

const parsedPhone = parsePhoneNumber(phoneNumber);
const e164Phone = parsedPhone.format('E.164'); // +1234567890
```

---

### QR Code Service

**Key Methods**:

1. **createInvitation(dto, createdBy)**: Creates QR invitation
   - Validates user exists
   - Checks for pending invitations
   - Generates unique QR code ID
   - Encrypts payload
   - Queues QR generation job
   - Queues email job

2. **scanQRCode(dto)**: Processes QR scan
   - Validates QR code exists
   - Checks expiration
   - Prevents duplicate scans
   - Logs scan event (IP, user agent)
   - Updates user registration status

3. **encryptQRData(data)**: Encrypts QR payload
   ```typescript
   const algorithm = 'aes-256-gcm';
   const key = crypto.scryptSync(encryptionKey, 'salt', 32);
   const iv = crypto.randomBytes(16);
   const cipher = crypto.createCipher(algorithm, key);
   // ... encryption logic
   ```

**QR Code Format**:
```json
{
  "qrCodeId": "uuid-v4",
  "tenantId": "tenant-123",
  "timestamp": 1234567890000
}
```

---

### Email Service

**Supported Providers**:
1. **SMTP** (Gmail, Office365, etc.)
2. **SendGrid** (recommended for production)

**Template System**:
- Uses Handlebars for templating
- Supports multi-language
- Includes responsive design
- Variables: `{{firstName}}`, `{{qrCodeImage}}`, etc.

**Key Methods**:

1. **sendInvitationEmail(email, templateId, data)**
   - Loads template
   - Compiles with data
   - Sends via configured provider
   - Tracks delivery status

2. **sendBulkEmails(emails)**
   - Processes in batches
   - Implements rate limiting
   - Returns success/failure stats

---

## ⚡ Background Jobs & Queues

### Queue Configuration

**Email Queue**: Handles all email sending
- Retry: 3 attempts with exponential backoff
- Priority: High for transactional, low for marketing
- Concurrency: 10 jobs in parallel

**QR Code Queue**: Handles QR generation
- Retry: 2 attempts
- Priority: Medium
- Concurrency: 5 jobs in parallel

**WhatsApp Queue**: Handles WhatsApp messages
- Retry: 3 attempts
- Priority: High
- Concurrency: 10 jobs in parallel

**Cleanup Queue**: Scheduled maintenance
- Runs daily at 2 AM
- No retries
- Single job at a time

### Job Processors

**Email Processor** (`email.processor.ts`):
```typescript
@Process('send-invitation')
async handleSendInvitation(job: Job<EmailJobData>) {
  // Update status to 'sent'
  // Send email via service
  // Update delivery status
  // Handle failures
}
```

**QR Code Processor** (`qr-code.processor.ts`):
```typescript
@Process('generate-qr')
async handleGenerateQR(job: Job<QRCodeJobData>) {
  // Generate unique QR ID
  // Encrypt payload
  // Generate QR image
  // Update invitation record
}
```

**Cleanup Processor** (`cleanup.processor.ts`):
```typescript
@Process('cleanup-expired-qr-codes')
async handleCleanupExpiredQRCodes(job: Job) {
  // Find expired QR codes
  // Delete old records
  // Log cleanup stats
}
```

### Scheduled Jobs

**Cron Configuration**:
```typescript
import { Cron, CronExpression } from '@nestjs/schedule';

@Cron(CronExpression.EVERY_DAY_AT_2AM)
async cleanupExpiredQRCodes() {
  await this.qrCodeService.cleanupExpiredInvitations();
}

@Cron(CronExpression.EVERY_WEEK)
async cleanupOldAuditLogs() {
  await this.auditService.cleanupOldLogs(90);
}
```

---

## 🔒 Security Implementation

### Input Validation

**Class Validator** decorators on all DTOs:
```typescript
export class CreateUserDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @MinLength(6)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,}$/)
  password: string;

  @IsPhoneNumber()
  phoneNumber: string;
}
```

### NoSQL Injection Prevention

**Sanitization middleware**:
```typescript
// Automatically applied via ValidationPipe
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,              // Strip unknown properties
    forbidNonWhitelisted: true,   // Throw error on unknown properties
    transform: true,               // Transform to DTO class instances
  }),
);
```

### Rate Limiting

**IP-based and user-based limits**:
```typescript
// Global rate limit: 100 requests per minute
@ThrottlerGuard({
  ttl: 60,
  limit: 100,
})

// Auth endpoints: 5 requests per 15 minutes
@ThrottlerGuard({
  ttl: 900,
  limit: 5,
})
```

### Data Encryption

**Encryption Service**:
- Algorithm: AES-256-GCM
- Key derivation: scrypt
- Used for: QR payloads, sensitive user data
- Automatic encryption/decryption

**Password Hashing**:
- Algorithm: bcrypt
- Rounds: 12 (configurable)
- Salt: Automatically generated

### CORS Configuration

**Production-ready CORS**:
```typescript
app.enableCors({
  origin: ['https://app.unicx.com', 'https://admin.unicx.com'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID'],
});
```

### Audit Logging

**Automatic audit trail** for:
- All data modifications
- Authentication events
- Administrative actions
- Failed access attempts

**Audit Middleware** captures:
- User identity
- Action performed
- Resource affected
- Old and new values
- IP address & user agent
- Timestamp

---

## 🚀 Deployment Guide

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- Azure CosmosDB account
- Redis instance
- SMTP/SendGrid account

### Environment Setup

1. **Copy environment file**:
   ```bash
   cp env.example .env
   ```

2. **Configure Azure CosmosDB**:
   ```bash
   COSMOS_DB_CONNECTION_STRING=mongodb://your-account:your-key@your-account.mongo.cosmos.azure.com:10255/?ssl=true&replicaSet=globaldb
   COSMOS_DB_NAME=unicx-integration
   ```

3. **Configure Redis**:
   ```bash
   REDIS_HOST=your-redis-host
   REDIS_PORT=6379
   REDIS_PASSWORD=your-redis-password
   ```

4. **Configure Email**:
   ```bash
   EMAIL_PROVIDER=sendgrid
   SENDGRID_API_KEY=your-sendgrid-api-key
   ```

### Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run start:dev

# The API will be available at http://localhost:3000
# Swagger docs at http://localhost:3000/api/docs
```

### Docker Deployment

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop services
docker-compose down
```

### Production Deployment (Azure)

**1. Create Azure Resources**:
```bash
# Resource Group
az group create --name unicx-rg --location eastus

# CosmosDB
az cosmosdb create \
  --name unicx-cosmos \
  --resource-group unicx-rg \
  --kind MongoDB \
  --server-version 4.2

# Container Instances
az container create \
  --resource-group unicx-rg \
  --name unicx-app \
  --image unicxacr.azurecr.io/unicx-backend:latest \
  --dns-name-label unicx-api \
  --ports 3000
```

**2. Configure Application Settings**:
- Set all environment variables in Azure Container Instances
- Enable managed identity for Azure services
- Configure custom domain and SSL

**3. Set up CI/CD**:
```yaml
# .github/workflows/deploy.yml
name: Deploy to Azure
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Build and push Docker image
        # ... build steps
      - name: Deploy to Azure
        # ... deployment steps
```

---

## 🧪 Testing Strategy

### Unit Tests

```bash
# Run unit tests
npm run test

# Run with coverage
npm run test:cov
```

**Example unit test**:
```typescript
describe('UserService', () => {
  it('should validate E164 phone numbers', async () => {
    const service = new UserService();
    expect(() => service.validatePhone('+1234567890')).not.toThrow();
    expect(() => service.validatePhone('1234567890')).toThrow();
  });
});
```

### Integration Tests

```bash
# Run e2e tests
npm run test:e2e
```

**Example e2e test**:
```typescript
describe('/api/v1/auth (e2e)', () => {
  it('should login with valid credentials', () => {
    return request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'test@test.com', password: 'password123' })
      .expect(200)
      .expect((res) => {
        expect(res.body.access_token).toBeDefined();
      });
  });
});
```

### Load Testing

```bash
# Using Apache Bench
ab -n 1000 -c 10 http://localhost:3000/api/v1/entities

# Using Artillery
artillery quick --count 100 --num 10 http://localhost:3000/api/v1/entities
```

---

## 📊 Monitoring & Maintenance

### Health Checks

**Endpoint**: `/health`

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "services": {
    "database": { "status": "healthy", "responseTime": 15 },
    "email": { "status": "healthy", "responseTime": 25 },
    "redis": { "status": "healthy", "responseTime": 5 },
    "memory": { "status": "healthy", "usagePercentage": "45%" }
  },
  "uptime": 3600000,
  "version": "1.0.0"
}
```

### Logging

**Winston logger** with multiple transports:
- Console (development)
- File (production)
- Sentry (errors only)

**Log levels**:
- `error`: Critical errors
- `warn`: Warning messages
- `info`: General information
- `debug`: Detailed debugging

### Metrics

**System metrics** available at `/health/metrics`:
- Memory usage
- CPU usage
- Request rate
- Response time
- Error rate

### Maintenance Tasks

**Daily**:
- Cleanup expired QR codes
- Process failed email queue
- Archive old logs

**Weekly**:
- Cleanup old audit logs
- Generate usage reports
- Check database indexes

**Monthly**:
- Review security audit logs
- Update dependencies
- Performance optimization review

---

## 📖 Additional Resources

### API Testing

**Postman Collection**: Import from `/postman/unicx-api.json`

**Sample cURL commands**:
```bash
# Login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@unicx.com","password":"password123"}'

# Create Entity
curl -X POST http://localhost:3000/api/v1/entities \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"name":"Sales Dept","type":"department","tenantId":"tenant-123"}'
```

### Troubleshooting

**Common Issues**:

1. **Database Connection Fails**
   - Check CosmosDB connection string
   - Verify firewall rules
   - Check network connectivity

2. **Email Not Sending**
   - Verify SMTP/SendGrid credentials
   - Check email queue status
   - Review email service logs

3. **QR Codes Not Generating**
   - Check Redis connection
   - Verify queue processor is running
   - Review QR service logs

### Performance Tuning

**Database Optimization**:
- Create proper indexes
- Use projection to limit fields
- Implement caching layer
- Use aggregation pipelines

**API Optimization**:
- Enable response compression
- Implement request caching
- Use pagination for large datasets
- Optimize database queries

---

## 🤝 Contributing

### Code Style

- Follow NestJS best practices
- Use TypeScript strict mode
- Write comprehensive tests
- Document complex logic

### Pull Request Process

1. Create feature branch
2. Implement changes
3. Write tests
4. Update documentation
5. Submit PR for review

---

## 📄 License

This project is licensed under the MIT License.

---

**Last Updated**: January 2024
**Version**: 1.0.0
**Maintained By**: UNICX Development Team


