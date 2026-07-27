import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Role } from '../../../generated/prisma/client';

export class ReactivateUserDto {
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ValidateIf((value: ReactivateUserDto) => !value.generatePassword)
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  temporaryPassword?: string;

  @IsOptional()
  @IsBoolean()
  generatePassword?: boolean;
}
