import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ResetManagedUserPasswordDto {
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  temporaryPassword!: string;

  @IsOptional()
  @IsBoolean()
  mustChangePassword = true;
}
