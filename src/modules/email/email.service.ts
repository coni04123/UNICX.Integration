import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    const emailConfig = {
      host: this.configService.get<string>('email.smtp.host'),
      port: this.configService.get<number>('email.smtp.port'),
      secure: this.configService.get<boolean>('email.smtp.secure'), // true for port 465
      auth: {
        user: this.configService.get<string>('email.smtp.user'),
        pass: this.configService.get<string>('email.smtp.pass'),
      },
    }; 

    this.logger.log(`Initializing email service with host: ${emailConfig.host}:${emailConfig.port}`);
    
    this.transporter = nodemailer.createTransport(emailConfig);
  }

  async sendInvitationEmail(
    email: string,
    templateId: string,
    templateData: Record<string, any>,
  ): Promise<void> {
    try {
      const template = await this.loadTemplate(templateId);
      const html = template(templateData);

      const fromName = this.configService.get<string>('email.from.name');
      const fromAddress = this.configService.get<string>('email.from.address');
      
      const mailOptions = {
        from: `"${fromName}" <${fromAddress}>`,
        to: email,
        subject: templateData.subject || 'Welcome to UNICX',
        html,
      };

      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Invitation email sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send invitation email to ${email}:`, error);
      throw error;
    }
  }

  async sendBulkEmails(
    emails: Array<{ email: string; templateId: string; templateData: Record<string, any> }>,
  ): Promise<{ success: number; failed: number; errors: any[] }> {
    let success = 0;
    let failed = 0;
    const errors: any[] = [];

    for (const emailData of emails) {
      try {
        await this.sendInvitationEmail(emailData.email, emailData.templateId, emailData.templateData);
        success++;
      } catch (error) {
        failed++;
        errors.push({
          email: emailData.email,
          error: error.message,
        });
      }
    }

    return { success, failed, errors };
  }

  async sendPasswordResetEmail(email: string, resetToken: string): Promise<void> {
    try {
      const template = await this.loadTemplate('password-reset');
      const html = template({ resetToken, email });

      const fromName = this.configService.get<string>('email.from.name');
      const fromAddress = this.configService.get<string>('email.from.address');
      
      const mailOptions = {
        from: `"${fromName}" <${fromAddress}>`,
        to: email,
        subject: 'Password Reset - UNICX',
        html,
      };

      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Password reset email sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send password reset email to ${email}:`, error);
      throw error;
    }
  }

  async sendWelcomeEmail(email: string, userData: Record<string, any>): Promise<void> {
    try {
      const template = await this.loadTemplate('welcome');
      const html = template(userData);

      const fromName = this.configService.get<string>('email.from.name');
      const fromAddress = this.configService.get<string>('email.from.address');
      
      const mailOptions = {
        from: `"${fromName}" <${fromAddress}>`,
        to: email,
        subject: 'Welcome to UNICX',
        html,
      };

      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Welcome email sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send welcome email to ${email}:`, error);
      throw error;
    }
  }

  private async loadTemplate(templateId: string): Promise<handlebars.TemplateDelegate> {
    try {
      const templatePath = path.join(__dirname, '..', '..', 'templates', `${templateId}.hbs`);
      const templateContent = fs.readFileSync(templatePath, 'utf8');
      return handlebars.compile(templateContent);
    } catch (error) {
      this.logger.error(`Failed to load template ${templateId}:`, error);
      // Return a default template if the specific template is not found
      return handlebars.compile(`
        <html>
          <body>
            <h1>Welcome to UNICX</h1>
            <p>Hello {{firstName}} {{lastName}},</p>
            <p>Welcome to UNICX platform!</p>
            <p>Best regards,<br>The UNICX Team</p>
          </body>
        </html>
      `);
    }
  }

  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      this.logger.log('Email service connection verified');
      return true;
    } catch (error) {
      this.logger.error('Email service connection failed:', error);
      return false;
    }
  }

  async sendInvitationEmailWithQR(
    email: string,
    data: { firstName: string; lastName: string; qrCode: string; sessionId: string; tempPassword: string; expiresAt: Date }
  ): Promise<void> {
    try {
      const fromName = this.configService.get<string>('email.from.name');
      const fromAddress = this.configService.get<string>('email.from.address');

      const html = `
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
              .qr-container { text-align: center; margin: 30px 0; }
              .qr-container img { max-width: 300px; border: 2px solid #667eea; padding: 10px; background: white; border-radius: 10px; }
              .info-box { background: white; padding: 15px; border-left: 4px solid #667eea; margin: 15px 0; }
              .warning-box { background: #fef3c7; padding: 15px; border-left: 4px solid #f59e0b; margin: 20px 0; }
              .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; }
              .steps { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
              .steps ol { margin: 10px 0; padding-left: 20px; }
              .steps li { margin: 8px 0; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>🎉 Welcome to UNICX!</h1>
              <p>Connect Your WhatsApp</p>
            </div>
            <div class="content">
              <h2>Hello ${data.firstName} ${data.lastName},</h2>
              <p>You've been invited to join UNICX. To get started, please connect your WhatsApp account by scanning the QR code below:</p>
              
              <div class="qr-container">
                <img src="${data.qrCode}" alt="WhatsApp QR Code" />
                <p><strong>Scan this QR code with WhatsApp</strong></p>
              </div>

              <div class="steps">
                <strong>📱 How to scan:</strong>
                <ol>
                  <li>Open WhatsApp on your phone</li>
                  <li>Tap <strong>Menu</strong> (⋮) or <strong>Settings</strong></li>
                  <li>Tap <strong>Linked Devices</strong></li>
                  <li>Tap <strong>Link a Device</strong></li>
                  <li>Point your phone at this screen to scan the code</li>
                </ol>
              </div>

              <div class="warning-box">
                <strong>⏰ Important:</strong> This QR code expires in 60 seconds. If expired, please contact your administrator to generate a new one.
              </div>

              <div class="info-box">
                <strong>Your Login Credentials:</strong><br>
                <strong>Email:</strong> ${email}<br>
                <strong>Temporary Password:</strong> ${data.tempPassword}<br>
                <strong>Session ID:</strong> ${data.sessionId}<br><br>
                <small style="color: #6b7280;">Please change your password after first login.</small>
              </div>

              <p><strong>After connecting, you'll be able to:</strong></p>
              <ul>
                <li>✅ Send and receive WhatsApp messages</li>
                <li>✅ Connect with your team instantly</li>
                <li>✅ Access the communication dashboard</li>
                <li>✅ Track message delivery and read status</li>
                <li>✅ Manage conversations efficiently</li>
              </ul>

              <p>If you need any assistance, please contact your administrator.</p>

              <div class="footer">
                <p><strong>UNICX Integration Platform</strong></p>
                <p>This email was sent automatically. Please do not reply.</p>
                <p>© 2025 UNICX. All rights reserved.</p>
              </div>
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

  async sendTestEmail(toEmail: string, subject: string = 'UNICX - Test Email'): Promise<void> {
    try {
      const fromName = this.configService.get<string>('email.from.name');
      const fromAddress = this.configService.get<string>('email.from.address');

      const html = `
        <html>
          <head>
            <style>
              body {
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
              }
              .header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 30px;
                border-radius: 10px 10px 0 0;
                text-align: center;
              }
              .content {
                background: #f9fafb;
                padding: 30px;
                border-radius: 0 0 10px 10px;
              }
              .badge {
                background: #10b981;
                color: white;
                padding: 5px 15px;
                border-radius: 20px;
                display: inline-block;
                margin: 10px 0;
              }
              .info-box {
                background: white;
                padding: 15px;
                border-left: 4px solid #667eea;
                margin: 15px 0;
              }
              .footer {
                text-align: center;
                color: #6b7280;
                font-size: 12px;
                margin-top: 20px;
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>🚀 UNICX Email Service</h1>
              <p>Test Email Successfully Sent!</p>
            </div>
            <div class="content">
              <div class="badge">✅ Connected</div>
              
              <h2>Email Configuration Test</h2>
              <p>This is a test email from the UNICX Integration Backend. If you're reading this, the email service is working correctly!</p>
              
              <div class="info-box">
                <strong>Configuration Details:</strong><br>
                <strong>SMTP Host:</strong> ${this.configService.get<string>('email.smtp.host')}<br>
                <strong>SMTP Port:</strong> ${this.configService.get<number>('email.smtp.port')}<br>
                <strong>Secure:</strong> ${this.configService.get<boolean>('email.smtp.secure') ? 'Yes (SSL)' : 'No'}<br>
                <strong>From:</strong> ${fromAddress}<br>
                <strong>Sent at:</strong> ${new Date().toLocaleString()}
              </div>
              
              <h3>Features Available:</h3>
              <ul>
                <li>✉️ Invitation Emails</li>
                <li>🔐 Password Reset Emails</li>
                <li>👋 Welcome Emails</li>
                <li>📧 Bulk Email Sending</li>
                <li>🎨 HTML Templates with Handlebars</li>
              </ul>
              
              <p><strong>Status:</strong> <span style="color: #10b981;">All systems operational</span></p>
              
              <div class="footer">
                <p>UNICX Integration Backend | Email Service Test</p>
                <p>This email was sent automatically. Please do not reply.</p>
              </div>
            </div>
          </body>
        </html>
      `;

      const mailOptions = {
        from: `"${fromName}" <${fromAddress}>`,
        to: toEmail,
        subject: subject,
        html: html,
      };

      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(`Test email sent successfully to ${toEmail}. Message ID: ${info.messageId}`);
    } catch (error) {
      console.log('error', error);
      this.logger.error(`Failed to send test email to ${toEmail}:`, error);
      throw error;
    }
  }
}
