import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type OnboardingProgressDocument = OnboardingProgress & Document;

export enum OnboardingStepStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  SKIPPED = 'skipped',
  FAILED = 'failed',
}

@Schema({ timestamps: true })
export class OnboardingStep {
  @Prop({ required: true })
  stepId: string;

  @Prop({ required: true })
  stepName: string;

  @Prop({ required: true })
  stepDescription: string;

  @Prop({ required: true, enum: OnboardingStepStatus, default: OnboardingStepStatus.NOT_STARTED })
  status: OnboardingStepStatus;

  @Prop({ type: Object, default: {} })
  stepData: Record<string, any>;

  @Prop()
  startedAt: Date;

  @Prop()
  completedAt: Date;

  @Prop()
  estimatedDuration: number; // in minutes

  @Prop()
  actualDuration: number; // in minutes

  @Prop({ type: [String], default: [] })
  prerequisites: string[];

  @Prop({ default: false })
  isOptional: boolean;

  @Prop()
  validationErrors: string[];
}

@Schema({ timestamps: true })
export class OnboardingProgress {
  @Prop({ type: Types.ObjectId, auto: true })
  _id: Types.ObjectId;

  @Prop({ required: true })
  tenantId: string; // Root/first ancestor entity ID for tenant isolation

  @Prop({ type: Types.ObjectId, ref: 'Entity' })
  entityId: Types.ObjectId;

  @Prop({ type: [Types.ObjectId], ref: 'Entity', default: [] })
  entityIdPath: Types.ObjectId[]; // Array of all ancestor entity IDs from root to current entity

  @Prop({ type: Types.ObjectId, ref: 'Entity' })
  companyId: Types.ObjectId; // Nearest ancestor entity with type 'company'

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  adminUserId: Types.ObjectId;

  @Prop({ required: true })
  adminUserName: string;

  @Prop({ type: [OnboardingStep], default: [] })
  steps: OnboardingStep[];

  @Prop({ required: true, default: 0 })
  progressPercentage: number;

  @Prop()
  startedAt: Date;

  @Prop()
  estimatedCompletionAt: Date;

  @Prop()
  completedAt: Date;

  @Prop({ required: true, default: false })
  isCompleted: boolean;

  @Prop({ required: true, default: false })
  isReset: boolean;

  @Prop()
  resetAt: Date;

  @Prop()
  resetBy: string;

  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>;

  @Prop({ required: true, default: true })
  isActive: boolean;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const OnboardingProgressSchema = SchemaFactory.createForClass(OnboardingProgress);

// Indexes for performance
OnboardingProgressSchema.index({ tenantId: 1, isActive: 1 });
OnboardingProgressSchema.index({ entityId: 1 });
OnboardingProgressSchema.index({ companyId: 1 });
OnboardingProgressSchema.index({ entityIdPath: 1 });
OnboardingProgressSchema.index({ adminUserId: 1 });
OnboardingProgressSchema.index({ isCompleted: 1, tenantId: 1 });
OnboardingProgressSchema.index({ startedAt: 1 });
OnboardingProgressSchema.index({ completedAt: 1 });

// Pre-save middleware to calculate progress percentage
OnboardingProgressSchema.pre('save', function () {
  if (this.steps && this.steps.length > 0) {
    const completedSteps = this.steps.filter(step => step.status === OnboardingStepStatus.COMPLETED).length;
    this.progressPercentage = Math.round((completedSteps / this.steps.length) * 100);
    this.isCompleted = this.progressPercentage === 100;
    
    if (this.isCompleted && !this.completedAt) {
      this.completedAt = new Date();
    }
  }
});
