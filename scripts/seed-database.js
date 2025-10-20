#!/usr/bin/env node

/**
 * Database Seeding Script for UNICX Integration Backend
 * 
 * This script initializes the MongoDB database with minimal seed data:
 * - One special "System" entity (for System Administrators)
 * - One System Administrator user (no tenantId, no phoneNumber, belongs to System entity)
 * - Empty collections for other entities and WhatsApp sessions
 * 
 * Usage:
 *   npm run seed:js
 *   npm run seed:js:clean
 *   node scripts/seed-database.js
 *   node scripts/seed-database.js --clean
 * 
 * System Admin Credentials:
 *   Email: admin@unicx.com
 *   Password: admin123
 *   Entity: System (uses SYSTEM_ENTITY_ID constant)
 */

const { NestFactory } = require('@nestjs/core');
const bcrypt = require('bcryptjs');
const { Types } = require('mongoose');

// Import the compiled AppModule
const { AppModule } = require('../dist/app.module');

// Import System Entity constants
const { SYSTEM_ENTITY_ID, SYSTEM_ENTITY_NAME, SYSTEM_ENTITY_TYPE } = require('../dist/common/constants/system-entity');

// Configuration
const CLEAN_DATABASE = process.argv.includes('--clean') || process.argv.includes('-c');

class DatabaseSeeder {
  constructor(entityModel, userModel, whatsappSessionModel) {
    this.entityModel = entityModel;
    this.userModel = userModel;
    this.whatsappSessionModel = whatsappSessionModel;
  }

  async seed() {
    console.log('🌱 Starting database seeding...');
    
    if (CLEAN_DATABASE) {
      await this.cleanDatabase();
    }

    const stats = {
      entities: 0,
      users: 0,
      whatsappSessions: 0,
    };

    // Seed system entity first (required for system admin)
    console.log('🏢 Seeding system entity...');
    const entities = await this.seedEntities();
    stats.entities = entities.length;

    // Seed system admin user
    console.log('👥 Seeding system admin user...');
    const users = await this.seedUsers();
    stats.users = users.length;

    return stats;
  }

  async cleanDatabase() {
    console.log('🧹 Cleaning existing data...');
    
    // Delete data from current collections
    await Promise.all([
      this.entityModel.deleteMany({}),
      this.userModel.deleteMany({}),
      this.whatsappSessionModel.deleteMany({}),
    ]);

    // Fix phone number index
    console.log('🔧 Fixing phone number index...');
    try {
      // Drop old index if it exists
      await this.userModel.collection.dropIndex('phoneNumber_1');
      console.log('✅ Dropped old phone number index');
    } catch (error) {
      // Index might not exist, which is fine
      console.log('ℹ️  No old phone number index to drop');
    }

    // Create new partial unique index
    await this.userModel.collection.createIndex(
      { phoneNumber: 1 },
      { 
        unique: true, 
        partialFilterExpression: { phoneNumber: { $type: 'string' } },
        background: true
      }
    );
    console.log('✅ Created new partial unique index for phone numbers');
    
    console.log('✅ Database cleaned and indexes updated');
  }

  async seedEntities() {
    return [];
  }

  async seedUsers() {
    const now = new Date();
    
    const usersData = [
      // System Admin - belongs to System entity, no tenantId, no phoneNumber required
      {
        email: 'admin@unicx.com',
        firstName: 'System',
        lastName: 'Administrator',
        password: bcrypt.hashSync('admin123', 12),
        role: 'SystemAdmin',
        registrationStatus: 'registered',
        whatsappConnectionStatus: 'disconnected',
        entityId: SYSTEM_ENTITY_ID,
        entityPath: SYSTEM_ENTITY_NAME,
        entityIdPath: [SYSTEM_ENTITY_ID],
        tenantId: null, // SystemAdmin has no tenant
        isActive: true,
        createdAt: now,
        updatedAt: now,
      }
    ];

    const users = await this.userModel.insertMany(usersData);
    console.log(`✅ Created ${users.length} user (System Admin)`);
    return users;
  }

  async seedWhatsAppSessions() {
    // No WhatsApp sessions to seed - they are created when users are invited
    console.log(`✅ No WhatsApp sessions created (empty by design)`);
    return [];
  }

  async updateEntityHierarchy() {
    // No hierarchy to update - no entities seeded
    console.log('✅ No entity hierarchy to update (empty by design)');
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
    const whatsappSessionModel = app.get('WhatsAppSessionModel');

    // Create seeder instance
    const seeder = new DatabaseSeeder(
      entityModel,
      userModel,
      whatsappSessionModel
    );

    // Run seeding
    const stats = await seeder.seed();

    // Display results
    console.log('\n🎉 Database seeding completed successfully!');
    console.log('=====================================');
    console.log('📊 Summary:');
    console.log(`   🏢 Entities: ${stats.entities}`);
    console.log(`   👥 Users: ${stats.users}`);
    console.log(`   📱 WhatsApp Sessions: ${stats.whatsappSessions}`);
    
    console.log('\n🔐 System Admin Credentials:');
    console.log('   Email: admin@unicx.com');
    console.log('   Password: admin123');
    console.log('   Role: SystemAdmin');
    console.log(`   Entity: ${SYSTEM_ENTITY_NAME} (ID: ${SYSTEM_ENTITY_ID})`);
    console.log('   Note: Belongs to special System entity, no tenantId or phoneNumber');

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
