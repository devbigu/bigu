import { IsHexColor, IsOptional, Matches } from 'class-validator';

export class UpdateAppearanceDto {
  @IsOptional()
  @IsHexColor()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  accentColor?: string;

  @IsOptional()
  @IsHexColor()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  themeColor?: string | null;
}
