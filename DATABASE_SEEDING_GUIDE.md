# 🌱 Database Seeding Guide

## Overview

This guide provides comprehensive instructions for seeding the UNICX Integration Backend database with sample data for development, testing, and demonstration purposes.

## 📋 What Gets Seeded

### 🏢 Organizational Entities (8 entities)
- **UNICX Corporation** (Root Company)
- **Engineering** (Department)
  - Frontend Team
  - Backend Team  
  - DevOps Team
- **Sales** (Department)
- **Marketing** (Department)
- **Human Resources** (Department)

### 👥 Users (10 users)
- **System Admin**: Full system access
- **Tenant Admin**: Tenant-level administration
- **Engineering Manager**: Department head
- **Frontend Developer**: Team member
- **Backend Developer**: Team member
- **Sales Manager**: Department head
- **Marketing Specialist**: Team member
- **HR Manager**: Department head
- **Pending User**: Registration in progress
- **Invited User**: Invitation sent, awaiting registration

### 📱 QR Invitations (3 invitations)
- **Entity QR**: Company welcome invitation
- **User QR**: Engineering team invitation
- **Custom QR**: Event invitation (expired example)

### 📋 Onboarding Progress (2 workflows)
- **In Progress**: Frontend developer (50% complete)
- **Completed**: Backend developer (100% complete)

---

## 🚀 Quick Start

### Prerequisites

1. **Database Connection**: Ensure your MongoDB/CosmosDB is accessible
2. **Environment Configuration**: Set up your `.env` file
3. **Application Built**: Run `npm run build` (for JS version)

### Basic Seeding

```bash
# Seed with sample data (preserves existing data)
npm run seed

# Clean seed (removes all existing data first)
npm run seed:clean
```

### Alternative Commands

```bash
# TypeScript version (requires ts-node)
npm run seed
npm run seed:clean

# JavaScript version (faster, requires build)
npm run seed:js
npm run seed:js:clean

# Manual execution
npx ts-node -r tsconfig-paths/register scripts/seed-database.ts
node scripts/seed-database.js
```

---

## 🔧 Configuration

### Environment Variables

The seeding script uses the same environment variables as the main application:

```env
# Database Connection (choose one)
MONGODB_URI=mongodb://localhost:27017/unicx-integration
# OR
COSMOS_DB_CONNECTION_STRING=mongodb://your-account:key@your-account.mongo.cosmos.azure.com:10255/?ssl=true
COSMOS_DB_NAME=unicx-integration

# Authentication (for password hashing)
BCRYPT_ROUNDS=12

# Tenant ID (for multi-tenancy)
# Default: seed-tenant-001
```

### Custom Tenant ID

To use a different tenant ID, modify `scripts/seed-database.ts`:

```typescript
// Change this line
const TENANT_ID = 'your-custom-tenant-id';
```

---

## 📊 Detailed Seed Data

### Entity Hierarchy

```
UNICX Corporation (Company, Level 0)
├── Engineering (Department, Level 1)
│   ├── Frontend Team (Department, Level 2)
│   ├── Backend Team (Department, Level 2)
│   └── DevOps Team (Department, Level 2)
├── Sales (Department, Level 1)
├── Marketing (Department, Level 1)
└── Human Resources (Department, Level 1)
```

### User Details

| Email | Role | Password | Phone | Status | WhatsApp |
|-------|------|----------|-------|--------|----------|
| admin@unicx.com | SystemAdmin | admin123 | +1234567890 | Registered | Connected |
| tenant.admin@unicx.com | TenantAdmin | tenant123 | +1234567891 | Registered | Connected |
| engineering.manager@unicx.com | User | eng123 | +1234567892 | Registered | Connected |
| frontend.dev@unicx.com | User | frontend123 | +1234567893 | Registered | Connected |
| backend.dev@unicx.com | User | backend123 | +1234567894 | Registered | Connected |
| sales.manager@unicx.com | User | sales123 | +1234567895 | Registered | Connected |
| marketing.specialist@unicx.com | User | marketing123 | +1234567896 | Registered | Connected |
| hr.manager@unicx.com | User | hr123 | +1234567897 | Registered | Connected |
| pending.user@unicx.com | User | pending123 | +1234567898 | Pending | Not Connected |
| invited.user@unicx.com | User | - | +1234567899 | Invited | Not Connected |

### QR Invitation Details

#### 1. Entity QR Invitation
- **Type**: Entity
- **Entity**: UNICX Corporation
- **Status**: Active
- **Expiry**: 24 hours from creation
- **Usage**: 0/100
- **Data**: Welcome message

#### 2. User QR Invitation
- **Type**: User
- **User**: Engineering Manager
- **Entity**: Engineering Department
- **Status**: Active
- **Expiry**: 48 hours from creation
- **Usage**: 5/50
- **Data**: Team welcome message

#### 3. Custom QR Invitation
- **Type**: Custom Data
- **Status**: Expired
- **Event**: Company All-Hands Meeting
- **Usage**: 150/200
- **Data**: Event details (date, location, description)

### Onboarding Progress Details

#### Frontend Developer (In Progress - 50%)
1. **Welcome to UNICX** ✅ Completed
   - Duration: 15 minutes (estimated: 30)
   - Completed: 1 hour ago

2. **Profile Setup** 🔄 In Progress
   - Progress: 60%
   - Current step: Upload photo
   - Started: 30 minutes ago

3. **Team Introduction** ⏳ Not Started
   - Prerequisites: Profile Setup
   - Optional: Yes

#### Backend Developer (Completed - 100%)
1. **Welcome to UNICX** ✅ Completed
   - Duration: 20 minutes (estimated: 30)
   - Completed: 2 hours ago

2. **Profile Setup** ✅ Completed
   - Duration: 30 minutes (estimated: 45)
   - Completed: 1 hour ago

3. **Team Introduction** ✅ Completed
   - Duration: 45 minutes (estimated: 60)
   - Team members: John Doe, Jane Smith
   - Completed: 30 minutes ago

---

## 🛠️ Customization

### Adding More Entities

Edit `scripts/seed-database.ts` and add to the `entitiesData` array:

```typescript
const entitiesData = [
  // ... existing entities
  {
    name: 'Your Department',
    type: EntityType.DEPARTMENT,
    description: 'Your department description',
    parentId: null, // Will be set automatically
    path: 'UNICX Corporation/Your Department',
    level: 1,
    isActive: true,
    tenantId: TENANT_ID,
    createdBy: 'system',
    createdAt: now,
    updatedAt: now,
  },
];
```

### Adding More Users

Add to the `usersData` array:

```typescript
const usersData = [
  // ... existing users
  {
    phoneNumber: '+1234567899',
    email: 'new.user@unicx.com',
    firstName: 'New',
    lastName: 'User',
    password: bcrypt.hashSync('newpassword123', 12),
    role: UserRole.USER,
    registrationStatus: RegistrationStatus.REGISTERED,
    whatsappConnectionStatus: WhatsAppConnectionStatus.CONNECTED,
    whatsappPhoneNumber: '+1234567899',
    isActive: true,
    tenantId: TENANT_ID,
    createdBy: 'system',
    createdAt: now,
    updatedAt: now,
  },
];
```

### Adding More QR Invitations

Add to the `qrInvitationsData` array:

```typescript
const qrInvitationsData = [
  // ... existing invitations
  {
    type: QRInvitationType.CUSTOM_DATA,
    entityId: companyEntity?._id,
    userId: null,
    data: {
      eventName: 'Your Custom Event',
      date: '2025-02-01',
      location: 'Your Location',
      description: 'Your event description',
    },
    encryptedData: crypto.randomBytes(32).toString('hex'),
    qrCodeImage: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    status: QRInvitationStatus.ACTIVE,
    expiryDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days
    maxUsageCount: 50,
    currentUsageCount: 0,
    isActive: true,
    tenantId: TENANT_ID,
    createdBy: 'system',
    createdAt: now,
    updatedAt: now,
  },
];
```

### Modifying Onboarding Steps

Edit the onboarding progress data:

```typescript
const onboardingProgressData = [
  {
    userId: user?._id,
    entityId: entity?._id,
    steps: [
      {
        stepId: 'custom-step',
        stepName: 'Your Custom Step',
        stepDescription: 'Description of your custom step',
        status: OnboardingStepStatus.NOT_STARTED,
        stepData: {},
        startedAt: undefined,
        completedAt: undefined,
        estimatedDuration: 30,
        actualDuration: undefined,
        prerequisites: [],
        isOptional: false,
        validationErrors: [],
      },
    ],
    progressPercentage: 0,
    isCompleted: false,
    completedAt: undefined,
    isReset: false,
    resetAt: undefined,
    resetBy: undefined,
    isActive: true,
    tenantId: TENANT_ID,
    createdBy: 'system',
    createdAt: now,
    updatedAt: now,
  },
];
```

---

## 🗄️ Database-Specific Instructions

### MongoDB Local

```bash
# 1. Start MongoDB
mongod

# 2. Configure .env
MONGODB_URI=mongodb://localhost:27017/unicx-integration

# 3. Seed database
npm run seed:clean
```

### MongoDB Atlas

```bash
# 1. Get connection string from Atlas dashboard
# Format: mongodb+srv://username:password@cluster.mongodb.net/database

# 2. Configure .env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/unicx-integration?retryWrites=true&w=majority

# 3. Seed database
npm run seed:clean
```

### Azure CosmosDB

```bash
# 1. Get connection string from Azure portal
# Format: mongodb://account:key@account.mongo.cosmos.azure.com:10255/?ssl=true

# 2. Configure .env
COSMOS_DB_CONNECTION_STRING=mongodb://account:key@account.mongo.cosmos.azure.com:10255/?ssl=true
COSMOS_DB_NAME=unicx-integration

# 3. Seed database
npm run seed:clean
```

### Docker MongoDB

```bash
# 1. Start MongoDB container
docker run -d --name mongodb -p 27017:27017 mongo:7

# 2. Configure .env
MONGODB_URI=mongodb://localhost:27017/unicx-integration

# 3. Seed database
npm run seed:clean
```

---

## ✅ Verification

### API Endpoints

After seeding, test these endpoints:

```bash
# Entities
curl http://localhost:3000/api/v1/entities
curl http://localhost:3000/api/v1/entities/with-children

# Users
curl http://localhost:3000/api/v1/users
curl http://localhost:3000/api/v1/users?role=User

# QR Codes
curl http://localhost:3000/api/v1/qr-codes
curl http://localhost:3000/api/v1/qr-codes?status=active

# Onboarding
curl http://localhost:3000/api/v1/onboarding/stats
```

### Swagger UI

Open `http://localhost:3000/api/docs` and test the endpoints interactively.

### Database Queries

Connect to your database and run:

```javascript
// MongoDB/CosmosDB shell
use unicx-integration

// Count documents
db.entities.countDocuments()
db.users.countDocuments()
db.qrinvitations.countDocuments()
db.onboardingprogresses.countDocuments()

// View sample data
db.entities.findOne()
db.users.findOne()
db.qrinvitations.findOne()
db.onboardingprogresses.findOne()
```

---

## 🐛 Troubleshooting

### Common Issues

#### 1. Connection Errors

**Error**: `MongooseError: connect ECONNREFUSED`

**Solution**:
```bash
# Check if MongoDB is running
ps aux | grep mongod

# Start MongoDB
mongod

# Or with Docker
docker start mongodb
```

#### 2. Authentication Errors

**Error**: `MongoError: Authentication failed`

**Solution**:
```bash
# Check connection string format
echo $MONGODB_URI

# For Atlas, ensure IP is whitelisted
# For CosmosDB, check connection string includes credentials
```

#### 3. Permission Errors

**Error**: `MongoError: not authorized`

**Solution**:
```bash
# Ensure user has proper roles
# For MongoDB: dbAdmin or readWrite
# For CosmosDB: Check access keys
```

#### 4. Duplicate Key Errors

**Error**: `MongoError: E11000 duplicate key error`

**Solution**:
```bash
# Use clean seeding
npm run seed:clean

# Or manually clear collections
# Connect to database and run:
db.entities.deleteMany({})
db.users.deleteMany({})
db.qrinvitations.deleteMany({})
db.onboardingprogresses.deleteMany({})
```

#### 5. TypeScript Compilation Errors

**Error**: `Cannot find module` or TypeScript errors

**Solution**:
```bash
# Install dependencies
npm install

# Use JavaScript version instead
npm run build
npm run seed:js:clean
```

### Debug Mode

Enable debug logging:

```bash
# Set debug environment variable
DEBUG=* npm run seed

# Or with specific debug namespaces
DEBUG=mongoose:* npm run seed
```

### Manual Database Reset

If seeding fails completely:

```bash
# 1. Connect to your database
mongo mongodb://localhost:27017/unicx-integration

# 2. Drop all collections
db.entities.drop()
db.users.drop()
db.qrinvitations.drop()
db.onboardingprogresses.drop()

# 3. Try seeding again
npm run seed:clean
```

---

## 🚨 Production Warnings

### ⚠️ Never Run in Production

**Seeding scripts are for development and testing only!**

### Production-Safe Alternatives

1. **Data Migration Scripts**: Create proper migration scripts for production
2. **Backup First**: Always backup production data before any changes
3. **Staging Testing**: Test all changes in staging environment first
4. **Gradual Rollout**: Use feature flags and gradual rollouts

### Production Data Management

```bash
# 1. Export existing data
mongodump --uri="your-production-uri" --out=backup/

# 2. Create migration scripts
# Create scripts/migrations/001-initial-data.js

# 3. Test in staging
# Apply migration to staging environment

# 4. Deploy to production
# Use proper CI/CD pipeline with rollback capability
```

---

## 📚 Additional Resources

- [MongoDB Documentation](https://docs.mongodb.com/)
- [Azure CosmosDB Documentation](https://docs.microsoft.com/en-us/azure/cosmos-db/)
- [NestJS Mongoose Documentation](https://docs.nestjs.com/techniques/mongodb)
- [Database Migration Best Practices](https://docs.microsoft.com/en-us/azure/architecture/best-practices/data-migration)

---

## 📝 Changelog

### Version 1.0.0
- Initial seeding script implementation
- Support for entities, users, QR invitations, and onboarding progress
- Clean and incremental seeding options
- Comprehensive documentation

---

**Last Updated**: October 1, 2025  
**Version**: 1.0.0  
**Compatibility**: NestJS 10.x, MongoDB 7+, Azure CosmosDB Mongo API
