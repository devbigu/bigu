import type { SpreadsheetCellValue } from '../../infrastructure/integrations/spreadsheet-provider.interface';

export type SpreadsheetRowDescriptor = {
  entityType: string;
  entityId: string;
  section: string;
  rowIdentifier: string;
};

export type SpreadsheetLayout = {
  values: SpreadsheetCellValue[][];
  mappings: SpreadsheetRowDescriptor[];
};

type ProjectLayoutInput = {
  id: string;
  title: string;
  projectType: string | null;
  growthObjective: string | null;
  platforms: string[];
  startDate: Date | null;
  endDate: Date | null;
  status: string;
  updatedAt: Date;
  client: { name: string };
  assignedUser: { name: string } | null;
  changeRequests: Array<{
    id: string;
    fieldName: string;
    oldValue: string | null;
    proposedValue: string;
    status: string;
    reviewedAt: Date | null;
    updatedAt: Date;
    reviewedBy: { name: string } | null;
  }>;
  files: Array<{
    id: string;
    originalName: string;
    storageUrl: string;
    processingStatus: string;
    createdAt: Date;
    uploadedBy: { name: string };
  }>;
  researchBrief?: {
    id: string;
    businessGoal: string | null;
    researchGoal: string | null;
    targetMarket: string | null;
    geographicFocus: string | null;
    audienceNotes: string | null;
    knownCompetitors: string[];
    platforms: string[];
    constraints: string | null;
    additionalContext: string | null;
  } | null;
  researchCompetitors?: Array<{
    id: string;
    name: string;
    platforms: string[];
    postingFrequency: string | null;
    contentPillars: string[];
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    notes: string | null;
  }>;
  researchReferences?: Array<{
    id: string;
    title: string;
    url: string | null;
    type: string;
    platform: string | null;
    tags: string[];
  }>;
  researchFindings?: Array<{
    id: string;
    category: string;
    title: string;
    proposedValue: unknown;
    explanation: string | null;
    status: string;
    reviewedAt: Date | null;
  }>;
  marketingStrategy?: {
    id: string;
    businessObjective: string | null;
    audienceSegments: unknown;
    platformPriorities: unknown;
    contentPillars: unknown;
    recommendedFormats: unknown;
    postingFrequency: unknown;
    brandVoiceGuidance: string | null;
    engagementStrategy: string | null;
    campaignIdeas: unknown;
    hashtagGroups: unknown;
    keywordGroups: unknown;
    callsToAction: unknown;
    kpis: unknown;
    risks: unknown;
    assumptions: unknown;
    status: string;
    approvedAt: Date | null;
  } | null;
};

type ClientOverviewInput = {
  id: string;
  name: string;
  industry: string | null;
  description: string | null;
  targetAudience: string | null;
  brandVoice: string | null;
  websiteUrl: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  businessObjectives: string | null;
  updatedAt: Date;
  projects: Array<{
    id: string;
    title: string;
    projectType: string | null;
    status: string;
    updatedAt: Date;
    spreadsheetWorksheet: {
      worksheetName: string;
      status: string;
      lastSyncedAt: Date | null;
    } | null;
  }>;
};

export function buildProjectLayout(
  project: ProjectLayoutInput,
  synchronizedAt = new Date(),
): SpreadsheetLayout {
  const rows: SpreadsheetCellValue[][] = [
    [
      'BigU managed columns: A:K. Column L is reserved for user-managed notes. PostgreSQL is the source of truth.',
    ],
    ['PROJECT SUMMARY'],
    ['Project database ID', project.id],
    ['Project title', project.title],
    ['Client name', project.client.name],
    ['Project type', project.projectType],
    ['Status', project.status],
    ['Objective', project.growthObjective],
    ['Start date', dateValue(project.startDate)],
    ['End date', dateValue(project.endDate)],
    ['Assigned users', project.assignedUser?.name ?? ''],
    ['Platforms', project.platforms.join(', ')],
    ['Attached SOP', ''],
    ['SOP version', ''],
    ['Current SOP stage', ''],
    ['Last synchronized time', synchronizedAt.toISOString()],
  ];
  const mappings: SpreadsheetRowDescriptor[] = [
    mapping('PROJECT', project.id, 'PROJECT SUMMARY', 3),
  ];

  addSection(rows, 'APPROVED PROJECT CONTEXT', [
    'Context ID',
    'Category',
    'Key',
    'Value',
    'Source',
    'Approved by',
    'Approved date',
    'Last updated',
  ]);
  for (const change of project.changeRequests.filter(
    (item) => item.status === 'APPROVED',
  )) {
    rows.push([
      change.id,
      'Approved project fact',
      change.fieldName,
      change.proposedValue,
      'Approved chat proposal',
      change.reviewedBy?.name ?? '',
      dateValue(change.reviewedAt),
      dateValue(change.updatedAt),
    ]);
    mappings.push(
      mapping(
        'CONTEXT_CHANGE',
        change.id,
        'APPROVED PROJECT CONTEXT',
        rows.length,
      ),
    );
  }

  addSection(rows, 'SOP PROGRESS', [
    'Stage order',
    'Stage',
    'Status',
    'Required',
    'Assigned to',
    'Due date',
    'Evidence status',
    'Internal approval',
    'Client approval',
    'Completed date',
    'Blocked reason',
  ]);
  addSection(rows, 'TASKS', [
    'Task ID',
    'Task',
    'Related SOP stage',
    'Assigned user',
    'Priority',
    'Due date',
    'Status',
    'Updated date',
  ]);
  addSection(rows, 'FILES AND EVIDENCE', [
    'File ID',
    'File name',
    'Category',
    'Related SOP stage',
    'Cloudinary URL',
    'Approval status',
    'Uploaded by',
    'Uploaded date',
  ]);
  for (const file of project.files.filter(
    (item) => item.processingStatus === 'APPROVED',
  )) {
    rows.push([
      file.id,
      file.originalName,
      'Project file',
      '',
      file.storageUrl,
      file.processingStatus,
      file.uploadedBy.name,
      dateValue(file.createdAt),
    ]);
    mappings.push(
      mapping('PROJECT_FILE', file.id, 'FILES AND EVIDENCE', rows.length),
    );
  }

  addSection(rows, 'APPROVALS', [
    'Approval ID',
    'Type',
    'Related stage',
    'Status',
    'Requested by',
    'Reviewed by',
    'Review note',
    'Reviewed date',
  ]);
  for (const change of project.changeRequests.filter(
    (item) => item.status === 'APPROVED',
  )) {
    rows.push([
      change.id,
      'Project context',
      '',
      change.status,
      'AI proposal',
      change.reviewedBy?.name ?? '',
      '',
      dateValue(change.reviewedAt),
    ]);
  }

  addSection(rows, 'REPORTS', [
    'Report ID',
    'Report type',
    'Version',
    'Status',
    'Generated date',
    'Approved date',
    'PDF URL',
    'Excel URL',
  ]);

  addPhaseFiveResearchSections(rows, mappings, project, synchronizedAt);
  addSection(rows, 'PROJECT UPDATE LOG', [
    'Activity ID',
    'Date',
    'User',
    'Action',
    'Field/entity',
    'Old value',
    'New value',
    'Source',
  ]);
  for (const change of project.changeRequests.filter(
    (item) => item.status === 'APPROVED',
  )) {
    rows.push([
      change.id,
      dateValue(change.reviewedAt),
      change.reviewedBy?.name ?? '',
      'Approved update',
      change.fieldName,
      change.oldValue ?? '',
      change.proposedValue,
      'Project chat',
    ]);
  }

  return { values: rows, mappings };
}

export function buildClientOverviewLayout(
  client: ClientOverviewInput,
  synchronizedAt = new Date(),
): SpreadsheetLayout {
  const activeProjects = client.projects.filter(
    (project) => project.status !== 'ARCHIVED',
  );
  const rows: SpreadsheetCellValue[][] = [
    ['BigU managed worksheet. PostgreSQL is the source of truth.'],
    ['CLIENT OVERVIEW'],
    ['Client database ID', client.id],
    ['Client name', client.name],
    ['Industry', client.industry],
    ['Description', client.description],
    ['Target audience', client.targetAudience],
    ['Brand voice', client.brandVoice],
    ['Website', client.websiteUrl],
    ['Instagram', client.instagramUrl],
    ['Facebook', client.facebookUrl],
    ['Business objectives', client.businessObjectives],
    ['Number of active projects', activeProjects.length],
    ['Last synchronized time', synchronizedAt.toISOString()],
    [],
    ['PROJECT DIRECTORY'],
    [
      'Project database ID',
      'Project name',
      'Project type',
      'Worksheet name',
      'Status',
      'Current SOP stage',
      'Completion percentage',
      'Last updated',
    ],
  ];
  const mappings: SpreadsheetRowDescriptor[] = [];
  for (const project of client.projects) {
    rows.push([
      project.id,
      project.title,
      project.projectType,
      project.spreadsheetWorksheet?.worksheetName ?? '',
      project.status,
      '',
      '',
      dateValue(project.updatedAt),
    ]);
    mappings.push(
      mapping('PROJECT', project.id, 'PROJECT DIRECTORY', rows.length),
    );
  }
  return { values: rows, mappings };
}

export function buildSyncLogLayout(
  jobs: Array<{
    id: string;
    requestedAt: Date;
    sourceType: string;
    sourceId: string;
    operation: string;
    status: string;
    attempts: number;
    completedAt: Date | null;
    errorCode: string | null;
  }>,
): SpreadsheetCellValue[][] {
  return [
    [
      'Sync job ID',
      'Requested at',
      'Source type',
      'Source ID',
      'Operation',
      'Status',
      'Attempts',
      'Completed at',
      'Error code',
    ],
    ...jobs.map((job) => [
      job.id,
      job.requestedAt.toISOString(),
      job.sourceType,
      job.sourceId,
      job.operation,
      job.status,
      job.attempts,
      dateValue(job.completedAt),
      job.errorCode ?? '',
    ]),
  ];
}

function addSection(
  rows: SpreadsheetCellValue[][],
  title: string,
  headers: string[],
) {
  rows.push([]);
  rows.push([title]);
  rows.push(headers);
}

function mapping(
  entityType: string,
  entityId: string,
  section: string,
  row: number,
): SpreadsheetRowDescriptor {
  return { entityType, entityId, section, rowIdentifier: `A${row}` };
}

function dateValue(value: Date | null) {
  return value ? value.toISOString() : '';
}

function addPhaseFiveResearchSections(
  rows: SpreadsheetCellValue[][],
  mappings: SpreadsheetRowDescriptor[],
  project: ProjectLayoutInput,
  synchronizedAt: Date,
) {
  addSection(rows, 'RESEARCH SUMMARY', ['Field', 'Value']);
  if (project.researchBrief) {
    const brief = project.researchBrief;
    rows.push(['Business goal', brief.businessGoal ?? '']);
    rows.push(['Research goal', brief.researchGoal ?? '']);
    rows.push(['Target audience', brief.targetMarket ?? '']);
    rows.push(['Geographic focus', brief.geographicFocus ?? '']);
    rows.push(['Audience notes', brief.audienceNotes ?? '']);
    rows.push(['Known competitors', brief.knownCompetitors.join(', ')]);
    rows.push(['Platforms', brief.platforms.join(', ')]);
    rows.push(['Constraints', brief.constraints ?? '']);
    rows.push(['Additional context', brief.additionalContext ?? '']);
    mappings.push(
      mapping('RESEARCH_BRIEF', brief.id, 'RESEARCH SUMMARY', rows.length - 8),
    );
  }

  addSection(rows, 'COMPETITOR ANALYSIS', [
    'Competitor ID',
    'Name',
    'Platforms',
    'Frequency',
    'Content pillars',
    'Strengths',
    'Weaknesses',
    'Opportunities',
    'Notes',
  ]);
  for (const competitor of project.researchCompetitors ?? []) {
    rows.push([
      competitor.id,
      competitor.name,
      competitor.platforms.join(', '),
      competitor.postingFrequency ?? '',
      competitor.contentPillars.join(', '),
      competitor.strengths.join(', '),
      competitor.weaknesses.join(', '),
      competitor.opportunities.join(', '),
      competitor.notes ?? '',
    ]);
    mappings.push(
      mapping(
        'RESEARCH_COMPETITOR',
        competitor.id,
        'COMPETITOR ANALYSIS',
        rows.length,
      ),
    );
  }

  addSection(rows, 'APPROVED FINDINGS', [
    'Finding ID',
    'Category',
    'Title',
    'Value',
    'Explanation',
    'Approved date',
  ]);
  for (const finding of (project.researchFindings ?? []).filter(
    (item) => item.status === 'APPROVED',
  )) {
    rows.push([
      finding.id,
      finding.category,
      finding.title,
      stringifyCell(finding.proposedValue),
      finding.explanation ?? '',
      dateValue(finding.reviewedAt),
    ]);
    mappings.push(
      mapping('RESEARCH_FINDING', finding.id, 'APPROVED FINDINGS', rows.length),
    );
  }

  const strategy =
    project.marketingStrategy?.status === 'APPROVED'
      ? project.marketingStrategy
      : null;
  addSection(rows, 'MARKETING STRATEGY', ['Section', 'Value']);
  if (strategy) {
    rows.push(['Objective', strategy.businessObjective ?? '']);
    rows.push(['Target Audience', stringifyCell(strategy.audienceSegments)]);
    rows.push([
      'Platform Priorities',
      stringifyCell(strategy.platformPriorities),
    ]);
    rows.push(['Content Pillars', stringifyCell(strategy.contentPillars)]);
    rows.push(['Content Formats', stringifyCell(strategy.recommendedFormats)]);
    rows.push([
      'Posting Recommendations',
      stringifyCell(strategy.postingFrequency),
    ]);
    rows.push(['Hashtag Groups', stringifyCell(strategy.hashtagGroups)]);
    rows.push(['Keyword Groups', stringifyCell(strategy.keywordGroups)]);
    rows.push([
      'Campaign Opportunities',
      stringifyCell(strategy.campaignIdeas),
    ]);
    rows.push([
      'Risks and Assumptions',
      [stringifyCell(strategy.risks), stringifyCell(strategy.assumptions)]
        .filter(Boolean)
        .join(' | '),
    ]);
    rows.push(['Approved at', dateValue(strategy.approvedAt)]);
    mappings.push(
      mapping(
        'MARKETING_STRATEGY',
        strategy.id,
        'MARKETING STRATEGY',
        rows.length - 10,
      ),
    );
  }

  addSection(rows, 'APPROVED REFERENCES', [
    'Reference ID',
    'Title',
    'Type',
    'Platform',
    'URL',
    'Tags',
  ]);
  for (const reference of project.researchReferences ?? []) {
    rows.push([
      reference.id,
      reference.title,
      reference.type,
      reference.platform ?? '',
      reference.url ?? '',
      reference.tags.join(', '),
    ]);
    mappings.push(
      mapping(
        'RESEARCH_REFERENCE',
        reference.id,
        'APPROVED REFERENCES',
        rows.length,
      ),
    );
  }

  addSection(rows, 'RESEARCH SYNC METADATA', ['Field', 'Value']);
  rows.push(['Synchronized at', synchronizedAt.toISOString()]);
  rows.push([
    'Approved finding count',
    String(
      (project.researchFindings ?? []).filter(
        (item) => item.status === 'APPROVED',
      ).length,
    ),
  ]);
  rows.push(['Strategy status', project.marketingStrategy?.status ?? '']);
}

function stringifyCell(value: unknown) {
  if (value === null || value === undefined) return '';
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  )
    return String(value);
  return JSON.stringify(value);
}
