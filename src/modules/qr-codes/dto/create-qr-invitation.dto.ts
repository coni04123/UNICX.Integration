import { IsString, IsEmail, IsOptional, IsMongoId, IsNumber, IsObject, IsArray, ValidateNested } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateQRInvitationDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  @IsMongoId()
  userId: string;

  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'welcome-template', required: false })
  @IsOptional()
  @IsString()
  templateId?: string;

  @ApiProperty({ example: { userName: 'John Doe', companyName: 'ACME Corp' }, required: false })
  @IsOptional()
  @IsObject()
  templateData?: Record<string, any>;

  @ApiProperty({ example: 'tenant-123' })
  @IsString()
  tenantId: string;

  @ApiProperty({ example: 24, required: false })
  @IsOptional()
  @IsNumber()
  expiryHours?: number;
}

export class BulkCreateQRInvitationDto {
  @ApiProperty({ type: [CreateQRInvitationDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQRInvitationDto)
  invitations: Omit<CreateQRInvitationDto, 'tenantId'>[];

  @ApiProperty({ example: 'tenant-123' })
  @IsString()
  tenantId: string;
}

export class ScanQRCodeDto {
  @ApiProperty({ example: 'qr-code-uuid-123' })
  @IsString()
  qrCodeId: string;

  @ApiProperty({ example: '192.168.1.1', required: false })
  @IsOptional()
  @IsString()
  ipAddress?: string;

  @ApiProperty({ example: 'Mozilla/5.0...', required: false })
  @IsOptional()
  @IsString()
  userAgent?: string;

  @ApiProperty({ example: 'iPhone 12 Pro', required: false })
  @IsOptional()
  @IsString()
  deviceInfo?: string;

  @ApiProperty({ example: 'New York, NY', required: false })
  @IsOptional()
  @IsString()
  location?: string;
}
