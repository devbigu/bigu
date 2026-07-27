import { IsOptional, IsUUID } from 'class-validator';

export class ReassignWorkDto {
  @IsOptional()
  @IsUUID()
  replacementUserId?: string;
}
