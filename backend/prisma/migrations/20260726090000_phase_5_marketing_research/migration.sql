CREATE TYPE "bigu_app"."ProjectReferenceType" AS ENUM ('COMPETITOR_POST','CAMPAIGN','ARTICLE','WEBSITE','VIDEO','SCREENSHOT','DOCUMENT','INSPIRATION','INTERNAL_NOTE','OTHER');
CREATE TYPE "bigu_app"."ResearchObservationCategory" AS ENUM ('BRAND','INDUSTRY','COMPETITOR','AUDIENCE','PLATFORM','CONTENT','HASHTAG','KEYWORD','TREND','OPPORTUNITY','RISK','OTHER');
CREATE TYPE "bigu_app"."ResearchFindingCategory" AS ENUM ('AUDIENCE','COMPETITOR','PLATFORM','CONTENT','HASHTAG','KEYWORD','TONE','VISUAL','CAMPAIGN','RISK','ASSUMPTION','OPPORTUNITY','OTHER');
CREATE TYPE "bigu_app"."ResearchFindingStatus" AS ENUM ('PENDING','APPROVED','REJECTED');
CREATE TYPE "bigu_app"."MarketingStrategyStatus" AS ENUM ('DRAFT','APPROVED');

CREATE TABLE "bigu_app"."project_research_briefs" (
  "id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "business_goal" TEXT,
  "research_goal" TEXT,
  "target_market" TEXT,
  "geographic_focus" TEXT,
  "audience_notes" TEXT,
  "known_competitors" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "platforms" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "constraints" TEXT,
  "additional_context" TEXT,
  "created_by_id" TEXT NOT NULL,
  "updated_by_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "project_research_briefs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bigu_app"."project_competitors" (
  "id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "name" VARCHAR(200) NOT NULL,
  "website_url" VARCHAR(2048),
  "instagram_url" VARCHAR(2048),
  "facebook_url" VARCHAR(2048),
  "youtube_url" VARCHAR(2048),
  "linkedin_url" VARCHAR(2048),
  "other_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "platforms" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "posting_frequency" TEXT,
  "content_pillars" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "tone_of_voice" TEXT,
  "visual_style" TEXT,
  "common_calls_to_action" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "engagement_observations" TEXT,
  "strengths" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "weaknesses" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "opportunities" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "notes" TEXT,
  "created_by_id" TEXT NOT NULL,
  "updated_by_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "project_competitors_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bigu_app"."project_references" (
  "id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "title" VARCHAR(240) NOT NULL,
  "url" VARCHAR(2048),
  "type" "bigu_app"."ProjectReferenceType" NOT NULL DEFAULT 'OTHER',
  "platform" VARCHAR(120),
  "description" TEXT,
  "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "project_file_id" TEXT,
  "created_by_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "project_references_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bigu_app"."research_observations" (
  "id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "category" "bigu_app"."ResearchObservationCategory" NOT NULL DEFAULT 'OTHER',
  "title" VARCHAR(200) NOT NULL,
  "content" TEXT NOT NULL,
  "source_reference_id" TEXT,
  "source_competitor_id" TEXT,
  "created_by_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "research_observations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bigu_app"."research_findings" (
  "id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "category" "bigu_app"."ResearchFindingCategory" NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "proposed_value" JSONB NOT NULL,
  "explanation" TEXT,
  "evidence" JSONB,
  "confidence" DOUBLE PRECISION,
  "status" "bigu_app"."ResearchFindingStatus" NOT NULL DEFAULT 'PENDING',
  "source_type" VARCHAR(40) NOT NULL DEFAULT 'AI',
  "source_ai_message_id" TEXT,
  "provider" VARCHAR(80),
  "model" VARCHAR(120),
  "prompt_version" VARCHAR(40),
  "reviewed_by_id" TEXT,
  "reviewed_at" TIMESTAMP(3),
  "rejection_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "research_findings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bigu_app"."project_marketing_strategies" (
  "id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "business_objective" TEXT,
  "audience_segments" JSONB,
  "platform_priorities" JSONB,
  "content_pillars" JSONB,
  "recommended_formats" JSONB,
  "posting_frequency" JSONB,
  "brand_voice_guidance" TEXT,
  "engagement_strategy" TEXT,
  "campaign_ideas" JSONB,
  "hashtag_groups" JSONB,
  "keyword_groups" JSONB,
  "calls_to_action" JSONB,
  "kpis" JSONB,
  "risks" JSONB,
  "assumptions" JSONB,
  "status" "bigu_app"."MarketingStrategyStatus" NOT NULL DEFAULT 'DRAFT',
  "generated_from_approved_research_at" TIMESTAMP(3),
  "created_by_id" TEXT NOT NULL,
  "updated_by_id" TEXT NOT NULL,
  "approved_by_id" TEXT,
  "approved_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "project_marketing_strategies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "project_research_briefs_project_id_key" ON "bigu_app"."project_research_briefs"("project_id");
CREATE INDEX "project_competitors_project_id_name_idx" ON "bigu_app"."project_competitors"("project_id", "name");
CREATE INDEX "project_references_project_id_type_idx" ON "bigu_app"."project_references"("project_id", "type");
CREATE INDEX "research_observations_project_id_category_idx" ON "bigu_app"."research_observations"("project_id", "category");
CREATE INDEX "research_findings_project_id_status_idx" ON "bigu_app"."research_findings"("project_id", "status");
CREATE INDEX "research_findings_project_id_category_idx" ON "bigu_app"."research_findings"("project_id", "category");
CREATE UNIQUE INDEX "project_marketing_strategies_project_id_key" ON "bigu_app"."project_marketing_strategies"("project_id");

ALTER TABLE "bigu_app"."project_research_briefs" ADD CONSTRAINT "project_research_briefs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "bigu_app"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bigu_app"."project_research_briefs" ADD CONSTRAINT "project_research_briefs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "bigu_app"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bigu_app"."project_research_briefs" ADD CONSTRAINT "project_research_briefs_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "bigu_app"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bigu_app"."project_competitors" ADD CONSTRAINT "project_competitors_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "bigu_app"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bigu_app"."project_competitors" ADD CONSTRAINT "project_competitors_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "bigu_app"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bigu_app"."project_competitors" ADD CONSTRAINT "project_competitors_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "bigu_app"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bigu_app"."project_references" ADD CONSTRAINT "project_references_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "bigu_app"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bigu_app"."project_references" ADD CONSTRAINT "project_references_project_file_id_fkey" FOREIGN KEY ("project_file_id") REFERENCES "bigu_app"."client_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "bigu_app"."project_references" ADD CONSTRAINT "project_references_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "bigu_app"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bigu_app"."research_observations" ADD CONSTRAINT "research_observations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "bigu_app"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bigu_app"."research_observations" ADD CONSTRAINT "research_observations_source_reference_id_fkey" FOREIGN KEY ("source_reference_id") REFERENCES "bigu_app"."project_references"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "bigu_app"."research_observations" ADD CONSTRAINT "research_observations_source_competitor_id_fkey" FOREIGN KEY ("source_competitor_id") REFERENCES "bigu_app"."project_competitors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "bigu_app"."research_observations" ADD CONSTRAINT "research_observations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "bigu_app"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bigu_app"."research_findings" ADD CONSTRAINT "research_findings_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "bigu_app"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bigu_app"."research_findings" ADD CONSTRAINT "research_findings_source_ai_message_id_fkey" FOREIGN KEY ("source_ai_message_id") REFERENCES "bigu_app"."messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "bigu_app"."research_findings" ADD CONSTRAINT "research_findings_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "bigu_app"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "bigu_app"."project_marketing_strategies" ADD CONSTRAINT "project_marketing_strategies_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "bigu_app"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bigu_app"."project_marketing_strategies" ADD CONSTRAINT "project_marketing_strategies_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "bigu_app"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bigu_app"."project_marketing_strategies" ADD CONSTRAINT "project_marketing_strategies_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "bigu_app"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bigu_app"."project_marketing_strategies" ADD CONSTRAINT "project_marketing_strategies_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "bigu_app"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;