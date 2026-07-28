"use client";

import { useQuery } from "@tanstack/react-query";
import { Check, ExternalLink, FileDown, Lightbulb, Microscope, Pencil, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BrandLoader } from "@/src/components/ui/brand-loader";
import { getGrowthPlan, type GrowthPlanDetail } from "@/src/features/growth-plans";

const sections: Array<[string, string]> = [
  ["businessObjective", "Business objective"],
  ["audienceSegments", "Audience segments"],
  ["platformPriorities", "Platform priorities"],
  ["contentPillars", "Content pillars"],
  ["recommendedFormats", "Recommended formats"],
  ["postingFrequency", "Posting frequency"],
  ["brandVoiceGuidance", "Brand voice"],
  ["engagementStrategy", "Engagement strategy"],
  ["campaignIdeas", "Campaign ideas"],
  ["hashtagGroups", "Hashtag groups"],
  ["keywordGroups", "Keyword groups"],
  ["callsToAction", "Calls to action"],
  ["kpis", "KPIs"],
  ["risks", "Risks"],
  ["assumptions", "Assumptions"],
];

export default function GrowthPlanDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const query = useQuery({ queryKey: ["growth-plan", projectId], queryFn: () => getGrowthPlan(projectId), enabled: !!projectId });

  if (query.isLoading) return <BrandLoader fullScreen label="Loading growth plan..." />;
  if (query.isError || !query.data) return <main className="grid min-h-[70vh] place-items-center p-6"><Card><CardContent className="p-8 text-center"><p>Growth plan could not be loaded.</p><Button onClick={() => query.refetch()} className="mt-4"><RefreshCw />Retry</Button></CardContent></Card></main>;

  const plan = query.data;
  return <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <Link className="text-sm text-muted-foreground hover:underline" href="/growth-plans">Growth Plans</Link>
        <h1 className="mt-1 text-3xl font-semibold">{plan.projectTitle}</h1>
        <div className="mt-2 flex flex-wrap gap-2"><Badge>{plan.client.name}</Badge><Status status={plan.strategyStatus} /><Badge variant="outline">{label(plan.projectType)}</Badge>{plan.actions.isReadOnly ? <Badge variant="secondary">Read-only archive</Badge> : null}</div>
      </div>
      <Actions plan={plan} />
    </header>

    <section className="grid gap-3 md:grid-cols-4">
      <Fact label="Project status" value={label(plan.projectStatus)} />
      <Fact label="Assigned" value={plan.assignedUser?.name ?? "Unassigned"} />
      <Fact label="Last updated" value={date(plan.lastUpdated)} />
      <Fact label="Approved" value={plan.strategy?.approvedAt ? date(String(plan.strategy.approvedAt)) : "Not approved"} />
    </section>

    <Card>
      <CardHeader><CardTitle>Research summary</CardTitle></CardHeader>
      <CardContent className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-5">
        <Fact label="Brief" value={plan.research.briefExists ? "Created" : "Missing"} />
        <Fact label="Competitors" value={String(plan.research.competitors.length)} />
        <Fact label="References" value={String(plan.research.references.length)} />
        <Fact label="Approved findings" value={String(plan.research.approvedFindingCount)} />
        <Fact label="Pending review" value={String(plan.research.pendingFindingCount)} />
      </CardContent>
    </Card>

    {!plan.strategy ? <Card><CardContent className="py-10 text-center"><p className="font-medium">Strategy not started</p><p className="mt-1 text-sm text-muted-foreground">Open research to generate the first draft after approving findings.</p><Button nativeButton={false} className="mt-4" render={<Link href={plan.links.research} />}><Microscope />Open research</Button></CardContent></Card> : <Card><CardHeader><CardTitle>Strategy</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">{sections.map(([key, title]) => <Section key={key} title={title} value={plan.strategy?.[key]} />)}</CardContent></Card>}

    <Card>
      <CardHeader><CardTitle>Trusted research evidence</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {plan.research.approvedFindings.length === 0 ? <p className="text-sm text-muted-foreground">No approved findings yet.</p> : plan.research.approvedFindings.map((finding) => <div key={finding.id} className="rounded-lg border p-3 text-sm"><Badge variant="outline">{finding.category}</Badge><p className="mt-2 font-medium">{finding.title}</p><p className="mt-1 text-muted-foreground">{finding.explanation ?? "No explanation"}</p></div>)}
        <p className="text-xs text-muted-foreground">Pending and rejected findings are excluded from trusted strategy evidence. Pending: {plan.research.reviewSummary.pendingFindingCount}. Rejected: {plan.research.reviewSummary.rejectedFindingCount}.</p>
      </CardContent>
    </Card>
  </main>;
}

function Actions({ plan }: { plan: GrowthPlanDetail }) {
  return <div className="flex flex-wrap gap-2"><Button nativeButton={false} variant="outline" render={<Link href={plan.links.project} />}>Project</Button><Button nativeButton={false} variant="outline" render={<Link href={plan.links.research} />}><Microscope />Research</Button>{plan.actions.canGenerate ? <Button nativeButton={false} render={<Link href={plan.links.research} />}><Lightbulb />Generate</Button> : null}{plan.actions.canEdit ? <Button nativeButton={false} variant="outline" render={<Link href={plan.links.editStrategy} />}><Pencil />Edit draft</Button> : null}{plan.actions.canApprove ? <Button nativeButton={false} render={<Link href={plan.links.editStrategy} />}><Check />Approve</Button> : null}{plan.links.worksheet ? <Button nativeButton={false} variant="outline" render={<a href={plan.links.worksheet} target="_blank" rel="noreferrer" />}><ExternalLink />Sheet</Button> : null}{plan.actions.canExport ? <Button nativeButton={false} variant="outline" render={<a href={plan.export.excelUrl} />}><FileDown />Excel</Button> : null}</div>;
}
function Fact({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border bg-background p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-medium">{value}</p></div>; }
function Section({ title, value }: { title: string; value: unknown }) { const rendered = renderValue(value); return <div className="rounded-lg border p-4"><p className="font-medium">{title}</p><div className="mt-2 text-sm text-muted-foreground">{rendered}</div></div>; }
function Status({ status }: { status: string }) { return <Badge variant={status === "APPROVED" ? "default" : status === "DRAFT" ? "secondary" : "outline"}>{status === "NOT_STARTED" ? "Not started" : label(status)}</Badge>; }
function renderValue(value: unknown) { if (value === null || value === undefined || value === "") return <span>Not set</span>; if (Array.isArray(value)) return value.length ? <ul className="list-disc space-y-1 pl-4">{value.map((item, index) => <li key={index}>{renderText(item)}</li>)}</ul> : <span>Not set</span>; if (typeof value === "object") return <dl className="space-y-1">{Object.entries(value as Record<string, unknown>).map(([key, item]) => <div key={key}><dt className="font-medium text-foreground">{label(key)}</dt><dd>{renderText(item)}</dd></div>)}</dl>; return <span className="whitespace-pre-wrap">{String(value)}</span>; }
function renderText(value: unknown) { if (value === null || value === undefined) return "Not set"; if (typeof value === "object") return Object.values(value as Record<string, unknown>).map((item) => String(item)).join(" - "); return String(value); }
function label(value?: string | null) { return (value ?? "").toLowerCase().replaceAll("_", " ").replace(/^\w/, (letter) => letter.toUpperCase()); }
function date(value?: string | null) { return value ? new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value)) : "Not set"; }
