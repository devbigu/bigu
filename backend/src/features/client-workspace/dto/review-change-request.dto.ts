import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
export class ReviewChangeRequestDto {
  @IsIn(['APPROVE', 'REJECT', 'EDIT_AND_APPROVE']) action!:
    'APPROVE' | 'REJECT' | 'EDIT_AND_APPROVE';
  @ValidateIf((x: ReviewChangeRequestDto) => x.action === 'EDIT_AND_APPROVE')
  @IsString()
  @MaxLength(10000)
  @IsOptional()
  proposedValue?: string;

  @IsBoolean()
  @IsOptional()
  syncSpreadsheet?: boolean;
}
