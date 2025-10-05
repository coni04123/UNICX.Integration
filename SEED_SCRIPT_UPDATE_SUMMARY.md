# 🌱 Seed Script Update Summary

## Overview
Updated the database seeding script to reflect the new schema fields added to support entity hierarchy tracking.

## ✅ Changes Made

### 1. Schema Updates (Completed Previously)
All schemas were updated to include:
- **`companyId`** (ObjectId, optional) - References the nearest ancestor entity with type 'company'
- **`entityIdPath`** (ObjectId[], default []) - Array of all ancestor entity IDs from root to current
- **`tenantId`** (string, required) - Root/first ancestor entity ID for tenant isolation

Updated schemas:
- ✅ `user.schema.ts`
- ✅ `entity.schema.ts`
- ✅ `qr-invitation.schema.ts`
- ✅ `onboarding-progress.schema.ts`

### 2. Seed Script Updates (`scripts/seed-database.js`)

#### Entity Seeding
- Added `entityIdPath: []` (placeholder) to all entities
- Added `companyId: null` (placeholder) to all entities
- These values are calculated and updated after the hierarchy is established

#### User Seeding
- Added `entityIdPath: []` (placeholder) to all 10 users
- Added `companyId: null` (placeholder) to all users
- These values are calculated and updated based on their assigned entity

#### QR Invitation Seeding
- Added `entityId` to link invitations to specific entities
- Added `entityIdPath: []` (placeholder) to all 3 QR invitations
- Added `companyId` to reference the associated company

#### Onboarding Progress Seeding
- Added `entityId` to link progress records to specific entities
- Added `entityIdPath: []` (placeholder) to both onboarding records
- Added `companyId` to reference the associated company

### 3. New Methods Added

#### `updateEntityHierarchy(entities)` - Enhanced
- Now calculates and updates `entityIdPath` and `companyId` for all entities
- Sets root company's `companyId` to reference itself
- Sets proper `entityIdPath` arrays for all levels of the hierarchy
- Calls helper methods to update related records

#### `updateUserEntityFields(entityMap)` - New
Updates all users with proper entity hierarchy values:
- System Admin/Tenant Admin: `entityIdPath: [UNICX Corp]`
- Engineering Manager: `entityIdPath: [UNICX Corp, Engineering]`
- Frontend Dev: `entityIdPath: [UNICX Corp, Engineering, Frontend Team]`
- Backend Dev: `entityIdPath: [UNICX Corp, Engineering, Backend Team]`
- Sales Manager: `entityIdPath: [UNICX Corp, Sales]`
- Marketing Specialist: `entityIdPath: [UNICX Corp, Marketing]`
- HR Manager: `entityIdPath: [UNICX Corp, HR]`

#### `updateQRInvitationsEntityFields(entityMap)` - New
Updates QR invitations with proper entity hierarchy:
- Company welcome invitation: `entityIdPath: [UNICX Corp]`
- Engineering invitation: `entityIdPath: [UNICX Corp, Engineering]`
- Event invitation: `entityIdPath: [UNICX Corp]`

#### `updateOnboardingProgressEntityFields(entityMap)` - New
Updates onboarding progress records:
- Frontend Developer: `entityIdPath: [UNICX Corp, Engineering, Frontend Team]`
- Backend Developer: `entityIdPath: [UNICX Corp, Engineering, Backend Team]`

## 📊 Entity Hierarchy Structure

```
UNICX Corporation (company, level 0)
├── companyId: self
├── entityIdPath: [UNICX Corporation]
├── Engineering (department, level 1)
│   ├── companyId: UNICX Corporation
│   ├── entityIdPath: [UNICX Corporation, Engineering]
│   ├── Frontend Team (department, level 2)
│   │   ├── companyId: UNICX Corporation
│   │   └── entityIdPath: [UNICX Corporation, Engineering, Frontend Team]
│   ├── Backend Team (department, level 2)
│   │   ├── companyId: UNICX Corporation
│   │   └── entityIdPath: [UNICX Corporation, Engineering, Backend Team]
│   └── DevOps Team (department, level 2)
│       ├── companyId: UNICX Corporation
│       └── entityIdPath: [UNICX Corporation, Engineering, DevOps Team]
├── Sales (department, level 1)
│   ├── companyId: UNICX Corporation
│   └── entityIdPath: [UNICX Corporation, Sales]
├── Marketing (department, level 1)
│   ├── companyId: UNICX Corporation
│   └── entityIdPath: [UNICX Corporation, Marketing]
└── Human Resources (department, level 1)
    ├── companyId: UNICX Corporation
    └── entityIdPath: [UNICX Corporation, Human Resources]
```

## 🎯 Key Design Decisions

### 1. Required vs Optional Fields
Following the schema definitions:
- **`tenantId`**: Required (string) - Must be set during seeding
- **`entityIdPath`**: Default `[]` - Optional, calculated after hierarchy setup
- **`companyId`**: Optional (ObjectId) - Calculated based on entity hierarchy
- **`entityId`**: Required for Users, optional for QR/Onboarding

### 2. Two-Phase Approach
1. **Initial Creation**: Create records with placeholder values (`[]` or `null`)
2. **Hierarchy Update**: Calculate and update proper values after relationships are established

This approach avoids circular dependency issues and ensures data integrity.

### 3. Company ID Logic
- Root company entity: `companyId` references itself
- All descendants: `companyId` references the nearest ancestor with `type: 'company'`
- In this seed: All non-company entities reference "UNICX Corporation"

## 🚀 Usage

```bash
# Seed with sample data (preserves existing data)
npm run seed

# Clean seed (removes all existing data first)
npm run seed:clean

# Using JavaScript directly
node scripts/seed-database.js
node scripts/seed-database.js --clean
```

## ✨ Benefits

1. **Complete Hierarchy Tracking**: Every record knows its full ancestry
2. **Fast Company Queries**: Direct reference to parent company
3. **Efficient Path Queries**: Array-based ancestry enables advanced filtering
4. **Data Integrity**: Proper validation and required field handling
5. **Test-Ready**: Comprehensive sample data for development and testing

## 📝 Notes

- All placeholder values are properly set to `[]` or `null` to satisfy schema defaults
- The seed script automatically calculates hierarchy values after entity creation
- Console logs confirm each update step for debugging
- No linter errors or validation issues

## 🔗 Related Files

- `src/common/schemas/user.schema.ts`
- `src/common/schemas/entity.schema.ts`
- `src/common/schemas/qr-invitation.schema.ts`
- `src/common/schemas/onboarding-progress.schema.ts`
- `scripts/seed-database.js`

---

**Last Updated**: October 3, 2025
**Status**: ✅ Complete and ready to use

