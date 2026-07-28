import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Role } from '../../../generated/prisma/client';

export class ReactivateUserDto {
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  temporaryPassword!: string;
}
