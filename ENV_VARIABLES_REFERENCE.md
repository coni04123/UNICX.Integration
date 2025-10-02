# Environment Variables Reference

## Complete List of All Environment Variables

This document provides a comprehensive reference of all environment variables used in the UNICX Integration Backend.

---

## 📋 Quick Reference Table

| Variable | Required | Default Value | Description |
|----------|----------|---------------|-------------|
| **Application** |
| `APP_NAME` | No | `'UNICX Integration'` | Application name |
| `PORT` | No | `3000` | Server port |
| `NODE_ENV` | No | `'development'` | Environment (development/production) |
| `API_PREFIX` | No | `'api/v1'` | API route prefix |
| **Database** |
| `MONGODB_URI` | Yes* | `'mongodb://localhost:27017/unicx-integration'` | MongoDB connection string |
| `COSMOS_DB_CONNECTION_STRING` | Yes* | `''` | Azure CosmosDB connection string |
| `COSMOS_DB_NAME` | No | `'unicx-integration'` | CosmosDB database name |
| `DATABASE_MAX_POOL_SIZE` | No | `50` | Maximum database connections |
| `DATABASE_MIN_POOL_SIZE` | No | `10` | Minimum database connections |
| **JWT Authentication** |
| `JWT_SECRET` | **Yes** | `'your-super-secret-jwt-key'` | JWT signing secret |
| `JWT_EXPIRES_IN` | No | `'24h'` | JWT token expiration |
| `JWT_REFRESH_SECRET` | **Yes** | `'your-refresh-secret-key'` | Refresh token secret |
| `JWT_REFRESH_EXPIRES_IN` | No | `'7d'` | Refresh token expiration |
| **Redis** |
| `REDIS_HOST` | **Yes** | `'localhost'` | Redis server host |
| `REDIS_PORT` | No | `6379` | Redis server port |
| `REDIS_PASSWORD` | No | `''` | Redis password |
| `REDIS_DB` | No | `0` | Redis database number |
| `REDIS_TTL` | No | `3600` | Cache TTL in seconds |
| **Email - SMTP** |
| `EMAIL_PROVIDER` | No | `'smtp'` | Email provider (smtp/sendgrid) |
| `EMAIL_HOST` | No | `'smtp.gmail.com'` | SMTP server host |
| `EMAIL_PORT` | No | `587` | SMTP server port |
| `EMAIL_SECURE` | No | `false` | Use TLS/SSL |
| `EMAIL_USER` | Conditional | `''` | SMTP username |
| `EMAIL_PASS` | Conditional | `''` | SMTP password |
| `EMAIL_FROM_NAME` | No | `'UNICX'` | Sender name |
| `EMAIL_FROM_ADDRESS` | No | `'noreply@unicx.com'` | Sender email address |
| **Email - SendGrid** |
| `SENDGRID_API_KEY` | Conditional | `''` | SendGrid API key |
| **Rate Limiting** |
| `RATE_LIMIT_TTL` | No | `60` | Default rate limit window (seconds) |
| `RATE_LIMIT_MAX` | No | `100` | Default max requests per window |
| `AUTH_RATE_LIMIT_TTL` | No | `900` | Auth rate limit window (seconds) |
| `AUTH_RATE_LIMIT_MAX` | No | `5` | Max auth attempts per window |
| **QR Code** |
| `QR_CODE_EXPIRY_HOURS` | No | `24` | QR code expiration in hours |
| `QR_CODE_ENCRYPTION_KEY` | **Yes** | `'your-qr-encryption-key'` | QR code encryption key |
| `QR_CODE_MAX_RETRY_ATTEMPTS` | No | `3` | Max retry attempts |
| `QR_CODE_IMAGE_FORMAT` | No | `'png'` | Image format (png/svg) |
| `QR_CODE_SIZE` | No | `300` | QR code size in pixels |
| **WhatsApp Business API** |
| `WHATSAPP_API_URL` | No | `'https://graph.facebook.com/v18.0'` | WhatsApp API URL |
| `WHATSAPP_ACCESS_TOKEN` | Conditional | `''` | WhatsApp access token |
| `WHATSAPP_PHONE_NUMBER_ID` | Conditional | `''` | WhatsApp phone number ID |
| `WHATSAPP_BUSINESS_ID` | Conditional | `''` | WhatsApp business ID |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Conditional | `''` | Webhook verification token |
| **Security** |
| `BCRYPT_ROUNDS` | No | `12` | Password hashing rounds |
| `ENCRYPTION_KEY` | **Yes** | `'your-encryption-key-32-chars-minimum'` | Data encryption key (32+ chars) |
| `CORS_ORIGIN` | No | `'http://localhost:3000'` | Allowed CORS origins (comma-separated) |
| `MAX_FILE_SIZE` | No | `5242880` | Max upload size in bytes (5MB) |
| `ALLOWED_FILE_TYPES` | No | `'image/jpeg,image/png,image/gif'` | Allowed MIME types |
| **File Storage - Azure** |
| `STORAGE_PROVIDER` | No | `'azure'` | Storage provider (azure/aws) |
| `AZURE_STORAGE_CONNECTION_STRING` | Conditional | `''` | Azure storage connection string |
| `AZURE_STORAGE_CONTAINER` | No | `'unicx-files'` | Azure container name |
| **File Storage - AWS** |
| `AWS_S3_BUCKET` | No | `'unicx-files'` | S3 bucket name |
| `AWS_S3_REGION` | No | `'us-east-1'` | AWS region |
| `AWS_ACCESS_KEY_ID` | Conditional | `''` | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | Conditional | `''` | AWS secret key |
| **Monitoring & Logging** |
| `LOG_LEVEL` | No | `'info'` | Logging level |
| `SENTRY_DSN` | No | `''` | Sentry error tracking DSN |
| `ENABLE_SWAGGER` | No | `true` | Enable API documentation |
| **Cleanup Jobs** |
| `AUDIT_LOG_RETENTION_DAYS` | No | `90` | Audit log retention period |
| `QR_CODE_CLEANUP_DAYS` | No | `7` | Expired QR code cleanup period |
| `FAILED_INVITATION_CLEANUP_DAYS` | No | `14` | Failed invitation cleanup period |
| **Pagination** |
| `DEFAULT_PAGE_SIZE` | No | `20` | Default pagination size |
| `MAX_PAGE_SIZE` | No | `100` | Maximum pagination size |
| **Session Management** |
| `SESSION_TIMEOUT_MINUTES` | No | `30` | Session timeout in minutes |
| `MAX_CONCURRENT_SESSIONS` | No | `3` | Max concurrent sessions per user |
| **Feature Flags** |
| `ENABLE_EMAIL_VERIFICATION` | No | `false` | Enable email verification |
| `ENABLE_TWO_FACTOR_AUTH` | No | `false` | Enable 2FA |
| `ENABLE_WHATSAPP_INTEGRATION` | No | `true` | Enable WhatsApp features |
| `ENABLE_EXTERNAL_AUTH_PROVIDERS` | No | `false` | Enable OAuth providers |

\* Either `MONGODB_URI` or `COSMOS_DB_CONNECTION_STRING` is required

---

## 🔑 Required Variables for Minimal Setup

To run the application with core features, you **must** configure:

```bash
# Database - Choose ONE
MONGODB_URI=mongodb://localhost:27017/unicx-integration
# OR
COSMOS_DB_CONNECTION_STRING=your-cosmos-connection-string

# Authentication - REQUIRED
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_REFRESH_SECRET=your-refresh-secret-key-change-this-in-production

# Redis - REQUIRED for queues and caching
REDIS_HOST=localhost
REDIS_PORT=6379

# Encryption - REQUIRED
ENCRYPTION_KEY=your-encryption-key-must-be-at-least-32-characters-long
QR_CODE_ENCRYPTION_KEY=your-qr-code-encryption-key-change-this
```

---

## 📦 Configuration by Feature

### Core Application (Always Required)
- `MONGODB_URI` or `COSMOS_DB_CONNECTION_STRING`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `REDIS_HOST`
- `ENCRYPTION_KEY`
- `QR_CODE_ENCRYPTION_KEY`

### Email Features (Optional)
```bash
# For SMTP
EMAIL_PROVIDER=smtp
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM_NAME=UNICX
EMAIL_FROM_ADDRESS=noreply@unicx.com

# OR for SendGrid
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=your-sendgrid-api-key
EMAIL_FROM_NAME=UNICX
EMAIL_FROM_ADDRESS=noreply@unicx.com
```

### WhatsApp Integration (Optional)
```bash
ENABLE_WHATSAPP_INTEGRATION=true
WHATSAPP_ACCESS_TOKEN=your-whatsapp-access-token
WHATSAPP_PHONE_NUMBER_ID=your-phone-number-id
WHATSAPP_BUSINESS_ID=your-business-id
WHATSAPP_WEBHOOK_VERIFY_TOKEN=your-webhook-token
```

### File Upload Features (Optional)
```bash
# For Azure Storage
STORAGE_PROVIDER=azure
AZURE_STORAGE_CONNECTION_STRING=your-azure-connection-string
AZURE_STORAGE_CONTAINER=unicx-files

# OR for AWS S3
STORAGE_PROVIDER=aws
AWS_S3_BUCKET=unicx-files
AWS_S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret
```

### Error Tracking (Optional)
```bash
SENTRY_DSN=your-sentry-dsn-url
```

---

## 🔒 Security Best Practices

### Production Environment Variables

```bash
# NEVER use default secrets in production!
JWT_SECRET=$(openssl rand -base64 32)
JWT_REFRESH_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -base64 32)
QR_CODE_ENCRYPTION_KEY=$(openssl rand -base64 32)

# Use strong passwords
REDIS_PASSWORD=your-strong-redis-password

# Restrict CORS
CORS_ORIGIN=https://yourdomain.com,https://app.yourdomain.com

# Enable security features
ENABLE_EMAIL_VERIFICATION=true
ENABLE_TWO_FACTOR_AUTH=true

# Production environment
NODE_ENV=production
```

### Secret Generation

Generate secure secrets using:

```bash
# Linux/Mac
openssl rand -base64 32

# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# PowerShell
[Convert]::ToBase64String((1..32|%{Get-Random -Minimum 0 -Maximum 255}))
```

---

## 🐳 Docker Environment

### docker-compose.yml Example

```yaml
environment:
  - NODE_ENV=production
  - PORT=3000
  - MONGODB_URI=mongodb://mongo:27017/unicx-integration
  - REDIS_HOST=redis
  - REDIS_PORT=6379
  - JWT_SECRET=${JWT_SECRET}
  - JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
  - ENCRYPTION_KEY=${ENCRYPTION_KEY}
  - QR_CODE_ENCRYPTION_KEY=${QR_CODE_ENCRYPTION_KEY}
```

### .env.docker Example

```bash
JWT_SECRET=your-secret-here
JWT_REFRESH_SECRET=your-refresh-secret-here
ENCRYPTION_KEY=your-encryption-key-here
QR_CODE_ENCRYPTION_KEY=your-qr-encryption-key-here
```

---

## 📊 Environment Variable Validation

### Startup Validation Script

Add to `main.ts`:

```typescript
function validateEnvironment() {
  const required = [
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'ENCRYPTION_KEY',
    'QR_CODE_ENCRYPTION_KEY',
  ];

  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(key => console.error(`   - ${key}`));
    process.exit(1);
  }

  // Validate database
  if (!process.env.MONGODB_URI && !process.env.COSMOS_DB_CONNECTION_STRING) {
    console.error('❌ Either MONGODB_URI or COSMOS_DB_CONNECTION_STRING must be set');
    process.exit(1);
  }

  console.log('✅ Environment validation passed');
}
```

---

## 🧪 Testing Environment

### .env.test Example

```bash
NODE_ENV=test
MONGODB_URI=mongodb://localhost:27017/unicx-integration-test
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=test-jwt-secret
JWT_REFRESH_SECRET=test-refresh-secret
ENCRYPTION_KEY=test-encryption-key-32-chars-long
QR_CODE_ENCRYPTION_KEY=test-qr-encryption-key
ENABLE_SWAGGER=false
```

---

## 📝 Notes

1. **Default Values**: All variables have default values, but production deployments should explicitly set required values
2. **Sensitive Data**: Never commit `.env` files to version control
3. **Type Coercion**: `parseInt()` is used for numeric values, ensure valid integers
4. **Boolean Values**: Some booleans check for exact string matches (e.g., `=== 'true'`)
5. **Arrays**: Comma-separated values are split into arrays (e.g., `CORS_ORIGIN`)

---

**Last Updated**: October 1, 2025  
**Total Variables**: 71  
**Required Variables**: 6 core + conditionals based on features  
**Configuration File**: `src/config/configuration.ts`


