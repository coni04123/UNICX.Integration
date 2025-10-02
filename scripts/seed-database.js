#!/usr/bin/env node

/**
 * Database Seeding Script for UNICX Integration Backend
 * 
 * This script initializes the MongoDB database with sample data including:
 * - Organizational entities (companies, departments)
 * - Users with different roles and statuses
 * - QR code invitations
 * - Onboarding progress records
 * 
 * Usage:
 *   npm run seed:js
 *   npm run seed:js:clean
 *   node scripts/seed-database.js
 *   node scripts/seed-database.js --clean
 */

const { NestFactory } = require('@nestjs/core');
const { getModelToken } = require('@nestjs/mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// Import the compiled AppModule
const { AppModule } = require('../dist/app.module');

// Configuration
const TENANT_ID = 'seed-tenant-001';
const CLEAN_DATABASE = process.argv.includes('--clean') || process.argv.includes('-c');

class DatabaseSeeder {
  constructor(entityModel, userModel, qrInvitationModel, onboardingProgressModel) {
    this.entityModel = entityModel;
    this.userModel = userModel;
    this.qrInvitationModel = qrInvitationModel;
    this.onboardingProgressModel = onboardingProgressModel;
  }

  async seed() {
    console.log('🌱 Starting database seeding...');
    
    if (CLEAN_DATABASE) {
      await this.cleanDatabase();
    }

    const stats = {
      entities: 0,
      users: 0,
      qrInvitations: 0,
      onboardingProgress: 0,
    };

    // Seed entities first (needed for references)
    console.log('🏢 Seeding entities...');
    const entities = await this.seedEntities();
    stats.entities = entities.length;

    // Seed users
    console.log('👥 Seeding users...');
    const users = await this.seedUsers();
    stats.users = users.length;

    // Seed QR invitations
    console.log('📱 Seeding QR invitations...');
    const qrInvitations = await this.seedQRInvitations(entities, users);
    stats.qrInvitations = qrInvitations.length;

    // Seed onboarding progress
    console.log('📋 Seeding onboarding progress...');
    const onboardingProgress = await this.seedOnboardingProgress(entities, users);
    stats.onboardingProgress = onboardingProgress.length;

    // Update entity hierarchy
    console.log('🔗 Updating entity hierarchy...');
    await this.updateEntityHierarchy(entities);

    return stats;
  }

  async cleanDatabase() {
    console.log('🧹 Cleaning existing data...');
    
    await Promise.all([
      this.entityModel.deleteMany({}),
      this.userModel.deleteMany({}),
      this.qrInvitationModel.deleteMany({}),
      this.onboardingProgressModel.deleteMany({}),
    ]);
    
    console.log('✅ Database cleaned');
  }

  async seedEntities() {
    const now = new Date();
    
    const entitiesData = [
      // Root company
      {
        name: 'UNICX Corporation',
        type: 'company',
        parentId: null,
        path: 'UNICX Corporation',
        level: 0,
        isActive: true,
        tenantId: TENANT_ID,
        createdBy: 'system',
        createdAt: now,
        updatedAt: now,
      },
      // Departments
      {
        name: 'Engineering',
        type: 'department',
        parentId: null, // Will be updated later
        path: 'UNICX Corporation/Engineering',
        level: 1,
        isActive: true,
        tenantId: TENANT_ID,
        createdBy: 'system',
        createdAt: now,
        updatedAt: now,
      },
      {
        name: 'Sales',
        type: 'department',
        parentId: null,
        path: 'UNICX Corporation/Sales',
        level: 1,
        isActive: true,
        tenantId: TENANT_ID,
        createdBy: 'system',
        createdAt: now,
        updatedAt: now,
      },
      {
        name: 'Marketing',
        type: 'department',
        parentId: null,
        path: 'UNICX Corporation/Marketing',
        level: 1,
        isActive: true,
        tenantId: TENANT_ID,
        createdBy: 'system',
        createdAt: now,
        updatedAt: now,
      },
      {
        name: 'Human Resources',
        type: 'department',
        parentId: null,
        path: 'UNICX Corporation/Human Resources',
        level: 1,
        isActive: true,
        tenantId: TENANT_ID,
        createdBy: 'system',
        createdAt: now,
        updatedAt: now,
      },
      // Sub-departments
      {
        name: 'Frontend Team',
        type: 'department',
        parentId: null,
        path: 'UNICX Corporation/Engineering/Frontend Team',
        level: 2,
        isActive: true,
        tenantId: TENANT_ID,
        createdBy: 'system',
        createdAt: now,
        updatedAt: now,
      },
      {
        name: 'Backend Team',
        type: 'department',
        parentId: null,
        path: 'UNICX Corporation/Engineering/Backend Team',
        level: 2,
        isActive: true,
        tenantId: TENANT_ID,
        createdBy: 'system',
        createdAt: now,
        updatedAt: now,
      },
      {
        name: 'DevOps Team',
        type: 'department',
        parentId: null,
        path: 'UNICX Corporation/Engineering/DevOps Team',
        level: 2,
        isActive: true,
        tenantId: TENANT_ID,
        createdBy: 'system',
        createdAt: now,
        updatedAt: now,
      },
    ];

    const entities = await this.entityModel.insertMany(entitiesData);
    console.log(`✅ Created ${entities.length} entities`);
    return entities;
  }

  async seedUsers() {
    const now = new Date();
    
    const usersData = [
      // System Admin
      {
        phoneNumber: '+1234567890',
        email: 'admin@unicx.com',
        firstName: 'System',
        lastName: 'Administrator',
        password: bcrypt.hashSync('admin123', 12),
        role: 'SystemAdmin',
        registrationStatus: 'registered',
        whatsappConnectionStatus: 'connected',
        entityId: null, // Will be set after entities are created
        entityPath: 'UNICX Corporation',
        tenantId: TENANT_ID,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      // Tenant Admin
      {
        phoneNumber: '+1234567891',
        email: 'tenant.admin@unicx.com',
        firstName: 'Tenant',
        lastName: 'Administrator',
        password: bcrypt.hashSync('tenant123', 12),
        role: 'TenantAdmin',
        registrationStatus: 'registered',
        whatsappConnectionStatus: 'connected',
        entityId: null,
        entityPath: 'UNICX Corporation',
        tenantId: TENANT_ID,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      // Engineering Manager
      {
        phoneNumber: '+1234567892',
        email: 'engineering.manager@unicx.com',
        firstName: 'Engineering',
        lastName: 'Manager',
        password: bcrypt.hashSync('eng123', 12),
        role: 'User',
        registrationStatus: 'registered',
        whatsappConnectionStatus: 'connected',
        entityId: null,
        entityPath: 'UNICX Corporation/Engineering',
        tenantId: TENANT_ID,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      // Frontend Developer
      {
        phoneNumber: '+1234567893',
        email: 'frontend.dev@unicx.com',
        firstName: 'Frontend',
        lastName: 'Developer',
        password: bcrypt.hashSync('frontend123', 12),
        role: 'User',
        registrationStatus: 'registered',
        whatsappConnectionStatus: 'connected',
        entityId: null,
        entityPath: 'UNICX Corporation/Engineering/Frontend Team',
        tenantId: TENANT_ID,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      // Backend Developer
      {
        phoneNumber: '+1234567894',
        email: 'backend.dev@unicx.com',
        firstName: 'Backend',
        lastName: 'Developer',
        password: bcrypt.hashSync('backend123', 12),
        role: 'User',
        registrationStatus: 'registered',
        whatsappConnectionStatus: 'connected',
        entityId: null,
        entityPath: 'UNICX Corporation/Engineering/Backend Team',
        tenantId: TENANT_ID,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      // Sales Manager
      {
        phoneNumber: '+1234567895',
        email: 'sales.manager@unicx.com',
        firstName: 'Sales',
        lastName: 'Manager',
        password: bcrypt.hashSync('sales123', 12),
        role: 'User',
        registrationStatus: 'registered',
        whatsappConnectionStatus: 'connected',
        entityId: null,
        entityPath: 'UNICX Corporation/Sales',
        tenantId: TENANT_ID,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      // Marketing Specialist
      {
        phoneNumber: '+1234567896',
        email: 'marketing.specialist@unicx.com',
        firstName: 'Marketing',
        lastName: 'Specialist',
        password: bcrypt.hashSync('marketing123', 12),
        role: 'User',
        registrationStatus: 'registered',
        whatsappConnectionStatus: 'connected',
        entityId: null,
        entityPath: 'UNICX Corporation/Marketing',
        tenantId: TENANT_ID,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      // HR Manager
      {
        phoneNumber: '+1234567897',
        email: 'hr.manager@unicx.com',
        firstName: 'HR',
        lastName: 'Manager',
        password: bcrypt.hashSync('hr123', 12),
        role: 'User',
        registrationStatus: 'registered',
        whatsappConnectionStatus: 'connected',
        entityId: null,
        entityPath: 'UNICX Corporation/Human Resources',
        tenantId: TENANT_ID,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      // Pending user
      {
        phoneNumber: '+1234567898',
        email: 'pending.user@unicx.com',
        firstName: 'Pending',
        lastName: 'User',
        password: bcrypt.hashSync('pending123', 12),
        role: 'User',
        registrationStatus: 'pending',
        whatsappConnectionStatus: 'disconnected',
        entityId: null,
        entityPath: 'UNICX Corporation',
        tenantId: TENANT_ID,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      // Invited user
      {
        phoneNumber: '+1234567899',
        email: 'invited.user@unicx.com',
        firstName: 'Invited',
        lastName: 'User',
        password: '', // No password yet
        role: 'User',
        registrationStatus: 'invited',
        whatsappConnectionStatus: 'disconnected',
        entityId: null,
        entityPath: 'UNICX Corporation',
        tenantId: TENANT_ID,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    ];

    const users = await this.userModel.insertMany(usersData);
    console.log(`✅ Created ${users.length} users`);
    return users;
  }

  async seedQRInvitations(entities, users) {
    const now = new Date();
    const companyEntity = entities.find(e => e.name === 'UNICX Corporation');
    const engineeringEntity = entities.find(e => e.name === 'Engineering');
    const engineeringManager = users.find(u => u.email === 'engineering.manager@unicx.com');

    const qrInvitationsData = [
      {
        qrCodeId: crypto.randomBytes(16).toString('hex'),
        encryptedPayload: crypto.randomBytes(32).toString('hex'),
        status: 'sent',
        userId: engineeringManager?._id,
        tenantId: TENANT_ID,
        email: 'engineering.manager@unicx.com',
        expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000), // 24 hours
        emailDelivery: {
          sentAt: now,
          attemptCount: 1,
          isDelivered: true,
        },
        scanEvents: [],
        templateId: 'welcome',
        templateData: {
          entityName: 'UNICX Corporation',
          welcomeMessage: 'Welcome to UNICX Corporation!',
        },
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        qrCodeId: crypto.randomBytes(16).toString('hex'),
        encryptedPayload: crypto.randomBytes(32).toString('hex'),
        status: 'scanned',
        userId: engineeringManager?._id,
        tenantId: TENANT_ID,
        email: 'engineering.manager@unicx.com',
        expiresAt: new Date(now.getTime() + 48 * 60 * 60 * 1000), // 48 hours
        emailDelivery: {
          sentAt: new Date(now.getTime() - 2 * 60 * 60 * 1000), // 2 hours ago
          attemptCount: 1,
          deliveredAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
          isDelivered: true,
        },
        scanEvents: [
          {
            scannedAt: new Date(now.getTime() - 1 * 60 * 60 * 1000), // 1 hour ago
            ipAddress: '192.168.1.100',
            userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)',
            deviceInfo: 'iPhone 13',
            location: 'New York, NY',
          },
        ],
        templateId: 'team-welcome',
        templateData: {
          userName: 'Engineering Manager',
          department: 'Engineering',
          welcomeMessage: 'Welcome to the Engineering team!',
        },
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        qrCodeId: crypto.randomBytes(16).toString('hex'),
        encryptedPayload: crypto.randomBytes(32).toString('hex'),
        status: 'expired',
        userId: null,
        tenantId: TENANT_ID,
        email: 'event@unicx.com',
        expiresAt: new Date(now.getTime() - 24 * 60 * 60 * 1000), // Expired 24 hours ago
        emailDelivery: {
          sentAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
          attemptCount: 1,
          deliveredAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
          isDelivered: true,
        },
        scanEvents: Array.from({ length: 150 }, (_, i) => ({
          scannedAt: new Date(now.getTime() - (7 * 24 - i) * 60 * 60 * 1000),
          ipAddress: `192.168.1.${(i % 254) + 1}`,
          userAgent: 'Mozilla/5.0 (compatible; QR Scanner)',
          deviceInfo: 'Mobile Device',
          location: 'Various Locations',
        })),
        templateId: 'event-invitation',
        templateData: {
          eventName: 'Company All-Hands Meeting',
          date: '2025-01-15',
          location: 'Main Conference Room',
          description: 'Monthly all-hands meeting for all employees',
        },
        isActive: false,
        createdAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), // Created 7 days ago
        updatedAt: now,
      },
    ];

    const qrInvitations = await this.qrInvitationModel.insertMany(qrInvitationsData);
    console.log(`✅ Created ${qrInvitations.length} QR invitations`);
    return qrInvitations;
  }

  async seedOnboardingProgress(entities, users) {
    const now = new Date();
    const engineeringEntity = entities.find(e => e.name === 'Engineering');
    const frontendDev = users.find(u => u.email === 'frontend.dev@unicx.com');
    const backendDev = users.find(u => u.email === 'backend.dev@unicx.com');

    const onboardingProgressData = [
      {
        tenantId: TENANT_ID,
        adminUserId: frontendDev?._id,
        adminUserName: 'Frontend Developer',
        steps: [
          {
            stepId: 'welcome',
            stepName: 'Welcome to UNICX',
            stepDescription: 'Complete your welcome onboarding',
            status: 'completed',
            stepData: {
              completedAt: now,
              notes: 'Welcome completed successfully',
            },
            startedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000), // 2 hours ago
            completedAt: new Date(now.getTime() - 1 * 60 * 60 * 1000), // 1 hour ago
            estimatedDuration: 30,
            actualDuration: 15,
            prerequisites: [],
            isOptional: false,
            validationErrors: [],
          },
          {
            stepId: 'profile-setup',
            stepName: 'Profile Setup',
            stepDescription: 'Complete your user profile',
            status: 'in_progress',
            stepData: {
              progress: 60,
              currentStep: 'upload-photo',
            },
            startedAt: new Date(now.getTime() - 30 * 60 * 1000), // 30 minutes ago
            completedAt: undefined,
            estimatedDuration: 45,
            actualDuration: undefined,
            prerequisites: ['welcome'],
            isOptional: false,
            validationErrors: [],
          },
          {
            stepId: 'team-introduction',
            stepName: 'Team Introduction',
            stepDescription: 'Meet your team members',
            status: 'not_started',
            stepData: {},
            startedAt: undefined,
            completedAt: undefined,
            estimatedDuration: 60,
            actualDuration: undefined,
            prerequisites: ['profile-setup'],
            isOptional: true,
            validationErrors: [],
          },
        ],
        progressPercentage: 50,
        isCompleted: false,
        completedAt: undefined,
        isReset: false,
        resetAt: undefined,
        resetBy: undefined,
        metadata: {},
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        tenantId: TENANT_ID,
        adminUserId: backendDev?._id,
        adminUserName: 'Backend Developer',
        steps: [
          {
            stepId: 'welcome',
            stepName: 'Welcome to UNICX',
            stepDescription: 'Complete your welcome onboarding',
            status: 'completed',
            stepData: {
              completedAt: now,
              notes: 'Welcome completed',
            },
            startedAt: new Date(now.getTime() - 3 * 60 * 60 * 1000), // 3 hours ago
            completedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000), // 2 hours ago
            estimatedDuration: 30,
            actualDuration: 20,
            prerequisites: [],
            isOptional: false,
            validationErrors: [],
          },
          {
            stepId: 'profile-setup',
            stepName: 'Profile Setup',
            stepDescription: 'Complete your user profile',
            status: 'completed',
            stepData: {
              progress: 100,
              completedAt: now,
            },
            startedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000), // 2 hours ago
            completedAt: new Date(now.getTime() - 1 * 60 * 60 * 1000), // 1 hour ago
            estimatedDuration: 45,
            actualDuration: 30,
            prerequisites: ['welcome'],
            isOptional: false,
            validationErrors: [],
          },
          {
            stepId: 'team-introduction',
            stepName: 'Team Introduction',
            stepDescription: 'Meet your team members',
            status: 'completed',
            stepData: {
              completedAt: now,
              teamMembers: ['John Doe', 'Jane Smith'],
            },
            startedAt: new Date(now.getTime() - 1 * 60 * 60 * 1000), // 1 hour ago
            completedAt: new Date(now.getTime() - 30 * 60 * 1000), // 30 minutes ago
            estimatedDuration: 60,
            actualDuration: 45,
            prerequisites: ['profile-setup'],
            isOptional: true,
            validationErrors: [],
          },
        ],
        progressPercentage: 100,
        isCompleted: true,
        completedAt: new Date(now.getTime() - 30 * 60 * 1000), // 30 minutes ago
        isReset: false,
        resetAt: undefined,
        resetBy: undefined,
        metadata: {},
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    ];

    const onboardingProgress = await this.onboardingProgressModel.insertMany(onboardingProgressData);
    console.log(`✅ Created ${onboardingProgress.length} onboarding progress records`);
    return onboardingProgress;
  }

  async updateEntityHierarchy(entities) {
    const entityMap = new Map(entities.map(e => [e.name, e._id]));

    const updates = [
      { name: 'Engineering', parentName: 'UNICX Corporation' },
      { name: 'Sales', parentName: 'UNICX Corporation' },
      { name: 'Marketing', parentName: 'UNICX Corporation' },
      { name: 'Human Resources', parentName: 'UNICX Corporation' },
      { name: 'Frontend Team', parentName: 'Engineering' },
      { name: 'Backend Team', parentName: 'Engineering' },
      { name: 'DevOps Team', parentName: 'Engineering' },
    ];

    for (const update of updates) {
      const entityId = entityMap.get(update.name);
      const parentId = entityMap.get(update.parentName);

      if (entityId && parentId) {
        await this.entityModel.findByIdAndUpdate(entityId, { parentId });
      }
    }

    console.log('✅ Entity hierarchy updated');
  }
}

async function main() {
  console.log('🚀 UNICX Integration Database Seeder');
  console.log('=====================================');
  
  if (CLEAN_DATABASE) {
    console.log('⚠️  CLEAN MODE: Will delete all existing data');
  }

  try {
    // Create NestJS application context
    const app = await NestFactory.createApplicationContext(AppModule);
    
    // Get models
    const entityModel = app.get('EntityModel');
    const userModel = app.get('UserModel');
    const qrInvitationModel = app.get('QRInvitationModel');
    const onboardingProgressModel = app.get('OnboardingProgressModel');

    // Create seeder instance
    const seeder = new DatabaseSeeder(
      entityModel,
      userModel,
      qrInvitationModel,
      onboardingProgressModel
    );

    // Run seeding
    const stats = await seeder.seed();

    // Display results
    console.log('\n🎉 Database seeding completed successfully!');
    console.log('=====================================');
    console.log('📊 Summary:');
    console.log(`   🏢 Entities: ${stats.entities}`);
    console.log(`   👥 Users: ${stats.users}`);
    console.log(`   📱 QR Invitations: ${stats.qrInvitations}`);
    console.log(`   📋 Onboarding Progress: ${stats.onboardingProgress}`);
    
    console.log('\n🔐 Test Credentials:');
    console.log('   System Admin: admin@unicx.com / admin123');
    console.log('   Tenant Admin: tenant.admin@unicx.com / tenant123');
    console.log('   Engineering Manager: engineering.manager@unicx.com / eng123');
    console.log('   Frontend Dev: frontend.dev@unicx.com / frontend123');
    console.log('   Backend Dev: backend.dev@unicx.com / backend123');
    
    console.log('\n📱 Test Phone Numbers:');
    console.log('   +1234567890 (System Admin)');
    console.log('   +1234567891 (Tenant Admin)');
    console.log('   +1234567892 (Engineering Manager)');
    console.log('   +1234567893 (Frontend Developer)');
    console.log('   +1234567894 (Backend Developer)');

    await app.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}
