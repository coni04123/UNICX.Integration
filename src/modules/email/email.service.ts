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
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('email.host'),
      port: this.configService.get<number>('email.port'),
      secure: false,
      auth: {
        user: this.configService.get<string>('email.user'),
        pass: this.configService.get<string>('email.pass'),
      },
    });
  }

  async sendInvitationEmail(
    email: string,
    templateId: string,
    templateData: Record<string, any>,
  ): Promise<void> {
    try {
      const template = await this.loadTemplate(templateId);
      const html = template(templateData);

      const mailOptions = {
        from: this.configService.get<string>('email.from'),
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

      const mailOptions = {
        from: this.configService.get<string>('email.from'),
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

      const mailOptions = {
        from: this.configService.get<string>('email.from'),
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
}
