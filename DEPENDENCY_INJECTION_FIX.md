# Dependency Injection Error Fix

## Error Description

```
ERROR [ExceptionHandler] Nest can't resolve dependencies of the EmailProcessor (?, EmailService). 
Please make sure that the argument "QRInvitationModel" at index [0] is available in the QueueModule context.
```

## Root Cause

The `QueueModule` was trying to instantiate processor classes that depend on:
1. **Mongoose Models** (via `@InjectModel()` decorator)
2. **EmailService** (from EmailModule)

However, the `QueueModule` did **not import** the modules that provide these dependencies:
- `DatabaseModule` - Provides all Mongoose models
- `EmailModule` - Provides EmailService

## Understanding NestJS Dependency Injection

In NestJS, for a module to use providers from another module:
1. The providing module must **export** the providers
2. The consuming module must **import** the providing module

### The Problem

```typescript
// ❌ BEFORE - Missing imports
@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'email' },
      { name: 'qr-code' },
      { name: 'whatsapp' },
      { name: 'cleanup' },
    ),
    // Missing DatabaseModule - provides Mongoose models
    // Missing EmailModule - provides EmailService
  ],
  providers: [
    EmailProcessor,    // Needs QRInvitationModel, EmailService
    QRCodeProcessor,   // Needs QRInvitationModel
    WhatsAppProcessor, // Needs UserModel
    CleanupProcessor,  // Needs QRInvitationModel
  ],
  exports: [BullModule],
})
export class QueueModule {}
```

### The Solution

```typescript
// ✅ AFTER - With proper imports
@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'email' },
      { name: 'qr-code' },
      { name: 'whatsapp' },
      { name: 'cleanup' },
    ),
    DatabaseModule, // ✅ Provides all Mongoose models
    EmailModule,    // ✅ Provides EmailService
  ],
  providers: [
    EmailProcessor,
    QRCodeProcessor,
    WhatsAppProcessor,
    CleanupProcessor,
  ],
  exports: [BullModule],
})
export class QueueModule {}
```

## Affected Processors

### 1. EmailProcessor
**Dependencies:**
- `QRInvitationModel` (from DatabaseModule)
- `EmailService` (from EmailModule)

```typescript
@Injectable()
@Processor('email')
export class EmailProcessor {
  constructor(
    @InjectModel(QRInvitation.name)
    private qrInvitationModel: Model<QRInvitation>, // ← Needs DatabaseModule
    private emailService: EmailService,              // ← Needs EmailModule
  ) {}
}
```

### 2. QRCodeProcessor
**Dependencies:**
- `QRInvitationModel` (from DatabaseModule)

```typescript
@Injectable()
@Processor('qr-code')
export class QRCodeProcessor {
  constructor(
    @InjectModel(QRInvitation.name)
    private qrInvitationModel: Model<QRInvitation>, // ← Needs DatabaseModule
  ) {}
}
```

### 3. WhatsAppProcessor
**Dependencies:**
- `UserModel` (from DatabaseModule)

```typescript
@Injectable()
@Processor('whatsapp')
export class WhatsAppProcessor {
  constructor(
    @InjectModel(User.name)
    private userModel: Model<User>, // ← Needs DatabaseModule
  ) {}
}
```

### 4. CleanupProcessor
**Dependencies:**
- `QRInvitationModel` (from DatabaseModule)

```typescript
@Injectable()
@Processor('cleanup')
export class CleanupProcessor {
  constructor(
    @InjectModel(QRInvitation.name)
    private qrInvitationModel: Model<QRInvitation>, // ← Needs DatabaseModule
  ) {}
}
```

## How DatabaseModule Provides Models

The `DatabaseModule` uses `MongooseModule.forFeature()` to register models and export them:

```typescript
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Entity.name, schema: EntitySchema },
      { name: User.name, schema: UserSchema },
      { name: QRInvitation.name, schema: QRInvitationSchema },
      { name: OnboardingProgress.name, schema: OnboardingProgressSchema },
    ]),
  ],
  exports: [MongooseModule], // ✅ Exports models for other modules
})
export class DatabaseModule {}
```

## NestJS Module Import Best Practices

### 1. Import Required Modules
Always import modules that provide the dependencies your providers need.

### 2. Export Reusable Providers
If your module provides services/models that others need, export them:

```typescript
@Module({
  imports: [...],
  providers: [MyService],
  exports: [MyService], // ✅ Other modules can now use MyService
})
export class MyModule {}
```

### 3. Use Global Modules Sparingly
While `@Global()` can make a module's providers available everywhere, it's better to explicitly import modules to maintain clarity:

```typescript
// ❌ Avoid - Makes dependencies unclear
@Global()
@Module({...})
export class DatabaseModule {}

// ✅ Prefer - Makes dependencies explicit
@Module({
  imports: [DatabaseModule],
  ...
})
export class MyModule {}
```

## Verification Steps

### 1. Check Build
```bash
npm run build
# Should complete with 0 errors
```

### 2. Start Development Server
```bash
npm run start:dev
# Should start without dependency errors
```

### 3. Verify Processors Initialize
Check logs for processor initialization:
```
[Nest] INFO [EmailProcessor] Email processor initialized
[Nest] INFO [QRCodeProcessor] QR code processor initialized
[Nest] INFO [WhatsAppProcessor] WhatsApp processor initialized
[Nest] INFO [CleanupProcessor] Cleanup processor initialized
```

### 4. Test Queue Operations
Verify that jobs can be added and processed:
```typescript
// In a service
await this.emailQueue.add('send-invitation', {
  invitationId: '...',
  email: 'test@example.com',
  ...
});
```

## Common Dependency Injection Errors

### Error 1: Missing Import
```
Nest can't resolve dependencies of X (?). 
Please make sure that the argument "Y" at index [0] is available in the Z context.
```

**Solution:** Import the module that provides `Y` into module `Z`.

### Error 2: Circular Dependency
```
Nest cannot create the module instance. 
The module at index [0] of the "imports" array is undefined.
```

**Solution:** Use `forwardRef()` or restructure modules to avoid circular imports.

### Error 3: Provider Not Exported
```
Nest can't resolve dependencies of X (?).
```

**Solution:** Ensure the providing module exports the required provider.

## File Changes Summary

### Modified File
- `src/common/queue/queue.module.ts`

### Changes Made
1. Added import for `DatabaseModule`
2. Added import for `EmailModule`
3. Added inline comments explaining what each module provides

### Lines Changed
```diff
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
+ import { DatabaseModule } from '../database/database.module';
+ import { EmailModule } from '../../modules/email/email.module';
import { EmailProcessor } from './processors/email.processor';
import { QRCodeProcessor } from './processors/qr-code.processor';
import { WhatsAppProcessor } from './processors/whatsapp.processor';
import { CleanupProcessor } from './processors/cleanup.processor';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'email' },
      { name: 'qr-code' },
      { name: 'whatsapp' },
      { name: 'cleanup' },
    ),
+   DatabaseModule, // Provides Mongoose models
+   EmailModule,    // Provides EmailService
  ],
  providers: [
    EmailProcessor,
    QRCodeProcessor,
    WhatsAppProcessor,
    CleanupProcessor,
  ],
  exports: [BullModule],
})
export class QueueModule {}
```

## Testing the Fix

### 1. Unit Testing
Ensure processors can be instantiated in tests:

```typescript
describe('EmailProcessor', () => {
  let processor: EmailProcessor;
  let qrInvitationModel: Model<QRInvitation>;
  let emailService: EmailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [DatabaseModule, EmailModule],
      providers: [EmailProcessor],
    }).compile();

    processor = module.get<EmailProcessor>(EmailProcessor);
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });
});
```

### 2. Integration Testing
Test that jobs are processed correctly:

```typescript
describe('Email Queue Integration', () => {
  it('should process invitation emails', async () => {
    await emailQueue.add('send-invitation', {
      invitationId: testInvitation._id,
      email: 'test@example.com',
      templateId: 'invitation',
      templateData: { name: 'Test User' },
      tenantId: 'test-tenant',
    });

    // Wait for job to complete
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Verify invitation was updated
    const invitation = await qrInvitationModel.findById(testInvitation._id);
    expect(invitation.status).toBe(QRInvitationStatus.SENT);
  });
});
```

## Related Documentation

- [NestJS Modules Documentation](https://docs.nestjs.com/modules)
- [NestJS Dependency Injection](https://docs.nestjs.com/fundamentals/custom-providers)
- [Mongoose Module in NestJS](https://docs.nestjs.com/techniques/mongodb)
- [Bull Queues in NestJS](https://docs.nestjs.com/techniques/queues)

## Prevention

To prevent similar issues in the future:

1. **Always check dependencies** when creating new providers
2. **Import required modules** that provide those dependencies
3. **Use TypeScript** - it will catch many DI issues at compile time
4. **Write unit tests** that instantiate providers through the NestJS testing module
5. **Review module imports** when adding new providers to a module

## Status

✅ **FIXED** - QueueModule now properly imports DatabaseModule and EmailModule  
✅ **TESTED** - Build successful and server starts without errors  
✅ **VERIFIED** - All processors can be instantiated with their dependencies

---

**Date Fixed:** October 1, 2025  
**Issue Type:** Dependency Injection / Module Configuration  
**Severity:** Critical (Prevented application startup)  
**Resolution Time:** Immediate  
**Files Modified:** 1 file (`src/common/queue/queue.module.ts`)


