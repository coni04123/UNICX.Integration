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
const { Types } = require('mongoose');

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
        _id: new Types.ObjectId("507f1f77bcf86cd799612011"),
        name: 'UNICX Corporation',
        type: 'company',
        parentId: null,
        path: 'UNICX Corporation',
        level: 0,
        isActive: true,
        createdBy: 'system',
        createdAt: now,
        updatedAt: now,
      },
      // Departments
      {
        _id: new Types.ObjectId("507f1f77bcf86cd799612090"),
        name: 'Engineering',
        type: 'department',
        parentId: new Types.ObjectId("507f1f77bcf86cd799612011"),
        path: 'UNICX Corporation/Engineering',
        level: 1,
        isActive: true,
        createdBy: 'system',
        createdAt: now,
        updatedAt: now,
      },
      {
        name: 'Sales',
        type: 'department',
        parentId: new Types.ObjectId("507f1f77bcf86cd799612011"),
        path: 'UNICX Corporation/Sales',
        level: 1,
        isActive: true,
        createdBy: 'system',
        createdAt: now,
        updatedAt: now,
      },
      {
        name: 'Marketing',
        type: 'department',
        parentId: new Types.ObjectId("507f1f77bcf86cd799612011"),
        path: 'UNICX Corporation/Marketing',
        level: 1,
        isActive: true,
        createdBy: 'system',
        createdAt: now,
        updatedAt: now,
      },
      {
        name: 'Human Resources',
        type: 'department',
        parentId: new Types.ObjectId("507f1f77bcf86cd799612011"),
        path: 'UNICX Corporation/Human Resources',
        level: 1,
        isActive: true,
        createdBy: 'system',
        createdAt: now,
        updatedAt: now,
      },
      // Sub-departments
      {
        name: 'Frontend Team',
        type: 'department',
        parentId: new Types.ObjectId("507f1f77bcf86cd799612090"),
        path: 'UNICX Corporation/Engineering/Frontend Team',
        level: 2,
        isActive: true,
        createdBy: 'system',
        createdAt: now,
        updatedAt: now,
      },
      {
        name: 'Backend Team',
        type: 'department',
        parentId: new Types.ObjectId("507f1f77bcf86cd799612090"),
        path: 'UNICX Corporation/Engineering/Backend Team',
        level: 2,
        isActive: true,
        createdBy: 'system',
        createdAt: now,
        updatedAt: now,
      },
      {
        name: 'DevOps Team',
        type: 'department',
        parentId: new Types.ObjectId("507f1f77bcf86cd799612090"),
        path: 'UNICX Corporation/Engineering/DevOps Team',
        level: 2,
        isActive: true,
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
        entityId: new Types.ObjectId("000000000000000000000000"),
        entityPath: 'UNICX Corporation',
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
        entityId: new Types.ObjectId("507f1f77bcf86cd799612011"), // Will be set after entities are created
        entityPath: 'UNICX Corporation',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      //Engineering Team
      {
        phoneNumber: '+1234567892',
        email: 'engineering.manager@unicx.com',
        firstName: 'Engineering',
        lastName: 'Manager',
        password: bcrypt.hashSync('eng123', 12),
        role: 'User',
        registrationStatus: 'registered',
        whatsappConnectionStatus: 'connected',
        entityId: new Types.ObjectId("507f1f77bcf86cd799612011"),
        entityPath: 'UNICX Corporation/Engineering',
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
