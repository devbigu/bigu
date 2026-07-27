import { IsEnum } from 'class-validator';
import { ThemePreference } from '../../../generated/prisma/client';

export class UpdateThemeDto {
  @IsEnum(ThemePreference)
  themePreference!: ThemePreference;
}
