import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, RegistrationStatus, UserRole, WhatsAppConnectionStatus } from '../../common/schemas/user.schema';
import { Entity } from '../../common/schemas/entity.schema';
import { AuthService } from '../auth/auth.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { InviteUserDto } from './dto/invite-user.dto';
import { BulkInviteUserDto } from './dto/bulk-invite-user.dto';
import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';
const bcrypt = require('bcryptjs');

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name)
    private userModel: Model<User>,
    @InjectModel(Entity.name)
    private entityModel: Model<Entity>,
    private authService: AuthService,
  ) {}

  async create(createUserDto: CreateUserDto, createdBy: string): Promise<User> {
    const { phoneNumber, email, firstName, lastName, entityId, tenantId, role } = createUserDto;

    // Validate E164 phone number
    if (!isValidPhoneNumber(phoneNumber)) {
      throw new BadRequestException('Invalid phone number format');
    }

    const parsedPhone = parsePhoneNumber(phoneNumber);
    const e164Phone = parsedPhone.format('E.164');

    // Check if user already exists
    const existingUser = await this.userModel.findOne({
      $or: [{ phoneNumber: e164Phone }, { email }],
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

    const user = new this.userModel({
      phoneNumber: e164Phone,
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
    });

    return user.save();
  }

  async findAll(tenantId: string, filters?: any): Promise<{ users: User[], total: number, page: number, limit: number, totalPages: number }> {
    const query: any = { isActive: true };

    if (filters?.registrationStatus) {
      query.registrationStatus = filters.registrationStatus;
    }

    if (filters?.role) {
      query.role = filters.role;
    }

    if (filters?.entityId) {
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

    return {
      users,
      total,
      page,
      limit,
      totalPages,
    };
  }

  async findOne(id: string, tenantId: string): Promise<User> {
    const user = await this.userModel.findOne({
      _id: id,
      tenantId,
      isActive: true,
    }).populate('entityId', 'name path type');

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async findByPhoneNumber(phoneNumber: string, tenantId: string): Promise<User> {
    const user = await this.userModel.findOne({
      phoneNumber,
      tenantId,
      isActive: true,
    });

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

    // Validate E164 phone number
    if (!isValidPhoneNumber(phoneNumber)) {
      throw new BadRequestException('Invalid phone number format');
    }

    const parsedPhone = parsePhoneNumber(phoneNumber);
    const e164Phone = parsedPhone.format('E.164');

    // Check if user already exists
    const existingUser = await this.userModel.findOne({
      $or: [{ phoneNumber: e164Phone }, { email }],
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
    const hashedPassword = await this.authService.hashPassword(tempPassword);

    const user = new this.userModel({
      _id: new Types.ObjectId(),
      phoneNumber: e164Phone,
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
    });

    return user.save();
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
    const user = await this.findOne(id, tenantId);

    // Soft delete
    await this.userModel.findByIdAndUpdate(id, {
      isActive: false,
      updatedBy: deletedBy,
    });
  }

  async getUserStats(tenantId: string): Promise<any> {
    const stats = await this.userModel.aggregate([
      { $match: { tenantId, isActive: true } },
      {
        $group: {
          _id: '$registrationStatus',
          count: { $sum: 1 },
        },
      },
    ]);

    const roleStats = await this.userModel.aggregate([
      { $match: { tenantId, isActive: true } },
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 },
        },
      },
    ]);

    const whatsappStats = await this.userModel.aggregate([
      { $match: { tenantId, isActive: true } },
      {
        $group: {
          _id: '$whatsappConnectionStatus',
          count: { $sum: 1 },
        },
      },
    ]);

    const totalUsers = await this.userModel.countDocuments({ tenantId, isActive: true });
    const onlineUsers = await this.userModel.countDocuments({
      tenantId,
      isActive: true,
      isOnline: true,
    });

    return {
      totalUsers,
      onlineUsers,
      byRegistrationStatus: stats,
      byRole: roleStats,
      byWhatsAppStatus: whatsappStats,
    };
  }

  async searchUsers(query: string, tenantId: string): Promise<User[]> {
    return this.userModel.find({
      tenantId,
      isActive: true,
      $or: [
        { firstName: { $regex: query, $options: 'i' } },
        { lastName: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } },
        { phoneNumber: { $regex: query, $options: 'i' } },
      ],
    }).limit(20);
  }
}
