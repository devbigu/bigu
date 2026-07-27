import {
  IsArray,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  ProjectReferenceType,
  ResearchFindingCategory,
  ResearchObservationCategory,
} from '../../../generated/prisma/client';

export class UpsertResearchBriefDto {
  @IsOptional() @IsString() @MaxLength(4000) businessGoal?: string;
  @IsOptional() @IsString() @MaxLength(4000) researchGoal?: string;
  @IsOptional() @IsString() @MaxLength(4000) targetMarket?: string;
  @IsOptional() @IsString() @MaxLength(4000) geographicFocus?: string;
  @IsOptional() @IsString() @MaxLength(4000) audienceNotes?: string;
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  knownCompetitors?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) platforms?: string[];
  @IsOptional() @IsString() @MaxLength(4000) constraints?: string;
  @IsOptional() @IsString() @MaxLength(8000) additionalContext?: string;
}

export class CompetitorDto {
  @IsString() @MaxLength(200) name!: string;
  @IsOptional() @IsUrl({ require_protocol: true }) websiteUrl?: string;
  @IsOptional() @IsUrl({ require_protocol: true }) instagramUrl?: string;
  @IsOptional() @IsUrl({ require_protocol: true }) facebookUrl?: string;
  @IsOptional() @IsUrl({ require_protocol: true }) youtubeUrl?: string;
  @IsOptional() @IsUrl({ require_protocol: true }) linkedinUrl?: string;
  @IsOptional()
  @IsArray()
  @IsUrl({ require_protocol: true }, { each: true })
  otherUrls?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) platforms?: string[];
  @IsOptional() @IsString() @MaxLength(4000) postingFrequency?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) contentPillars?: string[];
  @IsOptional() @IsString() @MaxLength(4000) toneOfVoice?: string;
  @IsOptional() @IsString() @MaxLength(4000) visualStyle?: string;
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  commonCallsToAction?: string[];
  @IsOptional() @IsString() @MaxLength(4000) engagementObservations?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) strengths?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) weaknesses?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) opportunities?: string[];
  @IsOptional() @IsString() @MaxLength(8000) notes?: string;
}

export class ReferenceDto {
  @IsString() @MaxLength(240) title!: string;
  @IsOptional() @IsUrl({ require_protocol: true }) url?: string;
  @IsOptional() @IsEnum(ProjectReferenceType) type?: ProjectReferenceType;
  @IsOptional() @IsString() @MaxLength(120) platform?: string;
  @IsOptional() @IsString() @MaxLength(4000) description?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
  @IsOptional() @IsString() projectFileId?: string;
}

export class ObservationDto {
  @IsOptional()
  @IsEnum(ResearchObservationCategory)
  category?: ResearchObservationCategory;
  @IsString() @MaxLength(200) title!: string;
  @IsString() @MaxLength(10000) content!: string;
  @IsOptional() @IsString() sourceReferenceId?: string;
  @IsOptional() @IsString() sourceCompetitorId?: string;
}

export class AnalyzeResearchDto {
  @IsOptional()
  @IsArray()
  @IsEnum(ResearchFindingCategory, { each: true })
  categories?: ResearchFindingCategory[];
  @IsOptional() @IsString() @MaxLength(4000) focusInstructions?: string;
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  selectedCompetitorIds?: string[];
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  selectedReferenceIds?: string[];
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  selectedObservationIds?: string[];
}

export class ReviewFindingDto {
  @IsEnum(['APPROVE', 'EDIT_AND_APPROVE', 'REJECT']) action!:
    'APPROVE' | 'EDIT_AND_APPROVE' | 'REJECT';
  @ValidateIf((dto: ReviewFindingDto) => dto.action === 'EDIT_AND_APPROVE')
  @IsOptional()
  @IsEnum(ResearchFindingCategory)
  category?: ResearchFindingCategory;
  @ValidateIf((dto: ReviewFindingDto) => dto.action === 'EDIT_AND_APPROVE')
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;
  @ValidateIf((dto: ReviewFindingDto) => dto.action === 'EDIT_AND_APPROVE')
  @IsOptional()
  @IsObject()
  proposedValue?: Record<string, unknown>;
  @ValidateIf((dto: ReviewFindingDto) => dto.action === 'EDIT_AND_APPROVE')
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  explanation?: string;
  @ValidateIf((dto: ReviewFindingDto) => dto.action === 'EDIT_AND_APPROVE')
  @IsOptional()
  @IsArray()
  evidence?: Array<Record<string, unknown>>;
  @ValidateIf((dto: ReviewFindingDto) => dto.action === 'EDIT_AND_APPROVE')
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence?: number;
  @ValidateIf((dto: ReviewFindingDto) => dto.action === 'REJECT')
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  rejectionReason?: string;
}

export class StrategyDto {
  @IsOptional() @IsString() @MaxLength(4000) businessObjective?: string;
  @IsOptional() @IsArray() audienceSegments?: unknown[];
  @IsOptional() @IsArray() platformPriorities?: unknown[];
  @IsOptional() @IsArray() contentPillars?: unknown[];
  @IsOptional() @IsArray() recommendedFormats?: unknown[];
  @IsOptional() postingFrequency?: unknown;
  @IsOptional() @IsString() @MaxLength(4000) brandVoiceGuidance?: string;
  @IsOptional() @IsString() @MaxLength(4000) engagementStrategy?: string;
  @IsOptional() @IsArray() campaignIdeas?: unknown[];
  @IsOptional() @IsArray() hashtagGroups?: unknown[];
  @IsOptional() @IsArray() keywordGroups?: unknown[];
  @IsOptional() @IsArray() callsToAction?: unknown[];
  @IsOptional() @IsArray() kpis?: unknown[];
  @IsOptional() @IsArray() risks?: unknown[];
  @IsOptional() @IsArray() assumptions?: unknown[];
}
