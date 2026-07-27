import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString } from 'class-validator';

export const clientListStatuses = ['ACTIVE', 'ARCHIVED', 'ALL'] as const;
export type ClientListStatus = (typeof clientListStatuses)[number];

export class ListClientsQueryDto {
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && value.trim() ? value.trim() : undefined,
  )
  search?: string;

  @IsOptional()
  @IsIn(clientListStatuses)
  status?: ClientListStatus;
}
