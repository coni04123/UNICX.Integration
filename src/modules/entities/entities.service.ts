import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Entity, EntityType } from '../../common/schemas/entity.schema';
import { User } from '../../common/schemas/user.schema';
import { CreateEntityDto } from './dto/create-entity.dto';
import { UpdateEntityDto } from './dto/update-entity.dto';
import { MoveEntityDto } from './dto/move-entity.dto';

@Injectable()
export class EntitiesService {
  constructor(
    @InjectModel(Entity.name)
    private entityModel: Model<Entity>,
    @InjectModel(User.name)
    private userModel: Model<User>,
  ) {}

  async create(createEntityDto: CreateEntityDto, userId: string): Promise<Entity> {
    const { name, type, parentId, tenantId, metadata } = createEntityDto;

    // Validate parent exists if provided
    if (parentId) {
      const parent = await this.entityModel.findOne({
        _id: parentId,
        tenantId,
        isActive: true,
      });

      if (!parent) {
        throw new NotFoundException('Parent entity not found');
      }

      // Prevent circular references
      if (await this.wouldCreateCircularReference(parentId, tenantId)) {
        throw new BadRequestException('Cannot create circular reference');
      }
    }

    // Generate path
    const path = await this.generatePath(name, parentId, tenantId);

    // Calculate level
    const level = parentId ? await this.calculateLevel(parentId, tenantId) + 1 : 0;

    const entity = new this.entityModel({
      name,
      type,
      parentId: parentId || null,
      path,
      tenantId,
      level,
      metadata: metadata || {},
      createdBy: userId,
    });

    return entity.save();
  }

  async findAll(tenantId: string, filters?: any): Promise<Entity[]> {
    const query: any = { tenantId, isActive: true };

    if (filters?.type) {
      query.type = filters.type;
    }

    if (filters?.parentId) {
      query.parentId = filters.parentId;
    }

    if (filters?.level !== undefined) {
      query.level = filters.level;
    }

    if (filters?.search) {
      query.name = { $regex: filters.search, $options: 'i' };
    }

    return this.entityModel.find(query).sort({ path: 1 });
  }

  async findOne(id: string, tenantId: string): Promise<Entity> {
    const entity = await this.entityModel.findOne({
      _id: id,
      tenantId,
      isActive: true,
    });

    if (!entity) {
      throw new NotFoundException('Entity not found');
    }

    return entity;
  }

  async findHierarchy(tenantId: string, maxDepth?: number): Promise<Entity[]> {
    const query: any = { tenantId, isActive: true };

    if (maxDepth !== undefined) {
      query.level = { $lte: maxDepth };
    }

    return this.entityModel.find(query).sort({ path: 1 });
  }

  async update(id: string, updateEntityDto: UpdateEntityDto, userId: string, tenantId: string): Promise<Entity> {
    const entity = await this.findOne(id, tenantId);

    const updateData: any = {
      ...updateEntityDto,
      updatedBy: userId,
    };

    // If name is being updated, regenerate path
    if (updateEntityDto.name && updateEntityDto.name !== entity.name) {
      updateData.path = await this.generatePath(updateEntityDto.name, entity.parentId?.toString(), tenantId);
    }

    return this.entityModel.findByIdAndUpdate(id, updateData, { new: true });
  }

  async move(id: string, moveEntityDto: MoveEntityDto, userId: string, tenantId: string): Promise<Entity> {
    const entity = await this.findOne(id, tenantId);
    const { newParentId } = moveEntityDto;

    // Validate new parent exists if provided
    if (newParentId) {
      const newParent = await this.entityModel.findOne({
        _id: newParentId,
        tenantId,
        isActive: true,
      });

      if (!newParent) {
        throw new NotFoundException('New parent entity not found');
      }

      // Prevent circular references
      if (await this.wouldCreateCircularReference(newParentId, tenantId, id)) {
        throw new BadRequestException('Cannot create circular reference');
      }
    }

    // Update entity
    const newPath = await this.generatePath(entity.name, newParentId, tenantId);
    const newLevel = newParentId ? await this.calculateLevel(newParentId, tenantId) + 1 : 0;

    await this.entityModel.findByIdAndUpdate(id, {
      parentId: newParentId || null,
      path: newPath,
      level: newLevel,
      updatedBy: userId,
    });

    // Update all descendants' paths and levels
    await this.updateDescendantsPaths(id, tenantId);

    return this.findOne(id, tenantId);
  }

  async remove(id: string, userId: string, tenantId: string): Promise<void> {
    const entity = await this.findOne(id, tenantId);

    // Check if entity has children
    const childrenCount = await this.entityModel.countDocuments({
      parentId: id,
      tenantId,
      isActive: true,
    });

    if (childrenCount > 0) {
      throw new BadRequestException('Cannot delete entity with children');
    }

    // Check if entity has users
    const usersCount = await this.userModel.countDocuments({
      entityId: id,
      tenantId,
      isActive: true,
    });

    if (usersCount > 0) {
      throw new BadRequestException('Cannot delete entity with active users');
    }

    // Soft delete
    await this.entityModel.findByIdAndUpdate(id, {
      isActive: false,
      updatedBy: userId,
    });
  }

  async getEntityStats(tenantId: string): Promise<any> {
    const stats = await this.entityModel.aggregate([
      { $match: { tenantId, isActive: true } },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          avgLevel: { $avg: '$level' },
        },
      },
    ]);

    const totalEntities = await this.entityModel.countDocuments({ tenantId, isActive: true });
    const totalUsers = await this.userModel.countDocuments({ tenantId, isActive: true });

    return {
      totalEntities,
      totalUsers,
      byType: stats,
    };
  }

  private async generatePath(name: string, parentId: string | null, tenantId: string): Promise<string> {
    if (!parentId) {
      return name;
    }

    const parent = await this.entityModel.findOne({
      _id: parentId,
      tenantId,
      isActive: true,
    });

    if (!parent) {
      throw new NotFoundException('Parent entity not found');
    }

    return `${parent.path} > ${name}`;
  }

  private async calculateLevel(parentId: string, tenantId: string): Promise<number> {
    const parent = await this.entityModel.findOne({
      _id: parentId,
      tenantId,
      isActive: true,
    });

    return parent ? parent.level : 0;
  }

  private async wouldCreateCircularReference(parentId: string, tenantId: string, excludeId?: string): Promise<boolean> {
    const query: any = { _id: parentId, tenantId, isActive: true };
    if (excludeId) {
      query._id = { $ne: excludeId };
    }

    const parent = await this.entityModel.findOne(query);
    if (!parent) {
      return false;
    }

    // Check if the parent is a descendant of the entity being moved
    if (excludeId) {
      const descendants = await this.getAllDescendants(excludeId, tenantId);
      return descendants.some(desc => desc._id.toString() === parentId);
    }

    return false;
  }

  private async getAllDescendants(entityId: string, tenantId: string): Promise<Entity[]> {
    const descendants: Entity[] = [];
    const children = await this.entityModel.find({
      parentId: entityId,
      tenantId,
      isActive: true,
    });

    for (const child of children) {
      descendants.push(child);
      const childDescendants = await this.getAllDescendants(child._id.toString(), tenantId);
      descendants.push(...childDescendants);
    }

    return descendants;
  }

  private async updateDescendantsPaths(entityId: string, tenantId: string): Promise<void> {
    const descendants = await this.getAllDescendants(entityId, tenantId);
    const entity = await this.entityModel.findById(entityId);

    for (const descendant of descendants) {
      const newPath = await this.generatePath(descendant.name, descendant.parentId?.toString(), tenantId);
      const newLevel = await this.calculateLevel(descendant.parentId?.toString(), tenantId) + 1;

      await this.entityModel.findByIdAndUpdate(descendant._id, {
        path: newPath,
        level: newLevel,
      });
    }
  }
}
