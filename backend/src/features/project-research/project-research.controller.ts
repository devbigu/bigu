import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import {
  AnalyzeResearchDto,
  CompetitorDto,
  ObservationDto,
  ReferenceDto,
  ReviewFindingDto,
  StrategyDto,
  UpsertResearchBriefDto,
} from './dto/project-research.dto';
import { ProjectResearchService } from './project-research.service';

@Controller('projects/:projectId/research')
@UseGuards(JwtAuthGuard)
export class ProjectResearchController {
  constructor(private readonly research: ProjectResearchService) {}

  @Get()
  workspace(@Param('projectId') projectId: string) {
    return this.research.workspace(projectId);
  }

  @Put('brief')
  brief(
    @Param('projectId') projectId: string,
    @Body() dto: UpsertResearchBriefDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.research.upsertBrief(projectId, dto, user.id);
  }

  @Post('competitors')
  createCompetitor(
    @Param('projectId') projectId: string,
    @Body() dto: CompetitorDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.research.createCompetitor(projectId, dto, user.id);
  }

  @Patch('competitors/:competitorId')
  updateCompetitor(
    @Param('projectId') projectId: string,
    @Param('competitorId') competitorId: string,
    @Body() dto: Partial<CompetitorDto>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.research.updateCompetitor(
      projectId,
      competitorId,
      dto,
      user.id,
    );
  }

  @Delete('competitors/:competitorId')
  deleteCompetitor(
    @Param('projectId') projectId: string,
    @Param('competitorId') competitorId: string,
  ) {
    return this.research.deleteCompetitor(projectId, competitorId);
  }

  @Post('references')
  createReference(
    @Param('projectId') projectId: string,
    @Body() dto: ReferenceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.research.createReference(projectId, dto, user.id);
  }

  @Patch('references/:referenceId')
  updateReference(
    @Param('projectId') projectId: string,
    @Param('referenceId') referenceId: string,
    @Body() dto: Partial<ReferenceDto>,
  ) {
    return this.research.updateReference(projectId, referenceId, dto);
  }

  @Delete('references/:referenceId')
  deleteReference(
    @Param('projectId') projectId: string,
    @Param('referenceId') referenceId: string,
  ) {
    return this.research.deleteReference(projectId, referenceId);
  }

  @Post('observations')
  createObservation(
    @Param('projectId') projectId: string,
    @Body() dto: ObservationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.research.createObservation(projectId, dto, user.id);
  }

  @Patch('observations/:observationId')
  updateObservation(
    @Param('projectId') projectId: string,
    @Param('observationId') observationId: string,
    @Body() dto: Partial<ObservationDto>,
  ) {
    return this.research.updateObservation(projectId, observationId, dto);
  }

  @Delete('observations/:observationId')
  deleteObservation(
    @Param('projectId') projectId: string,
    @Param('observationId') observationId: string,
  ) {
    return this.research.deleteObservation(projectId, observationId);
  }

  @Post('analyze')
  analyze(
    @Param('projectId') projectId: string,
    @Body() dto: AnalyzeResearchDto,
  ) {
    return this.research.analyze(projectId, dto);
  }

  @Patch('findings/:findingId')
  reviewFinding(
    @Param('projectId') projectId: string,
    @Param('findingId') findingId: string,
    @Body() dto: ReviewFindingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.research.reviewFinding(projectId, findingId, dto, user.id);
  }

  @Post('strategy/generate')
  generateStrategy(
    @Param('projectId') projectId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.research.generateStrategy(projectId, user.id);
  }

  @Patch('strategy')
  saveStrategy(
    @Param('projectId') projectId: string,
    @Body() dto: StrategyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.research.saveStrategy(projectId, dto, user.id);
  }

  @Post('strategy/approve')
  approveStrategy(
    @Param('projectId') projectId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.research.approveStrategy(projectId, user.id);
  }
}
