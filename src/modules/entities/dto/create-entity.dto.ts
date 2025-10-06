import { IsString, IsEnum, IsOptional, IsObject, IsMongoId } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum EntityType {
  ENTITY = 'entity',
  COMPANY = 'company',
  DEPARTMENT = 'department',
}

export class CreateEntityDto {
  @ApiProperty({ example: 'Sales Department' })
  @IsString()
  name: string;

  @ApiProperty({ enum: EntityType, example: EntityType.DEPARTMENT })
  @IsEnum(EntityType)
  type: EntityType;

  @ApiProperty({ example: '507f1f77bcf86cd799439011', required: false })
  @IsOptional()
  @IsMongoId()
  parentId?: string;

  @ApiProperty({ example: { description: 'Sales team entity' }, required: false })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class UpdateEntityDto {
  @ApiProperty({ example: 'Updated Sales Department', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  // Note: Type and metadata can only be set during creation
  // Only name can be updated for existing entities
}

export class MoveEntityDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439012', required: false })
  @IsOptional()
  @IsMongoId()
  newParentId?: string;
}
