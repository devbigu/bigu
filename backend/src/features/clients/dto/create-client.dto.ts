import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

const emptyStringToUndefined = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
};

export class CreateClientDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Transform(emptyStringToUndefined)
  industry?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  @Transform(emptyStringToUndefined)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  @Transform(emptyStringToUndefined)
  targetAudience?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  @Transform(emptyStringToUndefined)
  brandVoice?: string;

  @IsOptional()
  @IsUrl(
    { require_protocol: true },
    { message: 'Website URL must include http:// or https://' },
  )
  @MaxLength(2048)
  @Transform(emptyStringToUndefined)
  websiteUrl?: string;

  @IsOptional()
  @IsUrl(
    { require_protocol: true },
    { message: 'Instagram URL must include http:// or https://' },
  )
  @MaxLength(2048)
  @Transform(emptyStringToUndefined)
  instagramUrl?: string;

  @IsOptional()
  @IsUrl(
    { require_protocol: true },
    { message: 'Facebook URL must include http:// or https://' },
  )
  @MaxLength(2048)
  @Transform(emptyStringToUndefined)
  facebookUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  @Transform(emptyStringToUndefined)
  businessObjectives?: string;
}
