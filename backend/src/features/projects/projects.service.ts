import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  Prisma,
  ProjectStatus,
  UserStatus,
} from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { SpreadsheetsService } from '../spreadsheets/spreadsheets.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { ListProjectsQueryDto } from './dto/list-projects-query.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { SopPolicyService } from './sop-policy.service';
import { SopConfigurationError } from './sop-policy.types';

const projectInclude = {
  client: true,
  assignedUser: {
    select: { id: true, name: true, username: true, email: true },
  },
  spreadsheetWorksheet: {
    select: { id: true, status: true, externalWorksheetId: true },
  },
} satisfies Prisma.ProjectInclude;

const statusTransitions: Record<ProjectStatus, ProjectStatus[]> = {
  [ProjectStatus.DRAFT]: [ProjectStatus.ACTIVE, ProjectStatus.ARCHIVED],
  [ProjectStatus.ACTIVE]: [ProjectStatus.COMPLETED, ProjectStatus.ARCHIVED],
  [ProjectStatus.COMPLETED]: [ProjectStatus.ACTIVE, ProjectStatus.ARCHIVED],
  [ProjectStatus.ARCHIVED]: [ProjectStatus.ACTIVE],
};

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly spreadsheets: SpreadsheetsService,
    private readonly sopPolicies: SopPolicyService,
  ) {}

  async create(dto: CreateProjectDto, currentUserId: string) {
    const client = await this.prisma.client.findUnique({
      where: { id: dto.clientId },
      select: { id: true, status: true },
    });
    if (!client) throw new NotFoundException('Client not found.');
    if (client.status === 'ARCHIVED') {
      throw new ConflictException(
        'Projects cannot be created for an archived client.',
      );
    }

    const assignedUserId = dto.assignedUserId ?? currentUserId;
    const assignee = await this.prisma.user.findUnique({
      where: { id: assignedUserId },
      select: { id: true, status: true },
    });
    if (assignee?.status !== UserStatus.ACTIVE) {
      throw new NotFoundException(
        'Assigned user was not found or is inactive.',
      );
    }

    const { startDate, endDate, ...data } = dto;
    if (startDate && endDate && Date.parse(endDate) < Date.parse(startDate)) {
      throw new ConflictException('End date cannot be before start date.');
    }

    let project;
    try {
      project = await this.prisma.$transaction(async (transaction) => {
        const created = await transaction.project.create({
          data: {
            ...data,
            assignedUserId,
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
          },
        });
        await this.sopPolicies.attachLatest(
          transaction,
          created.id,
          dto.projectType,
        );
        return transaction.project.findUniqueOrThrow({
          where: { id: created.id },
          include: projectInclude,
        });
      });
    } catch (error) {
      if (error instanceof SopConfigurationError) {
        throw new ServiceUnavailableException(error.message);
      }
      throw error;
    }
    await this.spreadsheets.queueProjectProvision(project.id, currentUserId);
    return project;
  }

  async update(id: string, dto: UpdateProjectDto) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        startDate: true,
        endDate: true,
        clientId: true,
        sopVersionId: true,
        conversation: { select: { id: true } },
        files: { select: { id: true } },
        sopState: { select: { id: true } },
        spreadsheetWorksheet: { select: { id: true } },
      },
    });
    if (!project) throw new NotFoundException('Project not found.');
    if (project.status === ProjectStatus.ARCHIVED) {
      throw new ConflictException('Archived projects cannot be edited.');
    }

    if (dto.assignedUserId !== undefined) {
      const assignee = await this.prisma.user.findUnique({
        where: { id: dto.assignedUserId },
        select: { id: true, status: true },
      });
      if (assignee?.status !== UserStatus.ACTIVE) {
        throw new NotFoundException(
          'Assigned user was not found or is inactive.',
        );
      }
    }

    const startDate = dto.startDate
      ? new Date(dto.startDate)
      : project.startDate;
    const endDate = dto.endDate ? new Date(dto.endDate) : project.endDate;
    if (startDate && endDate && endDate.getTime() < startDate.getTime()) {
      throw new ConflictException('End date cannot be before start date.');
    }

    const data: Prisma.ProjectUncheckedUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.growthObjective !== undefined)
      data.growthObjective = dto.growthObjective;
    if (dto.platforms !== undefined) data.platforms = dto.platforms;
    if (dto.startDate !== undefined) data.startDate = new Date(dto.startDate);
    if (dto.endDate !== undefined) data.endDate = new Date(dto.endDate);
    if (dto.month !== undefined) data.month = dto.month;
    if (dto.year !== undefined) data.year = dto.year;
    if (dto.assignedUserId !== undefined)
      data.assignedUserId = dto.assignedUserId;
    if (dto.contentTarget !== undefined) data.contentTarget = dto.contentTarget;

    return this.prisma.project.update({
      where: { id },
      data,
      include: projectInclude,
    });
  }

  findAll(query: ListProjectsQueryDto) {
    const where: Prisma.ProjectWhereInput = {};
    if (query.clientId) where.clientId = query.clientId;
    if (query.assignedUserId) where.assignedUserId = query.assignedUserId;
    if (query.projectType) where.projectType = query.projectType;
    if (query.month !== undefined) where.month = query.month;
    if (query.year !== undefined) where.year = query.year;
    if (query.status !== 'ALL') {
      where.status = query.status ?? { not: ProjectStatus.ARCHIVED };
    }
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { projectType: { contains: query.search, mode: 'insensitive' } },
        { growthObjective: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    return this.prisma.project.findMany({
      where,
      include: projectInclude,
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: projectInclude,
    });
    if (!project) throw new NotFoundException('Project not found.');
    return project;
  }

  async updateStatus(id: string, nextStatus: ProjectStatus) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!project) throw new NotFoundException('Project not found.');
    this.assertStatusTransition(project.status, nextStatus);
    return this.prisma.project.update({
      where: { id },
      data: { status: nextStatus },
      include: projectInclude,
    });
  }

  archive(id: string) {
    return this.updateStatus(id, ProjectStatus.ARCHIVED);
  }

  async restore(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        conversation: { select: { id: true } },
        sopState: { select: { id: true } },
        spreadsheetWorksheet: { select: { id: true } },
        spreadsheetSyncJobs: { select: { id: true }, take: 1 },
      },
    });
    if (!project) throw new NotFoundException('Project not found.');
    this.assertStatusTransition(project.status, ProjectStatus.ACTIVE);
    return this.prisma.project.update({
      where: { id },
      data: { status: ProjectStatus.ACTIVE },
      include: projectInclude,
    });
  }

  private assertStatusTransition(
    currentStatus: ProjectStatus,
    nextStatus: ProjectStatus,
  ) {
    if (currentStatus === nextStatus) return;
    if (!statusTransitions[currentStatus].includes(nextStatus)) {
      throw new ConflictException(
        `Project status cannot move from ${currentStatus} to ${nextStatus}.`,
      );
    }
  }
}
