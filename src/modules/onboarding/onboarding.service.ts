import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { OnboardingProgress, OnboardingStepStatus } from '../../common/schemas/onboarding-progress.schema';
import { User } from '../../common/schemas/user.schema';
import { CreateOnboardingProgressDto } from './dto/create-onboarding-progress.dto';
import { UpdateOnboardingStepDto } from './dto/update-onboarding-step.dto';
import { ResetOnboardingDto } from './dto/reset-onboarding.dto';

@Injectable()
export class OnboardingService {
  constructor(
    @InjectModel(OnboardingProgress.name)
    private onboardingProgressModel: Model<OnboardingProgress>,
    @InjectModel(User.name)
    private userModel: Model<User>,
  ) {}

  async createProgress(createDto: CreateOnboardingProgressDto, adminUserId: string): Promise<OnboardingProgress> {
    const { tenantId, steps, metadata } = createDto;

    // Check if onboarding already exists for this tenant
    const existingProgress = await this.onboardingProgressModel.findOne({
      tenantId,
      isActive: true,
    });

    if (existingProgress) {
      throw new BadRequestException('Onboarding progress already exists for this tenant');
    }

    // Get admin user info
    const adminUser = await this.userModel.findById(adminUserId);
    if (!adminUser) {
      throw new NotFoundException('Admin user not found');
    }

    const onboardingProgress = new this.onboardingProgressModel({
      tenantId,
      adminUserId,
      adminUserName: `${adminUser.firstName} ${adminUser.lastName}`,
      steps: steps || [],
      startedAt: new Date(),
      metadata: metadata || {},
    });

    return onboardingProgress.save();
  }

  async findAll(tenantId?: string): Promise<OnboardingProgress[]> {
    const query: any = { isActive: true };

    if (tenantId) {
      query.tenantId = tenantId;
    }

    return this.onboardingProgressModel.find(query)
      .populate('adminUserId', 'firstName lastName email')
      .sort({ createdAt: -1 });
  }

  async findOne(id: string, tenantId?: string): Promise<OnboardingProgress> {
    const query: any = { _id: id, isActive: true };

    if (tenantId) {
      query.tenantId = tenantId;
    }

    const progress = await this.onboardingProgressModel.findOne(query)
      .populate('adminUserId', 'firstName lastName email');

    if (!progress) {
      throw new NotFoundException('Onboarding progress not found');
    }

    return progress;
  }

  async findByTenant(tenantId: string): Promise<OnboardingProgress> {
    const progress = await this.onboardingProgressModel.findOne({
      tenantId,
      isActive: true,
    }).populate('adminUserId', 'firstName lastName email');

    if (!progress) {
      throw new NotFoundException('Onboarding progress not found for this tenant');
    }

    return progress;
  }

  async updateStep(
    id: string,
    stepId: string,
    updateDto: UpdateOnboardingStepDto,
    updatedBy: string,
    tenantId?: string,
  ): Promise<OnboardingProgress> {
    const progress = await this.findOne(id, tenantId);

    const stepIndex = progress.steps.findIndex(step => step.stepId === stepId);
    if (stepIndex === -1) {
      throw new NotFoundException('Step not found');
    }

    const step = progress.steps[stepIndex];

    // Validate prerequisites
    if (updateDto.status === OnboardingStepStatus.IN_PROGRESS || updateDto.status === OnboardingStepStatus.COMPLETED) {
      const unmetPrerequisites = await this.checkPrerequisites(progress.steps, step.prerequisites);
      if (unmetPrerequisites.length > 0) {
        throw new BadRequestException(`Prerequisites not met: ${unmetPrerequisites.join(', ')}`);
      }
    }

    // Update step
    const updatedStep = {
      ...step,
      ...updateDto,
      updatedAt: new Date(),
    };

    if (updateDto.status === OnboardingStepStatus.IN_PROGRESS && !step.startedAt) {
      updatedStep.startedAt = new Date();
    }

    if (updateDto.status === OnboardingStepStatus.COMPLETED && !step.completedAt) {
      updatedStep.completedAt = new Date();
      if (step.startedAt) {
        updatedStep.actualDuration = Math.round(
          (updatedStep.completedAt.getTime() - step.startedAt.getTime()) / (1000 * 60)
        );
      }
    }

    progress.steps[stepIndex] = updatedStep;

    // Recalculate progress percentage
    const completedSteps = progress.steps.filter(s => s.status === OnboardingStepStatus.COMPLETED).length;
    const progressPercentage = Math.round((completedSteps / progress.steps.length) * 100);
    const isCompleted = progressPercentage === 100;

    const updateData: any = {
      steps: progress.steps,
      progressPercentage,
      isCompleted,
    };

    if (isCompleted && !progress.completedAt) {
      updateData.completedAt = new Date();
    }

    return await this.onboardingProgressModel.findByIdAndUpdate(
      progress._id,
      updateData,
      { new: true }
    );
  }

  async addStep(
    id: string,
    stepData: any,
    addedBy: string,
    tenantId?: string,
  ): Promise<OnboardingProgress> {
    const progress = await this.findOne(id, tenantId);

    const newStep = {
      stepId: stepData.stepId,
      stepName: stepData.stepName,
      stepDescription: stepData.stepDescription,
      status: OnboardingStepStatus.NOT_STARTED,
      stepData: stepData.stepData || {},
      startedAt: undefined,
      completedAt: undefined,
      estimatedDuration: stepData.estimatedDuration || 0,
      actualDuration: undefined,
      prerequisites: stepData.prerequisites || [],
      isOptional: stepData.isOptional || false,
      validationErrors: [],
    };

    progress.steps.push(newStep as any);

    return await this.onboardingProgressModel.findByIdAndUpdate(
      progress._id,
      { steps: progress.steps },
      { new: true }
    );
  }

  async removeStep(
    id: string,
    stepId: string,
    removedBy: string,
    tenantId?: string,
  ): Promise<OnboardingProgress> {
    const progress = await this.findOne(id, tenantId);

    const stepIndex = progress.steps.findIndex(step => step.stepId === stepId);
    if (stepIndex === -1) {
      throw new NotFoundException('Step not found');
    }

    progress.steps.splice(stepIndex, 1);

    // Recalculate progress percentage
    const completedSteps = progress.steps.filter(s => s.status === OnboardingStepStatus.COMPLETED).length;
    const progressPercentage = progress.steps.length > 0 
      ? Math.round((completedSteps / progress.steps.length) * 100)
      : 0;
    const isCompleted = progressPercentage === 100;

    return await this.onboardingProgressModel.findByIdAndUpdate(
      progress._id,
      { 
        steps: progress.steps,
        progressPercentage,
        isCompleted
      },
      { new: true }
    );
  }

  async resetProgress(
    id: string,
    resetDto: ResetOnboardingDto,
    resetBy: string,
    tenantId?: string,
  ): Promise<OnboardingProgress> {
    const progress = await this.findOne(id, tenantId);

    if (resetDto.resetSteps) {
      // Reset all steps to not started
      progress.steps.forEach(step => {
        step.status = OnboardingStepStatus.NOT_STARTED;
        step.startedAt = undefined;
        step.completedAt = undefined;
        step.actualDuration = undefined;
        step.validationErrors = [];
      });
    }

    return await this.onboardingProgressModel.findByIdAndUpdate(
      progress._id,
      {
        steps: progress.steps,
        isReset: true,
        resetAt: new Date(),
        resetBy,
        progressPercentage: 0,
        isCompleted: false,
        completedAt: undefined,
      },
      { new: true }
    );
  }

  async getOnboardingStats(tenantId?: string): Promise<any> {
    const query: any = { isActive: true };

    if (tenantId) {
      query.tenantId = tenantId;
    }

    const stats = await this.onboardingProgressModel.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalOnboardings: { $sum: 1 },
          completedOnboardings: {
            $sum: { $cond: [{ $eq: ['$isCompleted', true] }, 1, 0] }
          },
          avgProgressPercentage: { $avg: '$progressPercentage' },
          avgCompletionTime: {
            $avg: {
              $cond: [
                { $ne: ['$completedAt', null] },
                { $subtract: ['$completedAt', '$startedAt'] },
                null
              ]
            }
          },
        },
      },
    ]);

    const stepStats = await this.onboardingProgressModel.aggregate([
      { $match: query },
      { $unwind: '$steps' },
      {
        $group: {
          _id: '$steps.status',
          count: { $sum: 1 },
          avgDuration: { $avg: '$steps.actualDuration' },
        },
      },
    ]);

    return {
      ...stats[0],
      stepStats,
    };
  }

  private async checkPrerequisites(steps: any[], prerequisites: string[]): Promise<string[]> {
    const unmetPrerequisites: string[] = [];

    for (const prerequisiteId of prerequisites) {
      const prerequisiteStep = steps.find(step => step.stepId === prerequisiteId);
      if (!prerequisiteStep || prerequisiteStep.status !== OnboardingStepStatus.COMPLETED) {
        unmetPrerequisites.push(prerequisiteId);
      }
    }

    return unmetPrerequisites;
  }
}
