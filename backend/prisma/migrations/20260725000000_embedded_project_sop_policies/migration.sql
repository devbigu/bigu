CREATE TYPE "bigu_app"."SopVersionStatus" AS ENUM (
  'DRAFT',
  'PUBLISHED',
  'RETIRED',
  'ARCHIVED'
);

CREATE TABLE "bigu_app"."sop_versions" (
  "id" TEXT NOT NULL,
  "sop_code" VARCHAR(20) NOT NULL,
  "sop_name" VARCHAR(200) NOT NULL,
  "version" INTEGER NOT NULL,
  "project_type" VARCHAR(120) NOT NULL,
  "purpose" TEXT NOT NULL,
  "owner_role" VARCHAR(160) NOT NULL,
  "applies_to" TEXT NOT NULL,
  "stages" JSONB NOT NULL,
  "quality_checklist" JSONB NOT NULL,
  "required_documents" JSONB NOT NULL,
  "status" "bigu_app"."SopVersionStatus" NOT NULL DEFAULT 'DRAFT',
  "published_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sop_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bigu_app"."project_sop_states" (
  "id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "current_stage_id" VARCHAR(160),
  "stages" JSONB NOT NULL,
  "completed_checklist_item_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "uploaded_document_requirement_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "approved_internal_stage_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "approved_client_stage_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "active_overrides" JSONB NOT NULL DEFAULT '[]'::JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "project_sop_states_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "bigu_app"."projects" ADD COLUMN "sop_version_id" TEXT;

CREATE UNIQUE INDEX "sop_versions_sop_code_version_key"
ON "bigu_app"."sop_versions"("sop_code", "version");

CREATE INDEX "sop_versions_project_type_status_version_idx"
ON "bigu_app"."sop_versions"("project_type", "status", "version");

CREATE UNIQUE INDEX "project_sop_states_project_id_key"
ON "bigu_app"."project_sop_states"("project_id");

CREATE INDEX "projects_sop_version_id_idx"
ON "bigu_app"."projects"("sop_version_id");

ALTER TABLE "bigu_app"."projects"
ADD CONSTRAINT "projects_sop_version_id_fkey"
FOREIGN KEY ("sop_version_id") REFERENCES "bigu_app"."sop_versions"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "bigu_app"."project_sop_states"
ADD CONSTRAINT "project_sop_states_project_id_fkey"
FOREIGN KEY ("project_id") REFERENCES "bigu_app"."projects"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "bigu_app"."sop_versions" (
  "id", "sop_code", "sop_name", "version", "project_type", "purpose",
  "owner_role", "applies_to", "stages", "quality_checklist",
  "required_documents", "status", "published_at"
) VALUES
(
  gen_random_uuid()::TEXT,
  'SOP-03',
  'Social Media Management',
  1,
  'SOCIAL_MEDIA_MANAGEMENT',
  'Govern social-media delivery from business understanding through reporting.',
  'Social Media Manager',
  'All BigU social-media management projects.',
  '[
    {"id":"business-understanding","sequence":1,"title":"Business understanding","instructions":["Confirm business goals, audience, brand voice, platforms, and constraints."],"required":true,"requiresEvidence":true,"requiresInternalApproval":false,"requiresClientApproval":false},
    {"id":"content-planning","sequence":2,"title":"Content planning","instructions":["Create the content plan, formats, topics, cadence, owners, and dates."],"required":true,"requiresEvidence":true,"requiresInternalApproval":true,"requiresClientApproval":false},
    {"id":"editing-design","sequence":3,"title":"Editing and design","instructions":["Draft, edit, design, and verify every planned asset."],"required":true,"requiresEvidence":true,"requiresInternalApproval":false,"requiresClientApproval":false},
    {"id":"internal-quality-check","sequence":4,"title":"Internal quality check","instructions":["Verify copy, creative, links, brand alignment, and platform requirements."],"required":true,"requiresEvidence":true,"requiresInternalApproval":true,"requiresClientApproval":false},
    {"id":"client-approval","sequence":5,"title":"Client approval","instructions":["Obtain and record client approval before scheduling or publication."],"required":true,"requiresEvidence":true,"requiresInternalApproval":false,"requiresClientApproval":true},
    {"id":"scheduling-publishing","sequence":6,"title":"Scheduling and publishing","instructions":["Confirm scheduling information and publish only approved content."],"required":true,"requiresEvidence":true,"requiresInternalApproval":false,"requiresClientApproval":false},
    {"id":"community-management","sequence":7,"title":"Community management","instructions":["Monitor and respond using approved escalation and response guidance."],"required":true,"requiresEvidence":true,"requiresInternalApproval":false,"requiresClientApproval":false},
    {"id":"reporting","sequence":8,"title":"Reporting","instructions":["Prepare and approve the period performance report and learnings."],"required":true,"requiresEvidence":true,"requiresInternalApproval":true,"requiresClientApproval":false}
  ]'::JSONB,
  '[
    {"id":"content-plan-approved","title":"Content plan is internally approved","requirementLevel":"REQUIRED"},
    {"id":"brand-quality-checked","title":"Copy and creative pass brand and platform quality checks","requirementLevel":"REQUIRED"},
    {"id":"client-approval-recorded","title":"Client approval is recorded before publishing","requirementLevel":"REQUIRED"},
    {"id":"schedule-confirmed","title":"Scheduling information is complete","requirementLevel":"REQUIRED"},
    {"id":"community-response-review","title":"Community response patterns are reviewed","requirementLevel":"RECOMMENDED"}
  ]'::JSONB,
  '[
    {"id":"content-plan","name":"Approved content plan","requirementLevel":"REQUIRED"},
    {"id":"client-approval-record","name":"Client approval record","requirementLevel":"REQUIRED"},
    {"id":"publishing-log","name":"Publishing and scheduling log","requirementLevel":"REQUIRED"},
    {"id":"monthly-report","name":"Performance report","requirementLevel":"REQUIRED"}
  ]'::JSONB,
  'PUBLISHED',
  CURRENT_TIMESTAMP
),
(
  gen_random_uuid()::TEXT,
  'SOP-04',
  'Search Engine Optimization',
  1,
  'SEO_MANAGEMENT',
  'Govern SEO delivery from business understanding and audit through reporting.',
  'SEO Manager',
  'All BigU SEO management projects.',
  '[
    {"id":"business-understanding","sequence":1,"title":"Business understanding","instructions":["Confirm goals, market, audience, services, competitors, and access."],"required":true,"requiresEvidence":true,"requiresInternalApproval":false,"requiresClientApproval":false},
    {"id":"seo-audit","sequence":2,"title":"SEO audit","instructions":["Complete technical, on-page, content, backlink, and competitor audits."],"required":true,"requiresEvidence":true,"requiresInternalApproval":true,"requiresClientApproval":false},
    {"id":"strategy-planning","sequence":3,"title":"Strategy and planning","instructions":["Prioritize keywords, pages, issues, owners, dependencies, and targets."],"required":true,"requiresEvidence":true,"requiresInternalApproval":true,"requiresClientApproval":true},
    {"id":"optimization","sequence":4,"title":"Optimization","instructions":["Implement approved on-page, content, technical, and authority work."],"required":true,"requiresEvidence":true,"requiresInternalApproval":false,"requiresClientApproval":false},
    {"id":"performance-monitoring","sequence":5,"title":"Performance monitoring","instructions":["Monitor rankings, traffic, conversions, indexation, and errors."],"required":true,"requiresEvidence":true,"requiresInternalApproval":false,"requiresClientApproval":false},
    {"id":"client-follow-up","sequence":6,"title":"Client follow-up","instructions":["Track client dependencies, approvals, access, and follow-up actions."],"required":true,"requiresEvidence":true,"requiresInternalApproval":false,"requiresClientApproval":false},
    {"id":"monthly-reporting","sequence":7,"title":"Monthly reporting","instructions":["Prepare the monthly report with completed work, results, blockers, and next actions."],"required":true,"requiresEvidence":true,"requiresInternalApproval":true,"requiresClientApproval":false}
  ]'::JSONB,
  '[
    {"id":"audit-complete","title":"Required audit coverage is complete","requirementLevel":"REQUIRED"},
    {"id":"changes-evidenced","title":"Optimization work has implementation evidence","requirementLevel":"REQUIRED"},
    {"id":"monitoring-current","title":"Performance monitoring data is current","requirementLevel":"REQUIRED"},
    {"id":"follow-up-current","title":"Client follow-up items are current","requirementLevel":"REQUIRED"},
    {"id":"report-approved","title":"Monthly report passes internal review","requirementLevel":"REQUIRED"},
    {"id":"competitor-refresh","title":"Competitor review is refreshed","requirementLevel":"RECOMMENDED"}
  ]'::JSONB,
  '[
    {"id":"seo-audit","name":"SEO audit","requirementLevel":"REQUIRED"},
    {"id":"keyword-plan","name":"Keyword and optimization plan","requirementLevel":"REQUIRED"},
    {"id":"implementation-log","name":"SEO implementation log","requirementLevel":"REQUIRED"},
    {"id":"monthly-seo-report","name":"Monthly SEO report","requirementLevel":"REQUIRED"}
  ]'::JSONB,
  'PUBLISHED',
  CURRENT_TIMESTAMP
),
(
  gen_random_uuid()::TEXT,
  'SOP-05',
  'Website Development',
  1,
  'WEBSITE_DEVELOPMENT',
  'Govern website delivery from requirements through launch and handover.',
  'Website Project Manager',
  'All BigU website development projects.',
  '[
    {"id":"requirements","sequence":1,"title":"Requirements","instructions":["Document scope, goals, users, content, integrations, acceptance criteria, and responsibilities."],"required":true,"requiresEvidence":true,"requiresInternalApproval":true,"requiresClientApproval":true},
    {"id":"design","sequence":2,"title":"Design","instructions":["Create and approve information architecture, responsive designs, and interaction states."],"required":true,"requiresEvidence":true,"requiresInternalApproval":true,"requiresClientApproval":true},
    {"id":"development","sequence":3,"title":"Development","instructions":["Build the approved responsive experience, integrations, forms, analytics, and content."],"required":true,"requiresEvidence":true,"requiresInternalApproval":false,"requiresClientApproval":false},
    {"id":"quality-assurance","sequence":4,"title":"Quality assurance","instructions":["Test responsiveness, browsers, accessibility, performance, links, forms, content, security, analytics, and indexing controls."],"required":true,"requiresEvidence":true,"requiresInternalApproval":true,"requiresClientApproval":false},
    {"id":"client-approval","sequence":5,"title":"Client approval","instructions":["Obtain recorded client approval of the release candidate."],"required":true,"requiresEvidence":true,"requiresInternalApproval":false,"requiresClientApproval":true},
    {"id":"launch","sequence":6,"title":"Launch","instructions":["Verify backup, SSL, analytics, indexing, DNS, monitoring, and rollback before launch."],"required":true,"requiresEvidence":true,"requiresInternalApproval":true,"requiresClientApproval":true},
    {"id":"handover","sequence":7,"title":"Handover","instructions":["Deliver credentials, documentation, source, training, backup, and support terms."],"required":true,"requiresEvidence":true,"requiresInternalApproval":true,"requiresClientApproval":true}
  ]'::JSONB,
  '[
    {"id":"responsive-testing","title":"Responsive testing is complete","requirementLevel":"REQUIRED"},
    {"id":"links-and-forms","title":"Links and forms are verified","requirementLevel":"REQUIRED"},
    {"id":"client-approval-recorded","title":"Client approval is recorded","requirementLevel":"REQUIRED"},
    {"id":"backup-ready","title":"A verified launch backup is ready","requirementLevel":"REQUIRED"},
    {"id":"ssl-ready","title":"SSL is configured and verified","requirementLevel":"REQUIRED"},
    {"id":"analytics-ready","title":"Analytics is configured and verified","requirementLevel":"REQUIRED"},
    {"id":"indexing-ready","title":"Indexing configuration is verified","requirementLevel":"REQUIRED"},
    {"id":"performance-budget","title":"Performance budget is met","requirementLevel":"RECOMMENDED"}
  ]'::JSONB,
  '[
    {"id":"requirements-specification","name":"Approved requirements specification","requirementLevel":"REQUIRED"},
    {"id":"design-approval","name":"Design approval record","requirementLevel":"REQUIRED"},
    {"id":"qa-report","name":"QA report","requirementLevel":"REQUIRED"},
    {"id":"launch-checklist","name":"Launch checklist and rollback plan","requirementLevel":"REQUIRED"},
    {"id":"handover-pack","name":"Handover pack","requirementLevel":"REQUIRED"}
  ]'::JSONB,
  'PUBLISHED',
  CURRENT_TIMESTAMP
),
(
  gen_random_uuid()::TEXT,
  'SOP-06',
  'Software Development',
  1,
  'SOFTWARE_DEVELOPMENT',
  'Govern software delivery from requirements and database design through support.',
  'Software Project Manager',
  'All BigU software development projects.',
  '[
    {"id":"requirements","sequence":1,"title":"Requirements","instructions":["Document scope, roles, use cases, acceptance criteria, constraints, and non-functional requirements."],"required":true,"requiresEvidence":true,"requiresInternalApproval":true,"requiresClientApproval":true},
    {"id":"database-design","sequence":2,"title":"Database design","instructions":["Design and review schema, integrity, security, migrations, retention, and backup requirements."],"required":true,"requiresEvidence":true,"requiresInternalApproval":true,"requiresClientApproval":false},
    {"id":"solution-design","sequence":3,"title":"Solution design","instructions":["Approve architecture, interfaces, security model, environments, deployment, and observability."],"required":true,"requiresEvidence":true,"requiresInternalApproval":true,"requiresClientApproval":false},
    {"id":"development","sequence":4,"title":"Development","instructions":["Implement reviewed changes with traceability, tests, and controlled configuration."],"required":true,"requiresEvidence":true,"requiresInternalApproval":false,"requiresClientApproval":false},
    {"id":"internal-testing","sequence":5,"title":"Internal testing","instructions":["Complete functional, integration, regression, security, performance, and migration testing; resolve critical bugs."],"required":true,"requiresEvidence":true,"requiresInternalApproval":true,"requiresClientApproval":false},
    {"id":"uat","sequence":6,"title":"User acceptance testing","instructions":["Complete UAT against acceptance criteria and obtain recorded sign-off."],"required":true,"requiresEvidence":true,"requiresInternalApproval":false,"requiresClientApproval":true},
    {"id":"deployment","sequence":7,"title":"Deployment","instructions":["Verify approval, checklist, backup, migrations, monitoring, rollback, and communications before production deployment."],"required":true,"requiresEvidence":true,"requiresInternalApproval":true,"requiresClientApproval":true},
    {"id":"support","sequence":8,"title":"Support and handover","instructions":["Provide documentation, training, monitoring, incident handling, warranty, and ownership handover."],"required":true,"requiresEvidence":true,"requiresInternalApproval":true,"requiresClientApproval":true}
  ]'::JSONB,
  '[
    {"id":"development-complete","title":"Approved development scope is complete","requirementLevel":"REQUIRED"},
    {"id":"internal-testing-complete","title":"Internal testing is complete","requirementLevel":"REQUIRED"},
    {"id":"critical-bugs-resolved","title":"No unresolved critical bugs remain","requirementLevel":"REQUIRED"},
    {"id":"uat-signoff","title":"UAT sign-off is recorded","requirementLevel":"REQUIRED"},
    {"id":"backup-ready","title":"A verified production backup is ready","requirementLevel":"REQUIRED"},
    {"id":"deployment-approved","title":"Deployment approval and checklist are complete","requirementLevel":"REQUIRED"},
    {"id":"post-deploy-review","title":"Post-deployment review is scheduled","requirementLevel":"RECOMMENDED"}
  ]'::JSONB,
  '[
    {"id":"requirements-specification","name":"Approved software requirements","requirementLevel":"REQUIRED"},
    {"id":"database-design","name":"Database design and migration plan","requirementLevel":"REQUIRED"},
    {"id":"test-report","name":"Internal test report","requirementLevel":"REQUIRED"},
    {"id":"uat-signoff","name":"UAT sign-off","requirementLevel":"REQUIRED"},
    {"id":"deployment-checklist","name":"Deployment checklist and rollback plan","requirementLevel":"REQUIRED"},
    {"id":"support-handover","name":"Support and handover pack","requirementLevel":"REQUIRED"}
  ]'::JSONB,
  'PUBLISHED',
  CURRENT_TIMESTAMP
);

UPDATE "bigu_app"."projects" AS project
SET "sop_version_id" = sop."id"
FROM "bigu_app"."sop_versions" AS sop
WHERE project."project_type" = sop."project_type"
  AND sop."status" = 'PUBLISHED'
  AND sop."version" = 1;

INSERT INTO "bigu_app"."project_sop_states" (
  "id",
  "project_id",
  "current_stage_id",
  "stages",
  "active_overrides"
)
SELECT
  gen_random_uuid()::TEXT,
  project."id",
  sop."stages"->0->>'id',
  (
    SELECT jsonb_agg(
      jsonb_build_object('stageId', stage.item->>'id', 'status', 'NOT_STARTED')
      ORDER BY (stage.item->>'sequence')::INTEGER
    )
    FROM jsonb_array_elements(sop."stages") AS stage(item)
  ),
  '[]'::JSONB
FROM "bigu_app"."projects" AS project
JOIN "bigu_app"."sop_versions" AS sop
  ON sop."id" = project."sop_version_id";

CREATE OR REPLACE FUNCTION "bigu_app"."prevent_project_sop_reassignment"()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD."sop_version_id" IS NOT NULL
    AND NEW."sop_version_id" IS DISTINCT FROM OLD."sop_version_id" THEN
    RAISE EXCEPTION 'A project SOP version is immutable after attachment';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "projects_prevent_sop_reassignment"
BEFORE UPDATE OF "sop_version_id" ON "bigu_app"."projects"
FOR EACH ROW
EXECUTE FUNCTION "bigu_app"."prevent_project_sop_reassignment"();
