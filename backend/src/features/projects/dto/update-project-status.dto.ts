import { IsEnum } from 'class-validator';
import { ProjectStatus } from '../../../generated/prisma/client';

export class UpdateProjectStatusDto {
  @IsEnum(ProjectStatus)
  status: ProjectStatus;
}
