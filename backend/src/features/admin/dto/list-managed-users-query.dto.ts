import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { Role, UserStatus } from '../../../generated/prisma/client';

export class ListManagedUsersQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  designation?: string;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}
