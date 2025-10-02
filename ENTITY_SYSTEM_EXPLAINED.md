# 🏗️ Entity System - Complete Technical Explanation

## Table of Contents
1. [Tenant vs Entity - Core Concept](#tenant-vs-entity)
2. [Entity Types Explained](#entity-types)
3. [Entity Structure Building Logic](#structure-building-logic)
4. [Path Generation Algorithm](#path-generation)
5. [Level Calculation](#level-calculation)
6. [Circular Reference Prevention](#circular-reference-prevention)
7. [Complete Flow Examples](#flow-examples)

---

## 🏢 Tenant vs Entity - Core Concept

### **Tenant** - Multi-Tenant Isolation (Horizontal)

**What is it?**
- A **tenant** is a **top-level organization/company** in a multi-tenant SaaS system
- Think of it as a **completely isolated workspace**
- Each tenant's data is **completely separated** from other tenants

**Purpose:**
- **Data Isolation**: Tenant A cannot see Tenant B's data
- **Security Boundary**: Each tenant is a security perimeter
- **Billing Unit**: Subscriptions are per tenant
- **Admin Scope**: TenantAdmin can only manage their own tenant

**Real-World Analogy:**
```
Tenant = Different companies using the same software

🏢 Tenant: "Acme Corporation" (tenantId: "acme-corp")
   - Has their own entities
   - Has their own users
   - Has their own data

🏢 Tenant: "TechStart Inc" (tenantId: "techstart-inc")
   - Has their own entities
   - Has their own users  
   - Has their own data

❌ Acme Corp CANNOT see TechStart Inc's data
❌ TechStart Inc CANNOT see Acme Corp's data
```

**Database Level:**
```typescript
// Every query MUST filter by tenantId
db.entities.find({ tenantId: "acme-corp" })  // Only Acme's entities
db.users.find({ tenantId: "acme-corp" })     // Only Acme's users
```

---

### **Entity** - Organizational Hierarchy (Vertical)

**What is it?**
- An **entity** is an **organizational unit WITHIN a tenant**
- It represents the **internal structure** of the organization
- Entities form a **hierarchical tree** (unlimited depth)

**Purpose:**
- **Organizational Structure**: Model real company structure
- **User Assignment**: Users belong to specific entities
- **Access Control**: Permissions based on entity hierarchy
- **Reporting**: Group data by department/company/division

**Real-World Analogy:**
```
Entity = Departments/Teams within a company

Within Tenant "Acme Corporation":
🏢 Root Entity: "Acme HQ"
   ├── 🏢 Company: "North America Division"
   │   ├── 👥 Department: "Sales"
   │   ├── 👥 Department: "Marketing"
   │   └── 👥 Department: "Engineering"
   │       ├── 👥 Team: "Backend Team"
   │       └── 👥 Team: "Frontend Team"
   └── 🏢 Company: "Europe Division"
       └── 👥 Department: "Operations"
```

**Key Difference:**

| Aspect | Tenant | Entity |
|--------|--------|--------|
| **Scope** | Entire organization | Department/Team within org |
| **Isolation** | Complete data separation | Hierarchical within tenant |
| **Storage** | String ID (`tenantId: "acme-corp"`) | MongoDB ObjectId reference |
| **Relationship** | Independent (no parent) | Tree structure (has parent) |
| **Purpose** | Multi-tenancy | Organization structure |
| **User sees** | Only their tenant | Entities they have access to |

---

## 📊 Entity Types Explained

The system defines 3 entity types (Line 6-10 in `entity.schema.ts`):

```typescript
export enum EntityType {
  ENTITY = 'entity',      // Root/High-level organization
  COMPANY = 'company',    // Business unit/Division
  DEPARTMENT = 'department', // Team/Department/Section
}
```

### **1. ENTITY Type** 🏢

**Purpose:** Root-level or major organizational unit

**Use Cases:**
- Root entity (no parent)
- Holding company
- Major divisions
- Regional headquarters

**Examples:**
```javascript
{
  name: "Global Headquarters",
  type: "entity",
  parentId: null,           // ← ROOT ENTITY
  level: 0,
  path: "Global Headquarters"
}

{
  name: "North America Region",
  type: "entity",
  parentId: "hq-id",
  level: 1,
  path: "Global Headquarters > North America Region"
}
```

**Characteristics:**
- ✅ Can be root (parentId = null)
- ✅ Can have unlimited children
- ✅ Usually at higher levels (0-2)
- 🎯 Best for: Main organization, regions, major divisions

---

### **2. COMPANY Type** 🏢

**Purpose:** Business unit, subsidiary, or division

**Use Cases:**
- Subsidiary companies
- Business divisions
- Operating units
- Branch offices

**Examples:**
```javascript
{
  name: "Acme Technologies LLC",
  type: "company",
  parentId: "region-id",
  level: 2,
  path: "Global HQ > North America > Acme Technologies LLC"
}

{
  name: "Western Branch",
  type: "company",
  parentId: "company-id",
  level: 3,
  path: "Global HQ > North America > Acme Tech > Western Branch"
}
```

**Characteristics:**
- ✅ Can be root or child
- ✅ Can have unlimited children
- ✅ Usually at mid levels (1-3)
- 🎯 Best for: Companies, divisions, branches

---

### **3. DEPARTMENT Type** 👥

**Purpose:** Teams, departments, or working groups

**Use Cases:**
- Functional departments (Sales, Marketing, HR)
- Project teams
- Working groups
- Sub-teams

**Examples:**
```javascript
{
  name: "Sales Department",
  type: "department",
  parentId: "company-id",
  level: 3,
  path: "Global HQ > Acme Tech > Sales Department"
}

{
  name: "Enterprise Sales Team",
  type: "department",
  parentId: "sales-dept-id",
  level: 4,
  path: "Global HQ > Acme Tech > Sales Dept > Enterprise Sales Team"
}
```

**Characteristics:**
- ⚠️ Usually NOT root (but technically can be)
- ✅ Can have children (sub-departments)
- ✅ Usually at deeper levels (2-6+)
- 👤 Users typically assigned here
- 🎯 Best for: Departments, teams, groups

---

### **Type Comparison Table:**

| Feature | ENTITY | COMPANY | DEPARTMENT |
|---------|--------|---------|------------|
| Can be root? | ✅ Yes (typical) | ⚠️ Yes (rare) | ⚠️ Yes (rare) |
| Common levels | 0-2 | 1-3 | 2-6+ |
| Has children? | ✅ Yes | ✅ Yes | ✅ Yes |
| Users assigned? | ⚠️ Rare | ⚠️ Sometimes | ✅ Typical |
| Purpose | Structure | Business units | Work groups |
| Icon in UI | 🏢 Purple | 🏢 Blue | 👥 Green |

**Important:** These types are **semantic labels** for organization, not hard constraints. The system treats them identically in terms of hierarchy logic.

---

## 🔧 Entity Structure Building Logic

### **Core Data Structure (Lines 13-52 in entity.schema.ts)**

```typescript
class Entity {
  _id: ObjectId;           // Unique ID (auto-generated)
  name: string;            // Display name
  type: EntityType;        // entity | company | department
  parentId: ObjectId;      // Reference to parent (null = root)
  path: string;            // Full hierarchy path (auto-generated)
  tenantId: string;        // Tenant isolation
  level: number;           // Depth in tree (0 = root)
  metadata: Object;        // Custom data
  isActive: boolean;       // Soft delete flag
  createdBy: string;       // Audit trail
}
```

### **Key Concepts:**

#### **1. Adjacency List Pattern** (Line 23-24)
```typescript
@Prop({ type: Types.ObjectId, ref: 'Entity', default: null })
parentId: Types.ObjectId;  // Self-referencing!
```

**How it works:**
- Each entity stores a **reference to its parent**
- Root entities have `parentId: null`
- Creates a **tree structure** in the database

**Example Data:**
```javascript
// Root
{ _id: "A", name: "HQ", parentId: null }

// Children of A
{ _id: "B", name: "Sales", parentId: "A" }
{ _id: "C", name: "Marketing", parentId: "A" }

// Grandchild of A (child of B)
{ _id: "D", name: "Enterprise Sales", parentId: "B" }
```

**Tree Visualization:**
```
      A (HQ)
     / \
    B   C
   /     
  D      
```

---

#### **2. Path Materialization** (Line 26-27)
```typescript
@Prop({ required: true })
path: string;  // Stores full path for fast queries
```

**Purpose:** Enables fast "get all descendants" queries without recursion

**How it works:**
- Path is **auto-generated** on create/update
- Stores **full hierarchy** as a string
- Separator: `" > "`

**Generation Logic (Lines 215-231):**
```typescript
private async generatePath(name: string, parentId: string | null, tenantId: string): Promise<string> {
  // If no parent → this is root
  if (!parentId) {
    return name;  // Root path = just the name
  }

  // Find parent entity
  const parent = await this.entityModel.findOne({
    _id: parentId,
    tenantId,
    isActive: true,
  });

  if (!parent) {
    throw new NotFoundException('Parent entity not found');
  }

  // Concatenate parent's path + current name
  return `${parent.path} > ${name}`;
}
```

**Example Execution:**

```javascript
// Creating entities step by step:

// Step 1: Create root
create({ name: "HQ", parentId: null })
→ path = "HQ"

// Step 2: Create child of HQ
create({ name: "Sales", parentId: "hq-id" })
→ parent.path = "HQ"
→ path = "HQ > Sales"

// Step 3: Create grandchild
create({ name: "Enterprise Team", parentId: "sales-id" })
→ parent.path = "HQ > Sales"
→ path = "HQ > Sales > Enterprise Team"
```

**Benefits:**
- ✅ Fast hierarchy queries: `path LIKE "HQ > Sales%"`
- ✅ No recursion needed to get full path
- ✅ Human-readable in database
- ⚠️ Must update on entity rename/move

---

#### **3. Level Tracking** (Line 32-33)
```typescript
@Prop({ required: true, default: 0 })
level: number;  // Depth in tree (0-based)
```

**Purpose:** Quick depth queries without counting parents

**Calculation Logic (Lines 233-241):**
```typescript
private async calculateLevel(parentId: string, tenantId: string): Promise<number> {
  const parent = await this.entityModel.findOne({
    _id: parentId,
    tenantId,
    isActive: true,
  });

  return parent ? parent.level : 0;
}

// Usage in create (Line 44):
const level = parentId ? await this.calculateLevel(parentId, tenantId) + 1 : 0;
```

**Example:**
```javascript
// Root entity
{ name: "HQ", parentId: null, level: 0 }

// Child (+1 from parent)
{ name: "Sales", parentId: "hq", level: 0 + 1 = 1 }

// Grandchild (+1 from parent)
{ name: "Team A", parentId: "sales", level: 1 + 1 = 2 }

// Great-grandchild (+1 from parent)
{ name: "Squad 1", parentId: "team-a", level: 2 + 1 = 3 }
```

**Benefits:**
- ✅ Filter by depth: `level <= 2` (get only 2 levels)
- ✅ Calculate in O(1) time
- ✅ Useful for UI indentation
- ⚠️ Must update on entity move

---

## 🔄 Complete Creation Flow

### **Creating an Entity (Lines 19-58):**

```typescript
async create(createEntityDto: CreateEntityDto, userId: string): Promise<Entity> {
  const { name, type, parentId, tenantId, metadata } = createEntityDto;

  // ═══════════════════════════════════════
  // STEP 1: Validate Parent (if provided)
  // ═══════════════════════════════════════
  if (parentId) {
    // Check parent exists in same tenant
    const parent = await this.entityModel.findOne({
      _id: parentId,
      tenantId,        // ← TENANT ISOLATION
      isActive: true,
    });

    if (!parent) {
      throw new NotFoundException('Parent entity not found');
    }

    // Check for circular references
    // (e.g., trying to make parent a child of itself)
    if (await this.wouldCreateCircularReference(parentId, tenantId)) {
      throw new BadRequestException('Cannot create circular reference');
    }
  }

  // ═══════════════════════════════════════
  // STEP 2: Generate Path
  // ═══════════════════════════════════════
  const path = await this.generatePath(name, parentId, tenantId);
  // Examples:
  // - No parent: "HQ"
  // - With parent: "HQ > Sales > Team A"

  // ═══════════════════════════════════════
  // STEP 3: Calculate Level
  // ═══════════════════════════════════════
  const level = parentId ? await this.calculateLevel(parentId, tenantId) + 1 : 0;
  // Examples:
  // - Root: 0
  // - Child of root: 1
  // - Grandchild: 2

  // ═══════════════════════════════════════
  // STEP 4: Create Entity
  // ═══════════════════════════════════════
  const entity = new this.entityModel({
    name,
    type,
    parentId: parentId || null,  // null for root
    path,                         // Auto-generated
    tenantId,                     // Tenant isolation
    level,                        // Auto-calculated
    metadata: metadata || {},
    createdBy: userId,
  });

  // ═══════════════════════════════════════
  // STEP 5: Save to Database
  // ═══════════════════════════════════════
  return entity.save();
}
```

---

## 🔁 Circular Reference Prevention

### **The Problem:**
```
Entity A → Entity B → Entity C
                ↓         ↑
                └─────────┘  ❌ CIRCULAR!
```

If we allowed this, we'd have infinite loops when traversing the tree.

### **Prevention Logic (Lines 243-261):**

```typescript
private async wouldCreateCircularReference(
  parentId: string, 
  tenantId: string, 
  excludeId?: string  // For move operations
): Promise<boolean> {
  
  const parent = await this.entityModel.findOne({
    _id: parentId,
    tenantId,
    isActive: true
  });

  if (!parent) {
    return false;  // Parent doesn't exist, no circular ref
  }

  // For move operations: check if new parent is a descendant
  if (excludeId) {
    // Get ALL descendants of the entity being moved
    const descendants = await this.getAllDescendants(excludeId, tenantId);
    
    // If the new parent is in the descendants list → CIRCULAR!
    return descendants.some(desc => desc._id.toString() === parentId);
  }

  return false;
}
```

### **Example:**

```javascript
// Current structure:
A (level 0)
└── B (level 1)
    └── C (level 2)

// User tries to move A under C
move(entityId: "A", newParentId: "C")

// Check:
descendants of A = [B, C]  // Recursive search
newParentId = "C"
Is "C" in [B, C]? → YES! ❌ CIRCULAR REFERENCE DETECTED!
```

---

## 📦 Complete Real-World Example

### **Scenario: Creating a Multi-Level Organization**

```javascript
// ═══════════════════════════════════════
// TENANT: Acme Corporation
// tenantId: "acme-corp"
// ═══════════════════════════════════════

// ───────────────────────────────────────
// 1. Create Root Entity
// ───────────────────────────────────────
POST /api/v1/entities
{
  "name": "Acme Global",
  "type": "entity",
  "parentId": null,  // ← ROOT
  "tenantId": "acme-corp"
}

Result:
{
  "_id": "A001",
  "name": "Acme Global",
  "type": "entity",
  "parentId": null,
  "path": "Acme Global",  // ← Generated
  "level": 0,              // ← Calculated
  "tenantId": "acme-corp"
}

// ───────────────────────────────────────
// 2. Create Company under Root
// ───────────────────────────────────────
POST /api/v1/entities
{
  "name": "North America Division",
  "type": "company",
  "parentId": "A001",  // ← Parent is root
  "tenantId": "acme-corp"
}

// Backend processing:
// 1. Find parent: A001 ✓
// 2. Generate path: "Acme Global" + " > " + "North America Division"
// 3. Calculate level: 0 + 1 = 1

Result:
{
  "_id": "A002",
  "name": "North America Division",
  "type": "company",
  "parentId": "A001",
  "path": "Acme Global > North America Division",  // ← Generated
  "level": 1,                                       // ← Calculated
  "tenantId": "acme-corp"
}

// ───────────────────────────────────────
// 3. Create Department under Company
// ───────────────────────────────────────
POST /api/v1/entities
{
  "name": "Engineering",
  "type": "department",
  "parentId": "A002",  // ← Parent is company
  "tenantId": "acme-corp"
}

// Backend processing:
// 1. Find parent: A002 ✓ (path="Acme Global > North America Division", level=1)
// 2. Generate path: "Acme Global > North America Division" + " > " + "Engineering"
// 3. Calculate level: 1 + 1 = 2

Result:
{
  "_id": "A003",
  "name": "Engineering",
  "type": "department",
  "parentId": "A002",
  "path": "Acme Global > North America Division > Engineering",  // ← Generated
  "level": 2,                                                     // ← Calculated
  "tenantId": "acme-corp"
}

// ───────────────────────────────────────
// 4. Create Sub-Department
// ───────────────────────────────────────
POST /api/v1/entities
{
  "name": "Backend Team",
  "type": "department",
  "parentId": "A003",  // ← Parent is Engineering
  "tenantId": "acme-corp"
}

Result:
{
  "_id": "A004",
  "name": "Backend Team",
  "type": "department",
  "parentId": "A003",
  "path": "Acme Global > North America Division > Engineering > Backend Team",  // ← Generated
  "level": 3,                                                                   // ← Calculated
  "tenantId": "acme-corp"
}
```

### **Final Tree Structure:**

```
🏢 Acme Global (ENTITY, Level 0)
   └── 🏢 North America Division (COMPANY, Level 1)
       └── 👥 Engineering (DEPARTMENT, Level 2)
           └── 👥 Backend Team (DEPARTMENT, Level 3)

All belong to tenantId: "acme-corp"
```

---

## 🔄 Moving Entities (Lines 122-159)

### **Move Operation Logic:**

```typescript
async move(id: string, moveEntityDto: MoveEntityDto, userId: string, tenantId: string): Promise<Entity> {
  // Get entity being moved
  const entity = await this.findOne(id, tenantId);
  const { newParentId } = moveEntityDto;

  // ═══════════════════════════════════════
  // STEP 1: Validate New Parent
  // ═══════════════════════════════════════
  if (newParentId) {
    const newParent = await this.entityModel.findOne({
      _id: newParentId,
      tenantId,
      isActive: true,
    });

    if (!newParent) {
      throw new NotFoundException('New parent entity not found');
    }

    // ⚠️ CRITICAL: Prevent circular references
    if (await this.wouldCreateCircularReference(newParentId, tenantId, id)) {
      throw new BadRequestException('Cannot create circular reference');
    }
  }

  // ═══════════════════════════════════════
  // STEP 2: Calculate New Path & Level
  // ═══════════════════════════════════════
  const newPath = await this.generatePath(entity.name, newParentId, tenantId);
  const newLevel = newParentId ? await this.calculateLevel(newParentId, tenantId) + 1 : 0;

  // ═══════════════════════════════════════
  // STEP 3: Update Entity
  // ═══════════════════════════════════════
  await this.entityModel.findByIdAndUpdate(id, {
    parentId: newParentId || null,
    path: newPath,
    level: newLevel,
    updatedBy: userId,
  });

  // ═══════════════════════════════════════
  // STEP 4: Update ALL Descendants
  // ═══════════════════════════════════════
  // This is CRITICAL! When we move an entity,
  // all its children's paths & levels must update
  await this.updateDescendantsPaths(id, tenantId);

  return this.findOne(id, tenantId);
}
```

### **Descendant Update Logic (Lines 280-293):**

```typescript
private async updateDescendantsPaths(entityId: string, tenantId: string): Promise<void> {
  // Get ALL descendants recursively
  const descendants = await this.getAllDescendants(entityId, tenantId);
  
  // For each descendant, recalculate path & level
  for (const descendant of descendants) {
    const newPath = await this.generatePath(
      descendant.name, 
      descendant.parentId?.toString(), 
      tenantId
    );
    const newLevel = await this.calculateLevel(
      descendant.parentId?.toString(), 
      tenantId
    ) + 1;

    await this.entityModel.findByIdAndUpdate(descendant._id, {
      path: newPath,
      level: newLevel,
    });
  }
}
```

### **Example Move Operation:**

```javascript
// Before move:
A (level 0, path: "A")
├── B (level 1, path: "A > B")
│   └── C (level 2, path: "A > B > C")
└── D (level 1, path: "A > D")

// Move B under D:
move(entityId: "B", newParentId: "D")

// After move:
A (level 0, path: "A")
└── D (level 1, path: "A > D")
    └── B (level 2, path: "A > D > B")  ← Updated!
        └── C (level 3, path: "A > D > B > C")  ← Also updated!

// Notice:
// - B's level: 1 → 2
// - B's path: "A > B" → "A > D > B"
// - C's level: 2 → 3  (cascade!)
// - C's path: "A > B > C" → "A > D > B > C"  (cascade!)
```

---

## 🎯 Key Takeaways

### **1. Tenant vs Entity:**
```
Tenant (Horizontal Isolation)     Entity (Vertical Hierarchy)
        ↓                                  ↓
[Acme Corp] [TechStart]           Root → Company → Department → Team
     ↓           ↓                   ↓
  Entities    Entities             Users assigned here
  Users       Users
```

### **2. Three Auto-Computed Fields:**
```typescript
parentId     → You provide (or null for root)
↓
path         → Auto-generated recursively
level        → Auto-calculated from parent
tenantId     → You provide (for isolation)
```

### **3. Data Structure Pattern:**
- **Adjacency List**: Each entity stores `parentId`
- **Path Materialization**: Full path stored for performance
- **Level Denormalization**: Depth stored for quick queries

### **4. Safety Mechanisms:**
- ✅ Circular reference prevention
- ✅ Tenant isolation on every query
- ✅ Cascade updates on move
- ✅ Soft delete (isActive flag)
- ✅ Cannot delete with children/users

---

## 📚 Summary

**Tenant:**
- Top-level isolation boundary
- Each customer/organization
- `tenantId: "acme-corp"`

**Entity:**
- Organizational structure within tenant
- Hierarchical tree (unlimited depth)
- Types: entity, company, department (semantic labels)

**Structure Building:**
- Self-referencing via `parentId`
- Auto-generated `path` for fast queries
- Auto-calculated `level` for depth tracking
- Circular reference prevention
- Cascade updates on move operations

**Every entity has:**
- Unique ID
- Name & type
- Parent reference (null for root)
- Full path (auto-generated)
- Level depth (auto-calculated)
- Tenant isolation (always filtered)

This design enables **unlimited organizational flexibility** while maintaining **performance and data integrity**! 🚀

