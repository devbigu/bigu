import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
export class CreateInstructionDto {
  @IsString() @IsNotEmpty() @MaxLength(160) title!: string;
  @IsString() @IsNotEmpty() @MaxLength(10000) content!: string;
}
