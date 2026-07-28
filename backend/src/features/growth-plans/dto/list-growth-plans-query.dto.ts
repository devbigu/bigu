import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { ProjectStatus } from '../../../generated/prisma/client';

export const portfolioStrategyStatuses = [
  'NOT_STARTED',
  'DRAFT',
  'APPROVED',
] as const;

export type PortfolioStrategyStatus =
  (typeof portfolioStrategyStatuses)[number];

export class ListGrowthPlansQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  clientId?: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsIn(portfolioStrategyStatuses)
  strategyStatus?: PortfolioStrategyStatus;

  @IsOptional()
  @IsIn([...Object.values(ProjectStatus), 'ALL'])
  projectStatus?: ProjectStatus | 'ALL';

  @IsOptional()
  @IsString()
  projectType?: string;

  @IsOptional()
  @IsString()
  assignedUserId?: string;

  @IsOptional()
  @IsString()
  platform?: string;

  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  month?: number;

  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(2000)
  year?: number;

  @IsOptional()
  @IsIn(['NOT_STARTED', 'IN_PROGRESS', 'PENDING_REVIEW', 'APPROVED'])
  researchStatus?: 'NOT_STARTED' | 'IN_PROGRESS' | 'PENDING_REVIEW' | 'APPROVED';
}
