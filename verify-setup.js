#!/usr/bin/env node

/**
 * UNICX Integration Backend - Setup Verification Script
 * 
 * This script checks if all required dependencies and configuration are in place.
 */

const fs = require('fs');
const path = require('path');

console.log('\n🔍 UNICX Integration Backend - Setup Verification\n');
console.log('='.repeat(60));

let allChecksPass = true;

// Check 1: Node.js version
console.log('\n📦 Checking Node.js version...');
const nodeVersion = process.version;
const requiredMajor = 18;
const currentMajor = parseInt(nodeVersion.slice(1).split('.')[0]);

if (currentMajor >= requiredMajor) {
  console.log(`✅ Node.js ${nodeVersion} (>= ${requiredMajor}.x required)`);
} else {
  console.log(`❌ Node.js ${nodeVersion} (>= ${requiredMajor}.x required)`);
  allChecksPass = false;
}

// Check 2: package.json
console.log('\n📄 Checking package.json...');
if (fs.existsSync('./package.json')) {
  console.log('✅ package.json exists');
  const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
  console.log(`   Name: ${pkg.name}`);
  console.log(`   Version: ${pkg.version}`);
} else {
  console.log('❌ package.json not found');
  allChecksPass = false;
}

// Check 3: node_modules
console.log('\n📚 Checking dependencies...');
if (fs.existsSync('./node_modules')) {
  console.log('✅ node_modules directory exists');
  const modules = ['@nestjs/core', '@nestjs/common', 'mongoose', 'redis'];
  modules.forEach(mod => {
    const modPath = path.join('./node_modules', mod);
    if (fs.existsSync(modPath)) {
      console.log(`   ✅ ${mod}`);
    } else {
      console.log(`   ❌ ${mod} not found`);
      allChecksPass = false;
    }
  });
} else {
  console.log('❌ node_modules not found. Run: npm install');
  allChecksPass = false;
}

// Check 4: TypeScript files
console.log('\n📝 Checking source files...');
const requiredFiles = [
  'src/main.ts',
  'src/app.module.ts',
  'tsconfig.json'
];

requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} not found`);
    allChecksPass = false;
  }
});

// Check 5: Environment file
console.log('\n⚙️  Checking environment configuration...');
if (fs.existsSync('.env')) {
  console.log('✅ .env file exists');
  const envContent = fs.readFileSync('.env', 'utf8');
  const requiredVars = [
    'MONGODB_URI',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'REDIS_HOST'
  ];
  
  requiredVars.forEach(varName => {
    if (envContent.includes(varName)) {
      console.log(`   ✅ ${varName} configured`);
    } else {
      console.log(`   ⚠️  ${varName} not found`);
    }
  });
} else {
  console.log('⚠️  .env file not found');
  console.log('   Run: cp env.example .env');
  console.log('   Then edit .env with your configuration');
}

// Check 6: Documentation
console.log('\n📖 Checking documentation...');
const docFiles = [
  'README.md',
  'API_QUICK_START.md',
  'IMPLEMENTATION_GUIDE.md'
];

docFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} not found`);
  }
});

// Summary
console.log('\n' + '='.repeat(60));
if (allChecksPass) {
  console.log('\n✅ All checks passed! Your setup is ready.');
  console.log('\n📝 Next steps:');
  console.log('   1. Configure .env file (if not done)');
  console.log('   2. Start MongoDB and Redis');
  console.log('   3. Run: npm run start:dev');
  console.log('   4. Visit: http://localhost:3000/api/docs');
} else {
  console.log('\n⚠️  Some checks failed. Please review the errors above.');
  console.log('\n💡 Common fixes:');
  console.log('   - Run: npm install');
  console.log('   - Check Node.js version: node --version');
  console.log('   - Ensure all files are properly downloaded');
}

console.log('\n📚 For detailed instructions, see INSTALLATION_SUCCESS.md');
console.log('\n');

