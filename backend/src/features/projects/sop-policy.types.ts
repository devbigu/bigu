export const PROJECT_SOP_MAPPING = {
  SOCIAL_MEDIA_MANAGEMENT: {
    sopCode: 'SOP-03',
    sopName: 'Social Media Management',
  },
  SEO_MANAGEMENT: {
    sopCode: 'SOP-04',
    sopName: 'Search Engine Optimization',
  },
  WEBSITE_DEVELOPMENT: {
    sopCode: 'SOP-05',
    sopName: 'Website Development',
  },
  SOFTWARE_DEVELOPMENT: {
    sopCode: 'SOP-06',
    sopName: 'Software Development',
  },
} as const;

export type GovernedProjectType = keyof typeof PROJECT_SOP_MAPPING;
export const GOVERNED_PROJECT_TYPES = Object.keys(
  PROJECT_SOP_MAPPING,
) as GovernedProjectType[];

export type RequirementLevel = 'REQUIRED' | 'RECOMMENDED' | 'OPTIONAL';
export type SopStageStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'BLOCKED'
  | 'READY_FOR_REVIEW'
  | 'COMPLETED'
  | 'SKIPPED_WITH_OVERRIDE';

export type ProjectSopPolicy = {
  sopCode: string;
  sopName: string;
  version: number;
  purpose: string;
  ownerRole: string;
  appliesTo: string;
  stages: Array<{
    id: string;
    sequence: number;
    title: string;
    instructions: string[];
    required: boolean;
    requiresEvidence: boolean;
    requiresInternalApproval: boolean;
    requiresClientApproval: boolean;
  }>;
  qualityChecklist: Array<{
    id: string;
    title: string;
    requirementLevel: RequirementLevel;
  }>;
  requiredDocuments: Array<{
    id: string;
    name: string;
    requirementLevel: RequirementLevel;
  }>;
};

export type ProjectSopState = {
  currentStageId?: string;
  stages: Array<{ stageId: string; status: SopStageStatus }>;
  completedChecklistItemIds: string[];
  pendingChecklistItemIds: string[];
  uploadedDocumentRequirementIds: string[];
  missingDocumentRequirementIds: string[];
  approvedInternalStageIds: string[];
  approvedClientStageIds: string[];
  activeOverrides: Array<{
    targetId: string;
    reason: string;
    approvedBy: string;
    approvedAt: string;
  }>;
};

export class SopConfigurationError extends Error {
  readonly code = 'sop_configuration_error';

  constructor(message: string) {
    super(message);
    this.name = 'SopConfigurationError';
  }
}

const requirementLevels = new Set<RequirementLevel>([
  'REQUIRED',
  'RECOMMENDED',
  'OPTIONAL',
]);
const stageStatuses = new Set<SopStageStatus>([
  'NOT_STARTED',
  'IN_PROGRESS',
  'BLOCKED',
  'READY_FOR_REVIEW',
  'COMPLETED',
  'SKIPPED_WITH_OVERRIDE',
]);

export function isGovernedProjectType(
  value: unknown,
): value is GovernedProjectType {
  return (
    typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(PROJECT_SOP_MAPPING, value)
  );
}

export function validateProjectSopPolicy(
  value: unknown,
  projectType: GovernedProjectType,
): ProjectSopPolicy {
  if (!isRecord(value)) invalid('SOP policy must be an object.');
  const expected = PROJECT_SOP_MAPPING[projectType];
  if (
    value.sopCode !== expected.sopCode ||
    value.sopName !== expected.sopName ||
    !Number.isInteger(value.version) ||
    Number(value.version) < 1 ||
    !isNonEmptyString(value.purpose) ||
    !isNonEmptyString(value.ownerRole) ||
    !isNonEmptyString(value.appliesTo)
  ) {
    invalid('SOP identity or required metadata is invalid.');
  }
  if (!Array.isArray(value.stages) || value.stages.length === 0) {
    invalid('SOP must contain at least one mandatory stage.');
  }
  const stageIds = new Set<string>();
  const stages = value.stages.map((stage, index) => {
    const sequence = isRecord(stage) ? stage.sequence : undefined;
    if (
      !isRecord(stage) ||
      !isNonEmptyString(stage.id) ||
      typeof sequence !== 'number' ||
      !Number.isInteger(sequence) ||
      !isNonEmptyString(stage.title) ||
      !Array.isArray(stage.instructions) ||
      stage.instructions.length === 0 ||
      !stage.instructions.every(isNonEmptyString) ||
      typeof stage.required !== 'boolean' ||
      typeof stage.requiresEvidence !== 'boolean' ||
      typeof stage.requiresInternalApproval !== 'boolean' ||
      typeof stage.requiresClientApproval !== 'boolean'
    ) {
      invalid(`SOP stage ${index + 1} is invalid.`);
    }
    if (stageIds.has(stage.id)) invalid(`Duplicate SOP stage ${stage.id}.`);
    stageIds.add(stage.id);
    return {
      id: stage.id,
      sequence,
      title: stage.title,
      instructions: [...stage.instructions],
      required: stage.required,
      requiresEvidence: stage.requiresEvidence,
      requiresInternalApproval: stage.requiresInternalApproval,
      requiresClientApproval: stage.requiresClientApproval,
    };
  });
  const qualityChecklist = validateRequirements(
    value.qualityChecklist,
    'title',
    'quality checklist',
  ) as ProjectSopPolicy['qualityChecklist'];
  const requiredDocuments = validateRequirements(
    value.requiredDocuments,
    'name',
    'required documents',
  ) as ProjectSopPolicy['requiredDocuments'];
  return {
    sopCode: expected.sopCode,
    sopName: expected.sopName,
    version: Number(value.version),
    purpose: value.purpose,
    ownerRole: value.ownerRole,
    appliesTo: value.appliesTo,
    stages: stages.sort((a, b) => a.sequence - b.sequence),
    qualityChecklist,
    requiredDocuments,
  };
}

export function validateStoredStageState(
  value: unknown,
  policy: ProjectSopPolicy,
) {
  if (!Array.isArray(value)) invalid('Project SOP stage state is invalid.');
  const policyIds = new Set(policy.stages.map((stage) => stage.id));
  const seen = new Set<string>();
  const stages = value.map((item) => {
    if (
      !isRecord(item) ||
      !isNonEmptyString(item.stageId) ||
      !stageStatuses.has(item.status as SopStageStatus) ||
      !policyIds.has(item.stageId) ||
      seen.has(item.stageId)
    ) {
      invalid('Project SOP stage state is inconsistent with its policy.');
    }
    seen.add(item.stageId);
    return {
      stageId: item.stageId,
      status: item.status as SopStageStatus,
    };
  });
  if (seen.size !== policyIds.size) {
    invalid('Project SOP stage state is missing mandatory stage data.');
  }
  return stages;
}

export function validateOverrides(value: unknown) {
  if (!Array.isArray(value)) invalid('Project SOP overrides are invalid.');
  return value.map((override) => {
    if (
      !isRecord(override) ||
      !isNonEmptyString(override.targetId) ||
      !isNonEmptyString(override.reason) ||
      !isNonEmptyString(override.approvedBy) ||
      !isNonEmptyString(override.approvedAt) ||
      Number.isNaN(Date.parse(override.approvedAt))
    ) {
      invalid('Project SOP contains an invalid override.');
    }
    return {
      targetId: override.targetId,
      reason: override.reason,
      approvedBy: override.approvedBy,
      approvedAt: override.approvedAt,
    };
  });
}

function validateRequirements(
  value: unknown,
  labelKey: 'title' | 'name',
  label: string,
) {
  if (!Array.isArray(value)) invalid(`SOP ${label} must be an array.`);
  const ids = new Set<string>();
  return value.map((item) => {
    if (
      !isRecord(item) ||
      !isNonEmptyString(item.id) ||
      !isNonEmptyString(item[labelKey]) ||
      !requirementLevels.has(item.requirementLevel as RequirementLevel) ||
      ids.has(item.id)
    ) {
      invalid(`SOP ${label} contains an invalid item.`);
    }
    ids.add(item.id);
    return {
      id: item.id,
      [labelKey]: item[labelKey],
      requirementLevel: item.requirementLevel,
    };
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function invalid(message: string): never {
  throw new SopConfigurationError(message);
}
