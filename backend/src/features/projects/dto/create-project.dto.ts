import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ProjectStatus } from '../../../generated/prisma/client';
import { GOVERNED_PROJECT_TYPES } from '../sop-policy.types';
import type { GovernedProjectType } from '../sop-policy.types';

const optionalText = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed || undefined;
};

export class CreateProjectDto {
  @IsUUID()
  clientId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  title: string;

  @IsString()
  @IsIn(GOVERNED_PROJECT_TYPES)
  projectType: GovernedProjectType;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  @Transform(optionalText)
  growthObjective?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  platforms?: string[];

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2200)
  year?: number;

  @IsOptional()
  @IsUUID()
  assignedUserId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  contentTarget?: number;

  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;
}
