import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class DeactivateUserDto {
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reason!: string;

  @IsOptional()
  @IsUUID()
  replacementUserId?: string;

  @IsOptional()
  @IsBoolean()
  reassignActiveWork?: boolean;
}
