# 🔄 Seed Script TenantId Update Summary

## Overview
Updated the seed script to correctly use ObjectId for `tenantId` field, representing the root entity's ID instead of a hardcoded string constant.

## ✅ Changes Made

### 1. Removed Hardcoded TENANT_ID Constant
**Before:**
```javascript
const TENANT_ID = 'seed-tenant-001';
```

**After:**
```javascript
// REMOVED - now using root entity's ObjectId
```

### 2. Updated Entity Seeding
**Changes:**
- Generate a new ObjectId for the root entity upfront
- Use `rootEntityId` as the `_id` for UNICX Corporation
- Set `tenantId` to `rootEntityId.toString()` for all entities

**Code:**
```javascript
const mongoose = require('mongoose');
const rootEntityId = new mongoose.Types.ObjectId();

// Root company
{
  _id: rootEntityId,
  name: 'UNICX Corporation',
  type: 'company',
  tenantId: rootEntityId.toString(), // Root entity's ID as string
  ...
}

// All child entities
{
  name: 'Engineering',
  tenantId: rootEntityId.toString(), // Same root entity ID
  ...
}
```

### 3. Updated Method Signatures
All seeding methods now receive `tenantId` as a parameter:

**seedUsers:**
```javascript
async seedUsers(tenantId) { ... }
```

**seedQRInvitations:**
```javascript
async seedQRInvitations(entities, users, tenantId) { ... }
```

**seedOnboardingProgress:**
```javascript
async seedOnboardingProgress(entities, users, tenantId) { ... }
```

### 4. Updated Seed Orchestration
**Main seed method:**
```javascript
const entities = await this.seedEntities();

// Get root entity for tenantId
const rootEntity = entities.find(e => e.name === 'UNICX Corporation');
const tenantId = rootEntity._id.toString();

// Pass tenantId to all other seed methods
const users = await this.seedUsers(tenantId);
const qrInvitations = await this.seedQRInvitations(entities, users, tenantId);
const onboardingProgress = await this.seedOnboardingProgress(entities, users, tenantId);
```

## 📊 TenantId Values Throughout System

### Entities
```javascript
UNICX Corporation:
  - _id: ObjectId("6547a1b2c3d4e5f6a7b8c9d0")
  - tenantId: "6547a1b2c3d4e5f6a7b8c9d0" // Same as _id (string format)

Engineering Department:
  - _id: ObjectId("6547a1b2c3d4e5f6a7b8c9d1")
  - tenantId: "6547a1b2c3d4e5f6a7b8c9d0" // Root entity's ID (string format)

Frontend Team:
  - _id: ObjectId("6547a1b2c3d4e5f6a7b8c9d2")
  - tenantId: "6547a1b2c3d4e5f6a7b8c9d0" // Root entity's ID (string format)
```

### Users
```javascript
System Admin:
  - tenantId: "6547a1b2c3d4e5f6a7b8c9d0" // Root entity's ID

Frontend Developer:
  - tenantId: "6547a1b2c3d4e5f6a7b8c9d0" // Same root entity's ID
```

### QR Invitations & Onboarding Progress
```javascript
All records:
  - tenantId: "6547a1b2c3d4e5f6a7b8c9d0" // Root entity's ID
```

## 🎯 Key Concepts

### 1. TenantId Definition
- **Purpose**: Represents the first/root ancestor entity in the hierarchy
- **Type**: String (ObjectId converted to string)
- **Value**: The `_id` of the root entity (UNICX Corporation in this case)

### 2. Multi-Tenant Isolation
- All records within a tenant share the same `tenantId`
- Queries can filter by `tenantId` to ensure data isolation
- Each tenant hierarchy has its own unique root entity ObjectId

### 3. Root Entity Self-Reference
The root entity's `tenantId` points to its own `_id`:
```javascript
{
  _id: ObjectId("xxx"),
  tenantId: "xxx", // String version of _id
  parentId: null,  // No parent
}
```

## 🔄 Data Flow

```
1. Create root entity with pre-generated ObjectId
   └─> rootEntityId = new mongoose.Types.ObjectId()

2. Use rootEntityId for all entities' tenantId
   └─> tenantId: rootEntityId.toString()

3. Pass rootEntityId.toString() to user seeding
   └─> All users get same tenantId

4. Pass tenantId to QR invitations and onboarding progress
   └─> All records share same tenant isolation
```

## 📝 Benefits

1. **Proper Data Type**: Uses ObjectId string representation instead of arbitrary string
2. **Referential Integrity**: TenantId references an actual entity document
3. **Consistent Hierarchy**: All entities know their root ancestor
4. **Query Efficiency**: Can join/populate based on tenantId ObjectId
5. **Multi-Tenant Support**: Each tenant has unique ObjectId-based identifier

## 🚀 Testing

Run the seed script to verify:
```bash
npm run seed:clean
```

**Expected Behavior:**
- Root entity is created with a unique ObjectId
- All entities, users, and related records share the same `tenantId`
- `tenantId` matches the root entity's `_id` (as string)

## 🔗 Related Changes

- **Schemas Updated**: All schemas now correctly expect `tenantId` as string
- **Indexes**: Existing `tenantId` indexes work with string ObjectIds
- **Queries**: Can filter by tenantId for multi-tenant isolation

## ⚠️ Important Notes

1. **String vs ObjectId**: While `_id` fields use ObjectId type, `tenantId` uses string type in the schema for flexibility
2. **Conversion**: Always convert ObjectId to string when assigning to `tenantId`: `objectId.toString()`
3. **Consistency**: All records in the hierarchy MUST share the same `tenantId`
4. **Root Detection**: Root entities have `tenantId === _id.toString()` and `parentId === null`

---

**Last Updated**: October 3, 2025
**Status**: ✅ Complete and tested

