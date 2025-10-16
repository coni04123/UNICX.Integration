#!/usr/bin/env node

/**
 * Schema Cleanup Script for UNICX Integration Backend
 * 
 * This script removes unused schemas and their collections:
 * - QR Invitation (replaced by WhatsApp session QR codes)
 * - Onboarding Progress (simplified to user status)
 */

const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module');

async function main() {
  console.log('🧹 Starting schema cleanup...');

  try {
    // Create NestJS application context
    const app = await NestFactory.createApplicationContext(AppModule);
    
    // Get Mongoose connection
    const connection = app.get('DatabaseConnection');
    
    // Drop unused collections
    console.log('Dropping qr_invitations collection...');
    await connection.dropCollection('qr_invitations');
    
    console.log('Dropping onboarding_progresses collection...');
    await connection.dropCollection('onboarding_progresses');
    
    // Delete schema files
    const fs = require('fs');
    const path = require('path');
    
    const filesToDelete = [
      '../src/common/schemas/qr-invitation.schema.ts',
      '../src/common/schemas/onboarding-progress.schema.ts'
    ];
    
    for (const file of filesToDelete) {
      const filePath = path.join(__dirname, file);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`Deleted ${file}`);
      }
    }

    console.log('\n✅ Schema cleanup completed successfully!');
    console.log('=====================================');
    console.log('Removed:');
    console.log('  - QR Invitation schema and collection');
    console.log('  - Onboarding Progress schema and collection');
    console.log('\nNote: WhatsApp session QR codes are now used for user invitations');

    await app.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}
