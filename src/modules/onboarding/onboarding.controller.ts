import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { OnboardingService } from './onboarding.service';
import { CreateOnboardingProgressDto } from './dto/create-onboarding-progress.dto';
import { UpdateOnboardingStepDto } from './dto/create-onboarding-progress.dto';
import { ResetOnboardingDto } from './dto/create-onboarding-progress.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { TenantGuard } from '../auth/tenant.guard';
import { Roles, RequireTenant } from '../auth/decorators';
import { UserRole } from '../../common/schemas/user.schema';

@ApiTags('Onboarding')
@Controller('onboarding')
@UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
@ApiBearerAuth()
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Post('progress')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.TENANT_ADMIN)
  @RequireTenant()
  @ApiOperation({ summary: 'Create onboarding progress' })
  @ApiResponse({ status: 201, description: 'Onboarding progress created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async createProgress(@Body() createDto: CreateOnboardingProgressDto, @Request() req) {
    return this.onboardingService.createProgress(createDto, req.user.sub);
  }

  @Get('progress')
  @RequireTenant()
  @ApiOperation({ summary: 'Get all onboarding progress' })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiResponse({ status: 200, description: 'Onboarding progress retrieved successfully' })
  async findAll(@Query('tenantId') tenantId: string, @Request() req) {
    return this.onboardingService.findAll(tenantId || req.user.tenantId);
  }

  @Get('progress/stats')
  @RequireTenant()
  @ApiOperation({ summary: 'Get onboarding statistics' })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiResponse({ status: 200, description: 'Onboarding statistics retrieved successfully' })
  async getStats(@Query('tenantId') tenantId: string, @Request() req) {
    return this.onboardingService.getOnboardingStats(tenantId || req.user.tenantId);
  }

  @Get('progress/tenant/:tenantId')
  @RequireTenant()
  @ApiOperation({ summary: 'Get onboarding progress by tenant' })
  @ApiResponse({ status: 200, description: 'Onboarding progress retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Onboarding progress not found' })
  async findByTenant(@Param('tenantId') tenantId: string, @Request() req) {
    return this.onboardingService.findByTenant(tenantId);
  }

  @Get('progress/:id')
  @RequireTenant()
  @ApiOperation({ summary: 'Get onboarding progress by ID' })
  @ApiResponse({ status: 200, description: 'Onboarding progress retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Onboarding progress not found' })
  async findOne(@Param('id') id: string, @Request() req) {
    return this.onboardingService.findOne(id, req.user.tenantId);
  }

  @Patch('progress/:id/steps/:stepId')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.TENANT_ADMIN)
  @RequireTenant()
  @ApiOperation({ summary: 'Update onboarding step' })
  @ApiResponse({ status: 200, description: 'Onboarding step updated successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'Onboarding progress or step not found' })
  async updateStep(
    @Param('id') id: string,
    @Param('stepId') stepId: string,
    @Body() updateDto: UpdateOnboardingStepDto,
    @Request() req,
  ) {
    return this.onboardingService.updateStep(id, stepId, updateDto, req.user.sub, req.user.tenantId);
  }

  @Post('progress/:id/steps')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.TENANT_ADMIN)
  @RequireTenant()
  @ApiOperation({ summary: 'Add onboarding step' })
  @ApiResponse({ status: 200, description: 'Onboarding step added successfully' })
  @ApiResponse({ status: 404, description: 'Onboarding progress not found' })
  async addStep(
    @Param('id') id: string,
    @Body() stepData: any,
    @Request() req,
  ) {
    return this.onboardingService.addStep(id, stepData, req.user.sub, req.user.tenantId);
  }

  @Delete('progress/:id/steps/:stepId')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.TENANT_ADMIN)
  @RequireTenant()
  @ApiOperation({ summary: 'Remove onboarding step' })
  @ApiResponse({ status: 200, description: 'Onboarding step removed successfully' })
  @ApiResponse({ status: 404, description: 'Onboarding progress or step not found' })
  async removeStep(
    @Param('id') id: string,
    @Param('stepId') stepId: string,
    @Request() req,
  ) {
    return this.onboardingService.removeStep(id, stepId, req.user.sub, req.user.tenantId);
  }

  @Post('progress/:id/reset')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.TENANT_ADMIN)
  @RequireTenant()
  @ApiOperation({ summary: 'Reset onboarding progress' })
  @ApiResponse({ status: 200, description: 'Onboarding progress reset successfully' })
  @ApiResponse({ status: 404, description: 'Onboarding progress not found' })
  async resetProgress(
    @Param('id') id: string,
    @Body() resetDto: ResetOnboardingDto,
    @Request() req,
  ) {
    return this.onboardingService.resetProgress(id, resetDto, req.user.sub, req.user.tenantId);
  }
}
