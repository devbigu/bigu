import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Role, UserStatus } from '../../../generated/prisma/client';

export class CreateManagedUserDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ValidateIf((value: CreateManagedUserDto) => !value.generatePassword)
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  initialPassword?: string;

  @IsOptional()
  @IsBoolean()
  generatePassword?: boolean;

  @IsEnum(Role)
  role: Role = Role.STAFF;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  designation!: string;

  @IsOptional()
  @IsBoolean()
  mustChangePassword = true;

  @IsOptional()
  @IsEnum(UserStatus)
  status: UserStatus = UserStatus.ACTIVE;
}
