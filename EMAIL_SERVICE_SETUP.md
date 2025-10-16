# Email Service Setup Guide - Zoho SMTP

## Overview
UNICX Integration Backend email service configured with Zoho SMTP for sending transactional emails.

## Configuration

### Zoho Email Credentials
```
Email: sistema@2n5.com.br
Password: ulPI7fx@
SMTP Host: smtp.zoho.com
SMTP Port: 465 (SSL)
IMAP Host: imap.zoho.com
IMAP Port: 993 (SSL)
```

### Environment Variables

Add these to your `.env` file:

```bash
# Email Configuration (Zoho)
EMAIL_HOST=smtp.zoho.com
EMAIL_PORT=465
EMAIL_SECURE=true
EMAIL_USER=sistema@2n5.com.br
EMAIL_PASS=ulPI7fx@
EMAIL_FROM_NAME=UNICX System
EMAIL_FROM_ADDRESS=sistema@2n5.com.br
```

### Configuration File Structure

The configuration is managed through `src/config/configuration.ts`:

```typescript
email: {
  provider: process.env.EMAIL_PROVIDER || 'smtp',
  smtp: {
    host: process.env.EMAIL_HOST || 'smtp.zoho.com',
    port: parseInt(process.env.EMAIL_PORT, 10) || 465,
    secure: process.env.EMAIL_SECURE === 'true', // true for port 465
    user: process.env.EMAIL_USER || '',
    pass: process.env.EMAIL_PASS || '',
  },
  from: {
    name: process.env.EMAIL_FROM_NAME || 'UNICX',
    address: process.env.EMAIL_FROM_ADDRESS || 'noreply@unicx.com',
  },
}
```

## Files Modified

### 1. `src/modules/email/email.service.ts`
- Updated constructor to use Zoho SMTP configuration
- Modified to use `email.smtp.*` config paths
- Added `sendTestEmail()` method with beautiful HTML template
- Updated all email methods to use proper from address format

### 2. `src/modules/email/email.controller.ts` (NEW)
- Created REST API endpoints for email testing
- `GET /api/v1/email/verify` - Verify SMTP connection
- `POST /api/v1/email/test` - Send test email

### 3. `src/modules/email/email.module.ts`
- Added `EmailController` to module

## API Endpoints

### 1. Verify Email Connection

**Endpoint:** `GET /api/v1/email/verify`

**Authorization:** SystemAdmin, TenantAdmin

**Response:**
```json
{
  "status": "connected",
  "message": "Email service is working correctly",
  "timestamp": "2025-01-13T10:30:00.000Z"
}
```

### 2. Send Test Email

**Endpoint:** `POST /api/v1/email/test`

**Authorization:** SystemAdmin, TenantAdmin

**Request Body:**
```json
{
  "toEmail": "test@example.com",
  "subject": "UNICX - Test Email" // optional
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Test email sent successfully to test@example.com",
  "timestamp": "2025-01-13T10:30:00.000Z"
}
```

**Response (Failure):**
```json
{
  "success": false,
  "message": "Failed to send test email: Connection refused",
  "error": "Error: Connection refused at ...",
  "timestamp": "2025-01-13T10:30:00.000Z"
}
```

## Testing the Email Service

### Method 1: Using Swagger UI

1. Start the backend: `npm run start:dev`
2. Open Swagger UI: `http://localhost:3000/api/docs`
3. Navigate to **Email** section
4. Authenticate with admin credentials
5. Try `POST /api/v1/email/test` endpoint

### Method 2: Using cURL

```bash
# First, login to get JWT token
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@unicx.com",
    "password": "admin123"
  }'

# Use the token to send test email
curl -X POST http://localhost:3000/api/v1/email/test \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "toEmail": "your-email@example.com",
    "subject": "UNICX Test Email"
  }'
```

### Method 3: Using Postman

1. **Login Request:**
   - POST `http://localhost:3000/api/v1/auth/login`
   - Body (JSON):
     ```json
     {
       "email": "admin@unicx.com",
       "password": "admin123"
     }
     ```
   - Save the `accessToken` from response

2. **Test Email Request:**
   - POST `http://localhost:3000/api/v1/email/test`
   - Headers: `Authorization: Bearer YOUR_ACCESS_TOKEN`
   - Body (JSON):
     ```json
     {
       "toEmail": "your-email@example.com",
       "subject": "UNICX Test Email"
     }
     ```

## Email Service Methods

### Available Methods

```typescript
// 1. Send Invitation Email (with template)
await emailService.sendInvitationEmail(
  'user@example.com',
  'invitation-template',
  { firstName: 'John', lastName: 'Doe', ... }
);

// 2. Send Welcome Email
await emailService.sendWelcomeEmail(
  'user@example.com',
  { firstName: 'John', lastName: 'Doe' }
);

// 3. Send Password Reset Email
await emailService.sendPasswordResetEmail(
  'user@example.com',
  'reset-token-123'
);

// 4. Send Test Email
await emailService.sendTestEmail(
  'user@example.com',
  'Custom Subject'
);

// 5. Verify Connection
const isConnected = await emailService.verifyConnection();

// 6. Send Bulk Emails
await emailService.sendBulkEmails([
  { email: 'user1@example.com', templateId: 'welcome', templateData: {...} },
  { email: 'user2@example.com', templateId: 'welcome', templateData: {...} },
]);
```

## Test Email Template

The test email includes:
- ✨ Beautiful gradient header
- ✅ Connection status badge
- 📋 Configuration details
- 📝 List of available features
- 🎨 Fully styled HTML with inline CSS
- 📱 Responsive design

## Troubleshooting

### Common Issues

#### 1. Connection Refused
**Error:** `Error: Connection refused at smtp.zoho.com:465`

**Solutions:**
- Check if port 465 is open on your firewall
- Verify Zoho account is active
- Ensure EMAIL_SECURE=true in .env

#### 2. Authentication Failed
**Error:** `Error: Invalid login: 535 Authentication failed`

**Solutions:**
- Verify email and password are correct
- Check if less secure app access is enabled (if applicable)
- Try generating an app-specific password in Zoho

#### 3. Self-signed Certificate
**Error:** `Error: self signed certificate`

**Solution:** Add to email config:
```typescript
tls: {
  rejectUnauthorized: false // Only for development!
}
```

#### 4. Timeout
**Error:** `Error: Connection timeout`

**Solutions:**
- Check internet connection
- Verify SMTP server is accessible
- Try ping smtp.zoho.com

### Debugging

Enable detailed logging:
```bash
LOG_LEVEL=debug npm run start:dev
```

Check email service logs:
```bash
# Look for these log messages:
# "Initializing email service with host: smtp.zoho.com:465"
# "Email service connection verified"
# "Test email sent successfully to ..."
```

## Security Best Practices

1. **Never commit .env file** - Add to .gitignore
2. **Use app-specific passwords** - Generate in Zoho account settings
3. **Enable 2FA** - On Zoho account for security
4. **Rotate passwords regularly** - Change every 90 days
5. **Use environment variables** - Never hardcode credentials
6. **Limit access** - Only admins can send test emails
7. **Monitor usage** - Track email sending metrics

## Production Checklist

Before deploying to production:

- [ ] Update EMAIL_USER and EMAIL_PASS in production .env
- [ ] Set EMAIL_FROM_NAME and EMAIL_FROM_ADDRESS appropriately
- [ ] Verify DNS records (SPF, DKIM, DMARC)
- [ ] Test email delivery to major providers (Gmail, Outlook, etc.)
- [ ] Set up email monitoring/alerts
- [ ] Configure rate limiting for email endpoints
- [ ] Review and update email templates
- [ ] Set up bounce handling
- [ ] Configure email logging
- [ ] Test all email types (invitation, welcome, password reset)

## Email Templates

Templates are stored in `src/templates/` directory:
- `invitation.hbs` - User invitation emails
- `welcome.hbs` - Welcome emails for new users
- `password-reset.hbs` - Password reset emails

### Template Variables

Templates use Handlebars syntax:
```handlebars
<h1>Welcome {{firstName}} {{lastName}}!</h1>
<p>Your email: {{email}}</p>
```

## Monitoring

### Email Metrics

Track these metrics:
- Total emails sent
- Delivery rate
- Bounce rate
- Open rate (if tracking enabled)
- Failed sends

### Logs

Email service logs include:
- Connection status
- Email sent confirmations
- Delivery failures with stack traces
- Message IDs for tracking

## Support

For issues with Zoho:
- Zoho Support: https://www.zoho.com/mail/help/
- SMTP Documentation: https://www.zoho.com/mail/help/smtp.html
- Status Page: https://status.zoho.com/

For UNICX Integration issues:
- Check backend logs
- Review environment variables
- Test connection with `/api/v1/email/verify`
- Contact development team

## Additional Resources

- [Nodemailer Documentation](https://nodemailer.com/)
- [Zoho Mail SMTP Settings](https://www.zoho.com/mail/help/zoho-smtp.html)
- [NestJS Mailer Module](https://nest-modules.github.io/mailer/)
- [Email Best Practices](https://sendgrid.com/blog/email-best-practices/)

## Notes

- **Port 465** requires `secure: true` (SSL/TLS)
- **Port 587** uses STARTTLS (set `secure: false`)
- Zoho has sending limits (check your plan)
- Keep email credentials secure
- Test thoroughly before production use

