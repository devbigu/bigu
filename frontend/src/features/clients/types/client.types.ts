export type ClientStatus = "ACTIVE" | "ARCHIVED";

export type ClientCreator = {
  id: string;
  name: string;
  username: string;
  email: string;
};

export type Client = {
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
  status: ClientStatus;
  createdById: string;
  createdBy: ClientCreator;
  createdAt: string;
  updatedAt: string;
};

export type CreateClientInput = {
  name: string;
  industry?: string;
  description?: string;
  targetAudience?: string;
  brandVoice?: string;
  websiteUrl?: string;
  instagramUrl?: string;
  facebookUrl?: string;
  businessObjectives?: string;
};
export type UpdateClientInput = Partial<CreateClientInput>;
export type ClientListFilters = { search?: string; status?: ClientStatus | "ALL" };

