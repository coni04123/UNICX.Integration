import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, RegistrationStatus, UserRole, WhatsAppConnectionStatus } from '../../common/schemas/user.schema';
import { Entity } from '../../common/schemas/entity.schema';
import { AuthService } from '../auth/auth.service';
import { EmailService } from '../email/email.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { InviteUserDto } from './dto/invite-user.dto';
import { SYSTEM_ENTITY_ID, isSystemAdmin } from '../../common/constants/system-entity';
import { BulkInviteUserDto } from './dto/bulk-invite-user.dto';
import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';
const bcrypt = require('bcryptjs');

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectModel(User.name)
    private userModel: Model<User>,
    @InjectModel(Entity.name)
    private entityModel: Model<Entity>,
    private authService: AuthService,
    private emailService: EmailService,
    @Inject(forwardRef(() => WhatsAppService))
    private whatsappService: WhatsAppService,
  ) {}

  async create(createUserDto: CreateUserDto, createdBy: string): Promise<User> {
    const { phoneNumber, email, firstName, lastName, entityId, tenantId, role } = createUserDto;

    // Validate E164 phone number only if provided (required for User, optional for TenantAdmin)
    let e164Phone = null;
    if (phoneNumber) {
      if (!isValidPhoneNumber(phoneNumber)) {
        throw new BadRequestException('Invalid phone number format');
      }
      const parsedPhone = parsePhoneNumber(phoneNumber);
      e164Phone = parsedPhone.format('E.164');
    } else if (role !== UserRole.TENANT_ADMIN) {
      // Phone number is required for regular Users
      throw new BadRequestException('Phone number is required for User role');
    }

    // Check if user already exists
    const existingUserQuery: any[] = [{ email }];
    if (e164Phone) {
      existingUserQuery.push({ phoneNumber: e164Phone });
    }
    
    const existingUser = await this.userModel.findOne({
      $or: existingUserQuery,
    });

    if (existingUser) {
      throw new BadRequestException('User with this phone number or email already exists');
    }

    // Validate entity exists
    const entity = await this.entityModel.findOne({
      _id: entityId,
      isActive: true,
    });

    if (!entity) {
      throw new NotFoundException('Entity not found');
    }

    // Generate password hash
    // const password = await this.authService.hashPassword("tenant123");
    const password = bcrypt.hashSync('tenant123', 12);

    // Build user data - only include phoneNumber if provided
    const userData: any = {
      email,
      firstName,
      lastName,
      password,
      entityId,
      entityPath: entity.path,
      tenantId: entity.tenantId,
      role: role || UserRole.USER,
      registrationStatus: RegistrationStatus.REGISTERED,
      createdBy,
    };
    
    // Only include phoneNumber if it exists (not null/undefined)
    if (e164Phone) {
      userData.phoneNumber = e164Phone;
    }

    const user = new this.userModel(userData);

    return user.save();
  }

  async findAll(tenantId: string, filters?: any): Promise<{ users: User[], total: number, page: number, limit: number, totalPages: number }> {
    const query: any = { isActive: true };

    // Only filter by tenantId if provided (SystemAdmin has no tenantId)
    if (tenantId && tenantId !== '') {
      query.tenantId = new Types.ObjectId(tenantId);
    }

    if (filters?.registrationStatus) {
      query.registrationStatus = filters.registrationStatus;
    }

    if (filters?.role) {
      query.role = filters.role;
    }

    if (filters?.entityId) {
      if (filters?.entityId !== SYSTEM_ENTITY_ID.toString())
        query.entityIdPath = new Types.ObjectId(filters.entityId);
    }

    if (filters?.whatsappConnectionStatus) {
      query.whatsappConnectionStatus = filters.whatsappConnectionStatus;
    }

    if (filters?.search) {
      query.$or = [
        { firstName: { $regex: filters.search, $options: 'i' } },
        { lastName: { $regex: filters.search, $options: 'i' } },
        { email: { $regex: filters.search, $options: 'i' } },
        { phoneNumber: { $regex: filters.search, $options: 'i' } },
      ];
    }

    // Pagination
    const page = parseInt(filters?.page) || 1;
    const limit = parseInt(filters?.limit) || 10;
    const skip = (page - 1) * limit;

    // Get total count for pagination
    const total = await this.userModel.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    // Get paginated users
    const users = await this.userModel
      .find(query)
      .populate('entityId', 'name path type')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Get WhatsApp QR codes for users with phone numbers
    const usersWithQR = await Promise.all(users.map(async (user) => {
      const userObj = user.toObject();
      
      if (user.phoneNumber) {
        try {
          const sessionId = `whatsapp-${user.phoneNumber.slice(1)}`;
          const qrData = await this.whatsappService.getQRCode(sessionId);
          if (qrData) {
            return {
              ...userObj,
              whatsappQR: {
                qrCode: qrData.qrCode,
                expiresAt: qrData.expiresAt,
                sessionId: sessionId
              }
            };
          }
        } catch (error) {
          this.logger.warn(`Failed to get QR code for user ${user._id}: ${error.message}`);
        }
      }
      
      return userObj;
    }));

    return {
      users: usersWithQR,
      total,
      page,
      limit,
      totalPages,
    };
  }

  async findOne(id: string, tenantId: string): Promise<User> {
    const user = await this.userModel.findOne({
      _id: new Types.ObjectId(id),
      isActive: true,
    }).populate('entityId', 'name path type');

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async findByPhoneNumber(phoneNumber: string, tenantId: string): Promise<User> {
    const query: any = {
      phoneNumber,
      isActive: true,
    };
    
    // Only filter by tenantId if provided (SystemAdmin has no tenantId)
    if (tenantId && tenantId !== '') {
      query.tenantId = new Types.ObjectId(tenantId);
    }
    
    const user = await this.userModel.findOne(query);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto, updatedBy: string, tenantId: string): Promise<User> {
    const user = await this.findOne(id, tenantId);

    const updateData: any = {
      ...updateUserDto,
      updatedBy,
    };

    // If phone number is being updated, validate E164 format
    if (updateUserDto.phoneNumber) {
      if (!isValidPhoneNumber(updateUserDto.phoneNumber)) {
        throw new BadRequestException('Invalid phone number format');
      }
      const parsedPhone = parsePhoneNumber(updateUserDto.phoneNumber);
      updateData.phoneNumber = parsedPhone.format('E.164');
    }

    // If entity is being updated, validate and update path
    if (updateUserDto.entityId) {
      const entity = await this.entityModel.findOne({
        _id: updateUserDto.entityId,
        tenantId,
        isActive: true,
      });

      if (!entity) {
        throw new NotFoundException('Entity not found');
      }

      updateData.entityPath = entity.path;
    }

    // If password is being updated, hash it
    if (updateUserDto.password) {
      updateData.password = await this.authService.hashPassword(updateUserDto.password);
    }

    return this.userModel.findByIdAndUpdate(id, updateData, { new: true });
  }

  async inviteUser(inviteUserDto: InviteUserDto, invitedBy: string): Promise<User> {
    const { phoneNumber, email, firstName, lastName, entityId, tenantId, role } = inviteUserDto;

    // Validate E164 phone number only if provided (required for User, optional for TenantAdmin)
    let e164Phone = null;
    if (phoneNumber) {
      if (!isValidPhoneNumber(phoneNumber)) {
        throw new BadRequestException('Invalid phone number format');
      }
      const parsedPhone = parsePhoneNumber(phoneNumber);
      e164Phone = parsedPhone.format('E.164');
    } else if (role !== UserRole.TENANT_ADMIN) {
      // Phone number is required for regular Users
      throw new BadRequestException('Phone number is required for User role');
    }

    // Check if user already exists
    const existingUserQuery: any[] = [{ email }];
    if (e164Phone) {
      existingUserQuery.push({ phoneNumber: e164Phone });
    }
    
    const existingUser = await this.userModel.findOne({
      $or: existingUserQuery,
    });

    if (existingUser) {
      throw new BadRequestException('User with this phone number or email already exists');
    }

    // Validate entity exists
    const entity = await this.entityModel.findOne({
      _id: new Types.ObjectId(entityId),
      isActive: true,
    });

    if (!entity) {
      throw new NotFoundException('Entity not found');
    }

    // Generate temporary password
    const tempPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = await this.authService.hashPassword("admin123");

    const newUserId:Types.ObjectId = new Types.ObjectId();

    // Build user data - only include phoneNumber if provided
    const userData: any = {
      _id: newUserId,
      email,
      firstName,
      lastName,
      password: hashedPassword,
      entityId,
      entityIdPath: entity.entityIdPath,
      entityPath: entity.path,
      tenantId: entity.tenantId,
      role: role || UserRole.USER,
      registrationStatus: RegistrationStatus.INVITED,
      createdBy: invitedBy,
    };
    
    // Only include phoneNumber if it exists (not null/undefined)
    if (e164Phone) {
      userData.phoneNumber = e164Phone;
    }

    const user = new this.userModel(userData);

    const savedUser = await user.save();

    // Create WhatsApp session and send QR code via email (only for users with phone numbers)
    if (e164Phone) {
      try {
        const sessionId = `whatsapp-${e164Phone.slice(1)}`;
        this.logger.log(`Creating WhatsApp session for user: ${sessionId}`);
        
        await this.whatsappService.createSession(
          sessionId,
          newUserId,
          invitedBy,
          entityId,
          entity.tenantId.toString(),
        );

        // Wait up to 30 seconds for QR code generation
        let qrCodeData = null;
        for (let i = 0; i < 30; i++) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          qrCodeData = await this.whatsappService.getQRCode(sessionId);
          if (qrCodeData) {
            this.logger.log(`QR code generated for session: ${sessionId}`);
            break;
          }
        }

      // Send invitation email with QR code
      // if (qrCodeData) {
      //   await this.emailService.sendInvitationEmailWithQR(email, {
      //     firstName,
      //     lastName,
      //     qrCode: qrCodeData.qrCode,
      //     sessionId,
      //     tempPassword,
      //     expiresAt: qrCodeData.expiresAt,
      //   });
      //   this.logger.log(`Invitation email with QR code sent to ${email}`);
      // } else {
      //   // Send invitation without QR code if generation failed
      //   this.logger.warn(`QR code not generated in time for session: ${sessionId}`);
      //   await this.emailService.sendInvitationEmail(email, 'invitation', {
      //     firstName,
      //     lastName,
      //     tempPassword,
      //     subject: 'Welcome to UNICX',
      //   });
      // }
      } catch (error) {
        this.logger.error(`Failed to create WhatsApp session or send email: ${error.message}`, error);
        // Don't fail user creation if WhatsApp/email fails
      }
    } else {
      // For TenantAdmin without phone number, just send a simple invitation email
      this.logger.log(`Tenant Admin invitation (no WhatsApp): ${email}`);
      // TODO: Send admin invitation email without QR code
    }

    return savedUser;
  }

  async bulkInviteUsers(bulkInviteDto: BulkInviteUserDto, invitedBy: string): Promise<{ success: number; failed: number; errors: any[] }> {
    const { users, tenantId } = bulkInviteDto;
    let success = 0;
    let failed = 0;
    const errors: any[] = [];

    for (const userData of users) {
      try {
        await this.inviteUser({ ...userData, tenantId }, invitedBy);
        success++;
      } catch (error) {
        failed++;
        errors.push({
          user: userData,
          error: error.message,
        });
      }
    }

    return { success, failed, errors };
  }

  async updateRegistrationStatus(
    id: string,
    status: RegistrationStatus,
    updatedBy: string,
    tenantId: string,
  ): Promise<User> {
    const user = await this.findOne(id, tenantId);

    const updateData: any = {
      registrationStatus: status,
      updatedBy,
    };

    if (status === RegistrationStatus.REGISTERED) {
      updateData.registeredAt = new Date();
    }

    return this.userModel.findByIdAndUpdate(id, updateData, { new: true });
  }

  async updateWhatsAppConnectionStatus(
    id: string,
    status: WhatsAppConnectionStatus,
    tenantId: string,
  ): Promise<User> {
    const user = await this.findOne(id, tenantId);

    const updateData: any = {
      whatsappConnectionStatus: status,
    };

    if (status === WhatsAppConnectionStatus.CONNECTED) {
      updateData.whatsappConnectedAt = new Date();
    }

    return this.userModel.findByIdAndUpdate(id, updateData, { new: true });
  }

  async remove(id: string, deletedBy: string, tenantId: string): Promise<void> {
    await this.findOne(id, tenantId);

    // Soft delete
    await this.userModel.findByIdAndUpdate(new Types.ObjectId(id), {
      isActive: false,
      updatedBy: deletedBy,
    });
  }

  async getUserStats(tenantId: string): Promise<any> {
    // Build match query - only include tenantId if provided (SystemAdmin has no tenantId)
    const matchQuery: any = { isActive: true };
    if (tenantId && tenantId !== '') {
      matchQuery.tenantId = new Types.ObjectId(tenantId);
    }

    const stats = await this.userModel.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$registrationStatus',
          count: { $sum: 1 },
        },
      },
    ]);

    const roleStats = await this.userModel.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 },
        },
      },
    ]);

    const whatsappStats = await this.userModel.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$whatsappConnectionStatus',
          count: { $sum: 1 },
        },
      },
    ]);

    const totalUsers = await this.userModel.countDocuments(matchQuery);
    const onlineUsersQuery = { ...matchQuery, isOnline: true };
    const onlineUsers = await this.userModel.countDocuments(onlineUsersQuery);

    return {
      totalUsers,
      onlineUsers,
      byRegistrationStatus: stats,
      byRole: roleStats,
      byWhatsAppStatus: whatsappStats,
    };
  }

  /**
   * Check if a user is a System Administrator
   * @param user - The user object to check
   * @returns true if the user is a System Administrator
   */
  isSystemAdmin(user: User): boolean {
    return isSystemAdmin(user);
  }

  /**
   * Get the System entity ID constant
   * @returns The System entity ObjectId
   */
  getSystemEntityId(): Types.ObjectId {
    return SYSTEM_ENTITY_ID;
  }

  async searchUsers(query: string, tenantId: string): Promise<User[]> {
    const searchQuery: any = {
      isActive: true,
      $or: [
        { firstName: { $regex: query, $options: 'i' } },
        { lastName: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } },
        { phoneNumber: { $regex: query, $options: 'i' } },
      ],
    };
    
    // Only filter by tenantId if provided (SystemAdmin has no tenantId)
    if (tenantId && tenantId !== '') {
      searchQuery.tenantId = new Types.ObjectId(tenantId);
    }
    
    return this.userModel.find(searchQuery).limit(20);
  }
}
