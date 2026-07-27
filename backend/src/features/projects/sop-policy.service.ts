import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import {
  GovernedProjectType,
  PROJECT_SOP_MAPPING,
  ProjectSopPolicy,
  ProjectSopState,
  SopConfigurationError,
  isGovernedProjectType,
  validateOverrides,
  validateProjectSopPolicy,
  validateStoredStageState,
} from './sop-policy.types';

type TransactionClient = Prisma.TransactionClient;

@Injectable()
export class SopPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  async latestPublished(
    projectType: GovernedProjectType,
    database: TransactionClient | PrismaService = this.prisma,
  ) {
    const expected = PROJECT_SOP_MAPPING[projectType];
    const sop = await database.sopVersion.findFirst({
      where: {
        projectType,
        sopCode: expected.sopCode,
        status: 'PUBLISHED',
      },
      orderBy: [{ version: 'desc' }, { publishedAt: 'desc' }],
    });
    if (!sop) {
      throw new SopConfigurationError(
        `No published ${expected.sopCode} version is configured for ${projectType}.`,
      );
    }
    this.toPolicy(sop, projectType);
    return sop;
  }

  async attachLatest(
    database: TransactionClient,
    projectId: string,
    projectType: GovernedProjectType,
  ) {
    const sop = await this.latestPublished(projectType, database);
    const policy = this.toPolicy(sop, projectType);
    await database.project.update({
      where: { id: projectId },
      data: { sopVersionId: sop.id },
    });
    await database.projectSopState.create({
      data: {
        projectId,
        currentStageId: policy.stages[0]?.id,
        stages: policy.stages.map((stage) => ({
          stageId: stage.id,
          status: 'NOT_STARTED',
        })),
        activeOverrides: [],
      },
    });
    return sop;
  }

  async loadProjectContext(projectId: string): Promise<{
    policy: ProjectSopPolicy;
    state: ProjectSopState;
  }> {
    let project;
    try {
      project = await this.prisma.project.findUnique({
        where: { id: projectId },
        select: {
          id: true,
          projectType: true,
          sopVersion: true,
          sopState: true,
        },
      });
    } catch {
      throw new SopConfigurationError(
        'The project SOP state could not be loaded safely.',
      );
    }
    if (!project) throw new SopConfigurationError('Project was not found.');
    if (!isGovernedProjectType(project.projectType)) {
      throw new SopConfigurationError(
        'The project has no supported governed project type.',
      );
    }
    if (!project.sopVersion || !project.sopState) {
      throw new SopConfigurationError(
        'The project is missing its immutable SOP attachment or execution state.',
      );
    }
    if (project.sopVersion.projectType !== project.projectType) {
      throw new SopConfigurationError(
        'The attached SOP does not match the selected project type.',
      );
    }

    const policy = this.toPolicy(project.sopVersion, project.projectType);
    const storedStages = validateStoredStageState(
      project.sopState.stages,
      policy,
    );
    const activeOverrides = validateOverrides(project.sopState.activeOverrides);
    const checklistIds = new Set(
      policy.qualityChecklist.map((item) => item.id),
    );
    const documentIds = new Set(
      policy.requiredDocuments.map((item) => item.id),
    );
    const completedChecklistItemIds = uniqueKnownIds(
      project.sopState.completedChecklistItemIds,
      checklistIds,
      'checklist',
    );
    const uploadedDocumentRequirementIds = uniqueKnownIds(
      project.sopState.uploadedDocumentRequirementIds,
      documentIds,
      'document',
    );
    const stageIds = new Set(policy.stages.map((stage) => stage.id));
    const approvedInternalStageIds = uniqueKnownIds(
      project.sopState.approvedInternalStageIds,
      stageIds,
      'internal approval',
    );
    const approvedClientStageIds = uniqueKnownIds(
      project.sopState.approvedClientStageIds,
      stageIds,
      'client approval',
    );
    if (
      project.sopState.currentStageId &&
      !stageIds.has(project.sopState.currentStageId)
    ) {
      throw new SopConfigurationError(
        'The current SOP stage is not part of the attached policy.',
      );
    }

    return {
      policy,
      state: {
        currentStageId: project.sopState.currentStageId ?? undefined,
        stages: storedStages,
        completedChecklistItemIds,
        pendingChecklistItemIds: policy.qualityChecklist
          .filter(
            (item) =>
              item.requirementLevel === 'REQUIRED' &&
              !completedChecklistItemIds.includes(item.id),
          )
          .map((item) => item.id),
        uploadedDocumentRequirementIds,
        missingDocumentRequirementIds: policy.requiredDocuments
          .filter(
            (item) =>
              item.requirementLevel === 'REQUIRED' &&
              !uploadedDocumentRequirementIds.includes(item.id),
          )
          .map((item) => item.id),
        approvedInternalStageIds,
        approvedClientStageIds,
        activeOverrides,
      },
    };
  }

  private toPolicy(
    sop: {
      sopCode: string;
      sopName: string;
      version: number;
      purpose: string;
      ownerRole: string;
      appliesTo: string;
      stages: Prisma.JsonValue;
      qualityChecklist: Prisma.JsonValue;
      requiredDocuments: Prisma.JsonValue;
    },
    projectType: GovernedProjectType,
  ) {
    return validateProjectSopPolicy(
      {
        sopCode: sop.sopCode,
        sopName: sop.sopName,
        version: sop.version,
        purpose: sop.purpose,
        ownerRole: sop.ownerRole,
        appliesTo: sop.appliesTo,
        stages: sop.stages,
        qualityChecklist: sop.qualityChecklist,
        requiredDocuments: sop.requiredDocuments,
      },
      projectType,
    );
  }
}

function uniqueKnownIds(values: string[], allowed: Set<string>, label: string) {
  const unique = [...new Set(values)];
  if (unique.some((value) => !allowed.has(value))) {
    throw new SopConfigurationError(
      `Project SOP ${label} state contains an unknown identifier.`,
    );
  }
  return unique;
}
