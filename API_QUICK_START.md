# UNICX Integration API - Quick Start Guide

## 🚀 Getting Started in 5 Minutes

### Prerequisites
- Node.js 18+ installed
- Docker Desktop running (optional)
- Git installed

### Step 1: Clone and Install

```bash
# Clone the repository
cd UNICX.Integration

# Install dependencies
npm install
```

### Step 2: Configure Environment

```bash
# Copy the environment example
cp env.example .env

# Edit .env with your settings (minimum required):
# - MONGODB_URI
# - JWT_SECRET
# - JWT_REFRESH_SECRET
# - EMAIL_USER
# - EMAIL_PASS
# - QR_CODE_ENCRYPTION_KEY
```

### Step 3: Start Development Server

```bash
# Start the development server
npm run start:dev

# The API will be available at:
# http://localhost:3000

# Swagger documentation:
# http://localhost:3000/api/docs
```

---

## 📱 Quick API Test

### 1. Health Check

```bash
curl http://localhost:3000/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "services": {
    "database": { "status": "healthy" },
    "email": { "status": "healthy" },
    "redis": { "status": "healthy" },
    "memory": { "status": "healthy" }
  }
}
```

### 2. Create First User (Login)

First, you'll need to seed a user in your database. Use MongoDB Compass or the mongo shell:

```javascript
db.users.insertOne({
  phoneNumber: "+1234567890",
  firstName: "Admin",
  lastName: "User",
  email: "admin@unicx.com",
  password: "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5zfpKp0LKPfim", // "password123"
  registrationStatus: "registered",
  role: "SystemAdmin",
  entityId: ObjectId("507f1f77bcf86cd799439011"),
  entityPath: "Root",
  tenantId: "tenant-123",
  whatsappConnectionStatus: "disconnected",
  qrInvitationHistory: [],
  preferences: {
    language: "en",
    timezone: "UTC",
    emailNotifications: true,
    pushNotifications: true,
    whatsappNotifications: true
  },
  initials: "AU",
  isOnline: false,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date()
});
```

### 3. Login

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@unicx.com",
    "password": "password123"
  }'
```

**Expected Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "admin@unicx.com",
    "firstName": "Admin",
    "lastName": "User",
    "role": "SystemAdmin",
    "tenantId": "tenant-123"
  }
}
```

**Save the access_token for subsequent requests!**

### 4. Create Your First Entity

```bash
curl -X POST http://localhost:3000/api/v1/entities \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "name": "ACME Corporation",
    "type": "entity",
    "tenantId": "tenant-123",
    "metadata": {
      "industry": "Technology",
      "founded": "2024"
    }
  }'
```

**Expected Response:**
```json
{
  "_id": "507f1f77bcf86cd799439012",
  "name": "ACME Corporation",
  "type": "entity",
  "parentId": null,
  "path": "ACME Corporation",
  "tenantId": "tenant-123",
  "level": 0,
  "metadata": {
    "industry": "Technology",
    "founded": "2024"
  },
  "isActive": true,
  "createdBy": "507f1f77bcf86cd799439011",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

### 5. Create a Sub-Entity (Department)

```bash
curl -X POST http://localhost:3000/api/v1/entities \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "name": "Sales Department",
    "type": "department",
    "parentId": "507f1f77bcf86cd799439012",
    "tenantId": "tenant-123",
    "metadata": {
      "manager": "John Doe",
      "budget": 100000
    }
  }'
```

### 6. Get Entity Hierarchy

```bash
curl -X GET "http://localhost:3000/api/v1/entities/hierarchy?tenantId=tenant-123" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### 7. Invite a New User

```bash
curl -X POST http://localhost:3000/api/v1/users/invite \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "phoneNumber": "+1234567891",
    "email": "john.doe@acme.com",
    "firstName": "John",
    "lastName": "Doe",
    "entityId": "507f1f77bcf86cd799439012",
    "tenantId": "tenant-123",
    "role": "User"
  }'
```

**This will:**
1. Create the user with status "invited"
2. Generate a QR code
3. Send an invitation email
4. Return the user object

### 8. Create QR Invitation

```bash
curl -X POST http://localhost:3000/api/v1/qr-codes/invitations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "userId": "NEW_USER_ID",
    "email": "john.doe@acme.com",
    "templateId": "invitation",
    "tenantId": "tenant-123",
    "expiryHours": 24
  }'
```

### 9. Scan QR Code (Public Endpoint)

```bash
curl -X POST http://localhost:3000/api/v1/qr-codes/scan \
  -H "Content-Type: application/json" \
  -d '{
    "qrCodeId": "QR_CODE_ID_FROM_PREVIOUS_STEP",
    "ipAddress": "192.168.1.1",
    "userAgent": "Mozilla/5.0...",
    "deviceInfo": "iPhone 12 Pro"
  }'
```

---

## 🎯 Common Workflows

### Workflow 1: Complete User Onboarding

```bash
# Step 1: Create entity hierarchy
POST /api/v1/entities
{
  "name": "Root Entity",
  "type": "entity",
  "tenantId": "tenant-123"
}

# Step 2: Invite users
POST /api/v1/users/invite
{
  "email": "user@example.com",
  "firstName": "Jane",
  "lastName": "Smith",
  "phoneNumber": "+1234567892",
  "entityId": "ENTITY_ID",
  "tenantId": "tenant-123"
}

# Step 3: Generate QR invitation
POST /api/v1/qr-codes/invitations
{
  "userId": "USER_ID",
  "email": "user@example.com",
  "tenantId": "tenant-123"
}

# Step 4: User scans QR code
POST /api/v1/qr-codes/scan
{
  "qrCodeId": "QR_CODE_ID"
}

# Step 5: User status is now "registered"
```

### Workflow 2: Bulk User Import

```bash
POST /api/v1/users/bulk-invite
{
  "tenantId": "tenant-123",
  "users": [
    {
      "email": "user1@example.com",
      "firstName": "User",
      "lastName": "One",
      "phoneNumber": "+1234567891",
      "entityId": "ENTITY_ID"
    },
    {
      "email": "user2@example.com",
      "firstName": "User",
      "lastName": "Two",
      "phoneNumber": "+1234567892",
      "entityId": "ENTITY_ID"
    }
  ]
}
```

### Workflow 3: Entity Hierarchy Management

```bash
# Create root entity
POST /api/v1/entities
{
  "name": "Global Corp",
  "type": "entity",
  "tenantId": "tenant-123"
}

# Create company under root
POST /api/v1/entities
{
  "name": "US Operations",
  "type": "company",
  "parentId": "ROOT_ENTITY_ID",
  "tenantId": "tenant-123"
}

# Create department under company
POST /api/v1/entities
{
  "name": "Engineering",
  "type": "department",
  "parentId": "COMPANY_ID",
  "tenantId": "tenant-123"
}

# Move department to different company
PATCH /api/v1/entities/DEPARTMENT_ID/move
{
  "newParentId": "ANOTHER_COMPANY_ID"
}
```

---

## 📊 Monitoring & Debugging

### Check System Health

```bash
# Overall health
curl http://localhost:3000/health

# Detailed metrics (requires SystemAdmin)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/health/metrics
```

### View Logs

```bash
# Development logs (console)
npm run start:dev

# Production logs (Docker)
docker-compose logs -f app
```

### Database Queries

```javascript
// Check all users in tenant
db.users.find({ tenantId: "tenant-123", isActive: true });

// Check entity hierarchy
db.entities.find({ tenantId: "tenant-123", isActive: true }).sort({ path: 1 });

// Check pending invitations
db.qrinvitations.find({ 
  tenantId: "tenant-123", 
  status: { $in: ["pending", "sent"] },
  expiresAt: { $gt: new Date() }
});

// Check audit logs
db.auditlogs.find({ tenantId: "tenant-123" }).sort({ createdAt: -1 }).limit(10);
```

---

## 🔧 Troubleshooting

### Issue: "Cannot connect to MongoDB"

**Solution:**
1. Check `MONGODB_URI` in `.env`
2. Verify MongoDB/CosmosDB is running
3. Check firewall rules
4. Test connection with MongoDB Compass

### Issue: "Emails not sending"

**Solution:**
1. Check email credentials in `.env`
2. Verify SMTP settings
3. Check email queue: Redis must be running
4. Review logs for errors

### Issue: "QR codes not generating"

**Solution:**
1. Ensure Redis is running
2. Check queue processors are active
3. Verify `QR_CODE_ENCRYPTION_KEY` is set
4. Check logs for generation errors

### Issue: "Unauthorized (401)"

**Solution:**
1. Check JWT token is not expired
2. Verify token is included in Authorization header
3. Ensure token format: `Bearer YOUR_TOKEN`
4. Try refreshing the token

### Issue: "Forbidden (403)"

**Solution:**
1. Check user role has required permissions
2. Verify tenant isolation (correct tenantId)
3. Ensure user is active

---

## 📖 Next Steps

1. **Explore Swagger Documentation**: http://localhost:3000/api/docs
2. **Read Implementation Guide**: See `IMPLEMENTATION_GUIDE.md`
3. **Configure Production**: Update `.env` for production
4. **Set up Monitoring**: Configure Sentry, logging
5. **Deploy**: Follow deployment guide in documentation

---

## 🆘 Support

### Documentation
- **Implementation Guide**: `IMPLEMENTATION_GUIDE.md`
- **API Reference**: Swagger UI at `/api/docs`
- **Project Overview**: `PROJECT_OVERVIEW.md`

### Common Resources
- NestJS Documentation: https://docs.nestjs.com
- MongoDB Documentation: https://docs.mongodb.com
- Azure CosmosDB: https://docs.microsoft.com/azure/cosmos-db

---

**Happy Coding! 🚀**


