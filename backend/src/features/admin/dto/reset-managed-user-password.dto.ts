import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class ResetManagedUserPasswordDto {
  @ValidateIf((value: ResetManagedUserPasswordDto) => !value.generatePassword)
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  temporaryPassword?: string;

  @IsOptional()
  @IsBoolean()
  generatePassword?: boolean;

  @IsOptional()
  @IsBoolean()
  mustChangePassword = true;
}
