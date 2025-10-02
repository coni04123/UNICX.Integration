import { IsString, IsOptional, IsObject, IsArray, ValidateNested, IsEnum, IsBoolean, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum OnboardingStepStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  SKIPPED = 'skipped',
  FAILED = 'failed',
}

export class OnboardingStepDto {
  @ApiProperty({ example: 'step-1' })
  @IsString()
  stepId: string;

  @ApiProperty({ example: 'Setup Company Profile' })
  @IsString()
  stepName: string;

  @ApiProperty({ example: 'Configure your company information and settings' })
  @IsString()
  stepDescription: string;

  @ApiProperty({ example: OnboardingStepStatus.NOT_STARTED, enum: OnboardingStepStatus })
  @IsEnum(OnboardingStepStatus)
  status: OnboardingStepStatus;

  @ApiProperty({ example: { companyName: 'ACME Corp' }, required: false })
  @IsOptional()
  @IsObject()
  stepData?: Record<string, any>;

  @ApiProperty({ example: 30, required: false })
  @IsOptional()
  @IsNumber()
  estimatedDuration?: number;

  @ApiProperty({ example: ['step-0'], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  prerequisites?: string[];

  @ApiProperty({ example: false, required: false })
  @IsOptional()
  @IsBoolean()
  isOptional?: boolean;
}

export class CreateOnboardingProgressDto {
  @ApiProperty({ example: 'tenant-123' })
  @IsString()
  tenantId: string;

  @ApiProperty({ type: [OnboardingStepDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OnboardingStepDto)
  steps?: OnboardingStepDto[];

  @ApiProperty({ example: { priority: 'high' }, required: false })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class UpdateOnboardingStepDto {
  @ApiProperty({ example: OnboardingStepStatus.IN_PROGRESS, enum: OnboardingStepStatus, required: false })
  @IsOptional()
  @IsEnum(OnboardingStepStatus)
  status?: OnboardingStepStatus;

  @ApiProperty({ example: { companyName: 'Updated ACME Corp' }, required: false })
  @IsOptional()
  @IsObject()
  stepData?: Record<string, any>;

  @ApiProperty({ example: ['validation error'], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  validationErrors?: string[];
}

export class ResetOnboardingDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  resetSteps: boolean;
}
