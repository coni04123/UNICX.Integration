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
const { Types } = require('mongoose');

// Import the compiled AppModule
const { AppModule } = require('../dist/app.module');

// Configuration
const CLEAN_DATABASE = process.argv.includes('--clean') || process.argv.includes('-c');

const rootEntityId = new Types.ObjectId();

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

    // Get root entity for tenantId
    const rootEntity = entities.find(e => e.name === 'UNICX Corporation');
    const tenantId = rootEntity._id.toString();

    // Seed users
    console.log('👥 Seeding users...');
    const users = await this.seedUsers(tenantId);
    stats.users = users.length;

    // Seed QR invitations
    console.log('📱 Seeding QR invitations...');
    const qrInvitations = await this.seedQRInvitations(entities, users, tenantId);
    stats.qrInvitations = qrInvitations.length;

    // Seed onboarding progress
    console.log('📋 Seeding onboarding progress...');
    const onboardingProgress = await this.seedOnboardingProgress(entities, users, tenantId);
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
    const mongoose = require('mongoose');
    
    // Create root entity first to get its ObjectId for tenantId
    
    
    const entitiesData = [
      // Root company
      {
        _id: rootEntityId,
        name: 'UNICX Corporation',
        type: 'company',
        parentId: null,
        path: 'UNICX Corporation',
        entityIdPath: [], // Root has no ancestors
        level: 0,
        isActive: true,
        tenantId: rootEntityId.toString(), // Root entity's ID as string
        createdBy: 'system',
        createdAt: now,
        updatedAt: now,
      },
      // Departments
      {
        name: 'Engineering',
        type: 'department',
        parentId: rootEntityId, // Will be updated later
        path: 'UNICX Corporation/Engineering',
        entityIdPath: [], // Will be calculated after hierarchy update
        level: 1,
        isActive: true,
        tenantId: rootEntityId.toString(), // Root entity's ID
        createdBy: 'system',
        createdAt: now,
        updatedAt: now,
      },
      {
        name: 'Sales',
        type: 'department',
        parentId: rootEntityId,
        path: 'UNICX Corporation/Sales',
        entityIdPath: [], // Will be calculated after hierarchy update
        level: 1,
        isActive: true,
        tenantId: rootEntityId.toString(), // Root entity's ID
        createdBy: 'system',
        createdAt: now,
        updatedAt: now,
      },
      {
        name: 'Marketing',
        type: 'department',
        parentId: rootEntityId,
        path: 'UNICX Corporation/Marketing',
        entityIdPath: [], // Will be calculated after hierarchy update
        level: 1,
        isActive: true,
        tenantId: rootEntityId.toString(), // Root entity's ID
        createdBy: 'system',
        createdAt: now,
        updatedAt: now,
      },
      {
        name: 'Human Resources',
        type: 'department',
        parentId: rootEntityId,
        path: 'UNICX Corporation/Human Resources',
        entityIdPath: [], // Will be calculated after hierarchy update
        level: 1,
        isActive: true,
        tenantId: rootEntityId.toString(), // Root entity's ID
        createdBy: 'system',
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: new Types.ObjectId("6547a1b2c3d4e5f6a7b8c9d0"),
        name: '2N5 LLC',
        type: 'company',
        parentId: null,
        path: '2N5 LLC',
        entityIdPath: [], // Root has no ancestors
        level: 0,
        isActive: true,
        tenantId: rootEntityId.toString(), // Root entity's ID as string
        createdBy: 'system',
        createdAt: now,
        updatedAt: now,
      },
    ];

    const entities = await this.entityModel.insertMany(entitiesData);
    console.log(`✅ Created ${entities.length} entities`);
    return entities;
  }

  async seedUsers(tenantId) {
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
        entityId: rootEntityId, // Will be set after entities are created
        entityPath: 'UNICX Corporation',
        entityIdPath: [], // Will be calculated after hierarchy update
        tenantId: tenantId, // Root entity's ID
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
        entityId: rootEntityId,
        entityPath: 'UNICX Corporation',
        entityIdPath: [], // Will be calculated after hierarchy update
        tenantId: tenantId, // Root entity's ID
        isActive: true,
        createdAt: now,
        updatedAt: now,
      }
    ];

    const users = await this.userModel.insertMany(usersData);
    console.log(`✅ Created ${users.length} users`);
    return users;
  }

  async seedQRInvitations(entities, users, tenantId) {
    const now = new Date();
    const companyEntity = entities.find(e => e.name === 'UNICX Corporation');
    const engineeringEntity = entities.find(e => e.name === 'Engineering');
    const engineeringManager = users.find(u => u.email === 'engineering.manager@unicx.com');

    const qrInvitationsData = [];

    const qrInvitations = await this.qrInvitationModel.insertMany(qrInvitationsData);
    console.log(`✅ Created ${qrInvitations.length} QR invitations`);
    return qrInvitations;
  }

  async seedOnboardingProgress(entities, users, tenantId) {
    const now = new Date();
    const companyEntity = entities.find(e => e.name === 'UNICX Corporation');
    const engineeringEntity = entities.find(e => e.name === 'Engineering');
    const frontendTeamEntity = entities.find(e => e.name === 'Frontend Team');
    const backendTeamEntity = entities.find(e => e.name === 'Backend Team');
    const frontendDev = users.find(u => u.email === 'frontend.dev@unicx.com');
    const backendDev = users.find(u => u.email === 'backend.dev@unicx.com');

    const onboardingProgressData = [];

    const onboardingProgress = await this.onboardingProgressModel.insertMany(onboardingProgressData);
    console.log(`✅ Created ${onboardingProgress.length} onboarding progress records`);
    return onboardingProgress;
  }

  async updateEntityHierarchy(entities) {
    const entityMap = new Map(entities.map(e => [e.name, e._id]));
    const entityTypeMap = new Map(entities.map(e => [e.name, e.type]));

    const updates = [
      { name: 'Engineering', parentName: 'UNICX Corporation' },
      { name: 'Sales', parentName: 'UNICX Corporation' },
      { name: 'Marketing', parentName: 'UNICX Corporation' },
      { name: 'Human Resources', parentName: 'UNICX Corporation' },
      { name: 'Frontend Team', parentName: 'Engineering' },
      { name: 'Backend Team', parentName: 'Engineering' },
      { name: 'DevOps Team', parentName: 'Engineering' },
    ];

    // First update parentIds
    for (const update of updates) {
      const entityId = entityMap.get(update.name);
      const parentId = entityMap.get(update.parentName);

      if (entityId && parentId) {
        await this.entityModel.findByIdAndUpdate(entityId, { parentId });
      }
    }

    // Now calculate and update entityIdPath for all entities
    const rootCompanyId = entityMap.get('UNICX Corporation');
    
    // Update root company to reference itself
    await this.entityModel.findByIdAndUpdate(rootCompanyId, {
      entityIdPath: [rootCompanyId],
    });

    // Update departments under root company
    for (const deptName of ['Engineering', 'Sales', 'Marketing', 'Human Resources']) {
      const deptId = entityMap.get(deptName);
      if (deptId) {
        await this.entityModel.findByIdAndUpdate(deptId, {
          entityIdPath: [rootCompanyId, deptId],
        });
      }
    }

    // Update sub-departments under Engineering
    const engineeringId = entityMap.get('Engineering');
    for (const teamName of ['Frontend Team', 'Backend Team', 'DevOps Team']) {
      const teamId = entityMap.get(teamName);
      if (teamId && engineeringId) {
        await this.entityModel.findByIdAndUpdate(teamId, {
          entityIdPath: [rootCompanyId, engineeringId, teamId],
        });
      }
    }

    // Update users with entityIdPath
    await this.updateUserEntityFields(entityMap);

    // Update QR invitations and onboarding progress
    await this.updateQRInvitationsEntityFields(entityMap);
    await this.updateOnboardingProgressEntityFields(entityMap);

    console.log('✅ Entity hierarchy and entityIdPath updated');
  }

  async updateUserEntityFields(entityMap) {
    const rootCompanyId = entityMap.get('UNICX Corporation');
    const engineeringId = entityMap.get('Engineering');
    const salesId = entityMap.get('Sales');
    const marketingId = entityMap.get('Marketing');
    const hrId = entityMap.get('Human Resources');
    const frontendTeamId = entityMap.get('Frontend Team');
    const backendTeamId = entityMap.get('Backend Team');

    // Update System Admin and Tenant Admin (root level)
    await this.userModel.updateMany(
      { email: { $in: ['admin@unicx.com', 'tenant.admin@unicx.com', 'pending.user@unicx.com', 'invited.user@unicx.com'] } },
      {
        entityId: rootCompanyId,
        entityIdPath: [rootCompanyId],
      }
    );

    // Update Engineering Manager
    await this.userModel.updateOne(
      { email: 'engineering.manager@unicx.com' },
      {
        entityId: engineeringId,
        entityIdPath: [rootCompanyId, engineeringId],
      }
    );

    // Update Frontend Developer
    await this.userModel.updateOne(
      { email: 'frontend.dev@unicx.com' },
      {
        entityId: frontendTeamId,
        entityIdPath: [rootCompanyId, engineeringId, frontendTeamId],
      }
    );

    // Update Backend Developer
    await this.userModel.updateOne(
      { email: 'backend.dev@unicx.com' },
      {
        entityId: backendTeamId,
        entityIdPath: [rootCompanyId, engineeringId, backendTeamId],
      }
    );

    // Update Sales Manager
    await this.userModel.updateOne(
      { email: 'sales.manager@unicx.com' },
      {
        entityId: salesId,
        entityIdPath: [rootCompanyId, salesId],
      }
    );

    // Update Marketing Specialist
    await this.userModel.updateOne(
      { email: 'marketing.specialist@unicx.com' },
      {
        entityId: marketingId,
        entityIdPath: [rootCompanyId, marketingId],
      }
    );

    // Update HR Manager
    await this.userModel.updateOne(
      { email: 'hr.manager@unicx.com' },
      {
        entityId: hrId,
        entityIdPath: [rootCompanyId, hrId],
      }
    );

    console.log('✅ User entity fields (entityId, entityIdPath) updated');
  }

  async updateQRInvitationsEntityFields(entityMap) {
    const rootCompanyId = entityMap.get('UNICX Corporation');
    const engineeringId = entityMap.get('Engineering');

    // Update QR invitations with entityIdPath
    // First invitation: Company level
    await this.qrInvitationModel.updateOne(
      { email: 'engineering.manager@unicx.com', status: 'sent' },
      {
        entityIdPath: [rootCompanyId],
      }
    );

    // Second invitation: Engineering department level
    await this.qrInvitationModel.updateOne(
      { email: 'engineering.manager@unicx.com', status: 'scanned' },
      {
        entityIdPath: [rootCompanyId, engineeringId],
      }
    );

    // Third invitation: Company level (event)
    await this.qrInvitationModel.updateOne(
      { email: 'event@unicx.com' },
      {
        entityIdPath: [rootCompanyId],
      }
    );

    console.log('✅ QR invitation entity fields (entityIdPath) updated');
  }

  async updateOnboardingProgressEntityFields(entityMap) {
    const rootCompanyId = entityMap.get('UNICX Corporation');
    const engineeringId = entityMap.get('Engineering');
    const frontendTeamId = entityMap.get('Frontend Team');
    const backendTeamId = entityMap.get('Backend Team');

    // Update Frontend Developer's onboarding progress
    await this.onboardingProgressModel.updateOne(
      { adminUserName: 'Frontend Developer' },
      {
        entityIdPath: [rootCompanyId, engineeringId, frontendTeamId],
      }
    );

    // Update Backend Developer's onboarding progress
    await this.onboardingProgressModel.updateOne(
      { adminUserName: 'Backend Developer' },
      {
        entityIdPath: [rootCompanyId, engineeringId, backendTeamId],
      }
    );

    console.log('✅ Onboarding progress entity fields (entityIdPath) updated');
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
