# User Management Module

This module consolidates user-related functionality that was previously spread across multiple modules:
- QR code management (from `qr-codes` module)
- User progress tracking (from `onboarding` module)
- WhatsApp session integration

## Architecture Changes

### Removed Modules
- ❌ `qr-codes` module (replaced by WhatsApp sessions)
- ❌ `onboarding` module (simplified to user status tracking)

### New Features
- ✅ WhatsApp QR codes integrated directly into user data
- ✅ User progress tracking through registration status
- ✅ Simplified architecture with fewer dependencies

## Usage

### Getting User QR Code
```typescript
import { UserManagementService } from './user-management.service';

@Injectable()
export class YourService {
  constructor(private userManagementService: UserManagementService) {}

  async getQRCode(userId: string) {
    return this.userManagementService.getWhatsAppQR(userId);
  }
}
```

### Tracking User Progress
```typescript
import { UserManagementService } from './user-management.service';
import { RegistrationStatus } from '../../common/schemas/user.schema';

@Injectable()
export class YourService {
  constructor(private userManagementService: UserManagementService) {}

  async updateProgress(userId: string) {
    await this.userManagementService.updateUserProgress(
      userId,
      RegistrationStatus.REGISTERED
    );
  }
}
```

### Getting Progress Stats
```typescript
import { UserManagementService } from './user-management.service';

@Injectable()
export class YourService {
  constructor(private userManagementService: UserManagementService) {}

  async getStats(tenantId?: string) {
    return this.userManagementService.getUserProgressStats(tenantId);
  }
}
```

## Data Model

### User Schema Extensions
```typescript
export type WhatsAppQR = {
  qrCode: string;
  expiresAt: Date;
  sessionId: string;
};

export type UserDocument = User & Document & {
  whatsappQR?: WhatsAppQR;
};
```

## Benefits

1. **Simplified Architecture**
   - Fewer modules to maintain
   - Clear responsibility boundaries
   - Reduced code duplication

2. **Better Integration**
   - WhatsApp QR codes directly in user data
   - Progress tracking through standard user status
   - Unified user management interface

3. **Improved Performance**
   - Fewer database queries
   - Reduced complexity
   - Better caching opportunities

## Migration Notes

If you're upgrading from the old architecture:

1. Update imports:
   ```typescript
   // Old
   import { QrCodesService } from '../qr-codes/qr-codes.service';
   import { OnboardingService } from '../onboarding/onboarding.service';

   // New
   import { UserManagementService } from '../user-management/user-management.service';
   ```

2. Replace QR code calls:
   ```typescript
   // Old
   const qrCode = await qrCodesService.generateQR(userId);

   // New
   const qrCode = await userManagementService.getWhatsAppQR(userId);
   ```

3. Replace progress tracking:
   ```typescript
   // Old
   await onboardingService.updateProgress(userId, step);

   // New
   await userManagementService.updateUserProgress(userId, status);
   ```

## Database Changes

The following collections are no longer used:
- `qr_invitations`
- `onboarding_progresses`

Run the cleanup script to remove these:
```bash
node scripts/cleanup-schemas.js
```
