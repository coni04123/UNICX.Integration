# UNICX Integration Backend - Complete Implementation

## 🚀 Project Overview

This is a comprehensive NestJS backend application with Azure CosmosDB Mongo API integration, implementing a complete user management and invitation system with QR code generation, email integration, and multi-tenant architecture.

## ✨ Features Implemented

### 🔐 Authentication & Authorization
- JWT-based authentication with refresh tokens
- Role-based access control (SystemAdmin, TenantAdmin, User)
- Multi-tenant isolation
- Password hashing with bcrypt
- Session management

### 🏢 Entity Management
- Hierarchical entity structure with unlimited nesting
- Support for entities, companies, and departments
- Automatic path generation and updates
- Circular reference prevention
- Bulk operations and entity statistics

### 👥 User Management
- E164 phone number validation
- Registration workflow (pending/invited/registered/cancelled)
- WhatsApp connection status tracking
- User preferences and avatar support
- Bulk user operations
- Advanced filtering and search

### 📱 QR Code & Invitation System
- Secure QR code generation with encryption
- Email invitation system with templates
- QR code scanning and verification
- Expiration management
- Bulk invitation processing
- Comprehensive tracking and analytics

### 📊 Onboarding Progress Tracking
- Step-by-step progress monitoring
- Flexible step configuration
- Progress percentage calculation
- Prerequisite checking
- Admin user tracking
- Time-based analytics

### 📧 Email Service
- Template-based email composition
- Multi-language support
- Delivery tracking
- Bulk email processing
- Integration with SMTP providers

### 🔄 Background Job Processing
- Email sending queue with retry logic
- QR code generation queue
- WhatsApp message processing
- Cleanup and maintenance tasks
- Job monitoring and failure handling

### 🛡️ Security Features
- Input validation and sanitization
- Rate limiting (IP and user-based)
- CORS configuration
- Data encryption for sensitive information
- Comprehensive audit logging
- GDPR compliance features

### 📈 Monitoring & Health Checks
- System health monitoring
- Service status checks (Database, Email, Redis, Memory)
- Performance metrics
- Uptime tracking
- Error reporting

## 🏗️ Architecture

### Database Schema
- **Entities**: Hierarchical structure with path tracking
- **Users**: Complete user lifecycle management
- **QR Invitations**: Secure invitation system
- **Onboarding Progress**: Step-by-step tracking
- **Audit Logs**: Comprehensive activity tracking

### API Endpoints
- **Authentication**: `/api/v1/auth/*`
- **Entities**: `/api/v1/entities/*`
- **Users**: `/api/v1/users/*`
- **QR Codes**: `/api/v1/qr-codes/*`
- **Onboarding**: `/api/v1/onboarding/*`
- **Health**: `/health`

### Security Layers
1. **Authentication**: JWT tokens with refresh mechanism
2. **Authorization**: Role-based access control
3. **Tenant Isolation**: Multi-tenant data separation
4. **Rate Limiting**: API endpoint protection
5. **Input Validation**: Comprehensive data validation
6. **Audit Logging**: Complete activity tracking

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MongoDB (or Azure CosmosDB Mongo API)
- Redis
- SMTP email service

### Installation

1. **Clone and install dependencies**
```bash
git clone <repository-url>
cd UNICX.Integration
npm install
```

2. **Environment Configuration**
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Database Setup**
```bash
# For local MongoDB
docker-compose up -d mongo redis

# Or configure Azure CosmosDB Mongo API connection
```

4. **Start the Application**
```bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod
```

### Docker Deployment
```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f app
```

## 📚 API Documentation

Once running, visit `http://localhost:3000/api/docs` for comprehensive Swagger API documentation.

## 🔧 Configuration

### Environment Variables
- **Database**: MongoDB connection string
- **JWT**: Secret keys and expiration times
- **Email**: SMTP configuration
- **Redis**: Queue management
- **Security**: Encryption keys and rate limits

### Key Features Configuration
- QR code expiration (default: 24 hours)
- Rate limiting (default: 100 requests/minute)
- Password hashing rounds (default: 12)
- Audit log retention (default: 90 days)

## 🧪 Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## 📊 Monitoring

### Health Checks
- **Endpoint**: `/health`
- **Metrics**: `/health/metrics` (Admin only)

### Logging
- Structured logging with Winston
- Audit trail for all operations
- Error tracking and reporting

## 🔒 Security Considerations

1. **Data Encryption**: Sensitive data encrypted at rest
2. **API Security**: Rate limiting and input validation
3. **Authentication**: Secure JWT implementation
4. **Audit Trail**: Complete activity logging
5. **GDPR Compliance**: Data protection features

## 🚀 Production Deployment

### Azure CosmosDB Setup
1. Create Azure CosmosDB account with Mongo API
2. Configure connection string in environment
3. Set up proper indexing for performance

### Scaling Considerations
- Horizontal scaling with load balancer
- Database sharding for large datasets
- Queue scaling for high-volume processing
- CDN for static assets

## 📈 Performance Optimizations

- Database indexing for fast queries
- Redis caching for frequently accessed data
- Background job processing
- Connection pooling
- Query optimization

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Create Pull Request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Contact the development team
- Check the API documentation

---

**Built with ❤️ using NestJS, MongoDB, and modern web technologies**
