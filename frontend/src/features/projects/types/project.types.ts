export type ProjectStatus = "DRAFT" | "ACTIVE" | "COMPLETED" | "ARCHIVED";
export type ProjectType =
  | "SOCIAL_MEDIA_MANAGEMENT"
  | "SEO_MANAGEMENT"
  | "WEBSITE_DEVELOPMENT"
  | "SOFTWARE_DEVELOPMENT";

export type ProjectClient = {
  id: string;
  name: string;
  industry: string | null;
  description: string | null;
  status: "ACTIVE" | "ARCHIVED";
};

export type ProjectAssignee = {
  id: string;
  name: string;
  username: string;
  email: string;
};

export type ProjectWorksheet = {
  id: string;
  status: string;
  externalWorksheetId: string | null;
};

export type Project = {
  id: string;
  clientId: string;
  client?: ProjectClient;
  title: string;
  projectType: ProjectType | null;
  growthObjective: string | null;
  platforms: string[];
  startDate: string | null;
  endDate: string | null;
  month: number | null;
  year: number | null;
  assignedUserId: string | null;
  assignedUser?: ProjectAssignee | null;
  contentTarget: number | null;
  status: ProjectStatus;
  spreadsheetWorksheet?: ProjectWorksheet | null;
  createdAt: string;
  updatedAt: string;
};

export type ProjectListFilters = {
  clientId?: string;
  status?: ProjectStatus | "ALL";
  search?: string;
  assignedUserId?: string;
  projectType?: ProjectType;
  month?: number;
  year?: number;
};

export type CreateProjectInput = {
  clientId: string;
  title: string;
  projectType: ProjectType;
  growthObjective?: string;
  platforms?: string[];
  startDate?: string;
  endDate?: string;
  month?: number;
  year?: number;
  assignedUserId?: string;
  contentTarget?: number;
  status?: ProjectStatus;
};

export type UpdateProjectInput = Partial<
  Pick<
    CreateProjectInput,
    | "title"
    | "growthObjective"
    | "platforms"
    | "startDate"
    | "endDate"
    | "month"
    | "year"
    | "assignedUserId"
    | "contentTarget"
  >
>;
