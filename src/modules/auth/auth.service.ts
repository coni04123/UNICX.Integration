import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserRole } from '../../common/schemas/user.schema';
import { Entity } from '../../common/schemas/entity.schema';
import { RegisterDto } from './dto/register.dto';
import * as bcrypt from 'bcryptjs';

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  entityId: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    entityId: string;
    entityPath: string;
  };
}

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name)
    private userModel: Model<User>,
    @InjectModel(Entity.name)
    private entityModel: Model<Entity>,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.userModel.findOne({ 
      email, 
      isActive: true,
      registrationStatus: 'registered'
    }).select('+password');

    if (user && await bcrypt.compare(password, user.password)) {
      const { password: _, ...result } = user.toObject();
      return result;
    }
    return null;
  }

  async login(user: any): Promise<LoginResponse> {
    const payload: JwtPayload = {
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
      entityId: user.entityId.toString(),
    };

    const access_token = this.jwtService.sign(payload);
    const refresh_token = this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    });

    return {
      access_token,
      refresh_token,
      user: {
        id: user._id.toString(),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        entityId: user.entityId.toString(),
        entityPath: user.entityPath,
      },
    };
  }

  async refreshToken(refreshToken: string): Promise<{ access_token: string }> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });

      const user = await this.userModel.findById(payload.sub);
      if (!user || !user.isActive) {
        throw new UnauthorizedException('User not found or inactive');
      }

      const newPayload: JwtPayload = {
        sub: user._id.toString(),
        email: user.email,
        role: user.role,
        entityId: user.entityId.toString(),
      };

      return {
        access_token: this.jwtService.sign(newPayload),
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async validateToken(token: string): Promise<JwtPayload> {
    try {
      return this.jwtService.verify(token);
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  async hashPassword(password: string): Promise<string> {
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
    return bcrypt.hash(password, saltRounds);
  }

  async comparePassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  async register(registerDto: RegisterDto): Promise<LoginResponse> {
    // Check if user already exists
    const existingUser = await this.userModel.findOne({
      $or: [{ email: registerDto.email }, { phoneNumber: registerDto.phoneNumber }],
    });

    if (existingUser) {
      throw new ConflictException('User with this email or phone number already exists');
    }

    // If entityId and tenantId not provided, find or create a default entity
    let entityId = registerDto.entityId;
    let tenantId = registerDto.tenantId;
    let entityPath = '';

    if (!entityId || !tenantId) {
      // Find the first available entity or create a default one
      const defaultEntity = await this.entityModel.findOne({ type: 'E164' });
      
      if (!defaultEntity) {
        throw new BadRequestException('No default entity available. Please contact administrator.');
      }

      entityId = defaultEntity._id.toString();
      entityPath = defaultEntity.path;
    } else {
      // Get entity path
      const entity = await this.entityModel.findById(entityId);
      if (!entity) {
        throw new BadRequestException('Invalid entity ID');
      }
      entityPath = entity.path;
    }

    // Hash password
    const hashedPassword = await this.hashPassword(registerDto.password);

    // Create new user
    const newUser = new this.userModel({
      phoneNumber: registerDto.phoneNumber,
      email: registerDto.email,
      firstName: registerDto.firstName,
      lastName: registerDto.lastName,
      password: hashedPassword,
      entityId: new Types.ObjectId(entityId),
      entityPath,
      role: UserRole.USER,
      registrationStatus: 'registered',
      isActive: true,
    });

    const savedUser = await newUser.save();

    // Return login response with tokens
    const userObj = savedUser.toObject();
    const { password: _, ...userWithoutPassword } = userObj;
    
    return this.login(userWithoutPassword);
  }
}
