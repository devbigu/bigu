"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ExternalLink, FlaskConical, Lightbulb, Plus, RefreshCw, Save, X } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { BrandLoader } from "@/src/components/ui/brand-loader";
import {
  analyzeResearch,
  approveStrategy,
  createCompetitor,
  createObservation,
  createReference,
  generateStrategy,
  getResearchWorkspace,
  reviewFinding,
  saveResearchBrief,
  saveStrategy,
  type MarketingStrategy,
  type ResearchBrief,
} from "@/src/features/project-research/api";

const categories = ["AUDIENCE", "COMPETITOR", "PLATFORM", "CONTENT", "HASHTAG", "KEYWORD", "CAMPAIGN", "OPPORTUNITY", "RISK"];
const emptyBrief: ResearchBrief = { businessGoal: "", researchGoal: "", targetMarket: "", geographicFocus: "", audienceNotes: "", knownCompetitors: [], platforms: [], constraints: "", additionalContext: "" };
const strategyFields: Array<[keyof MarketingStrategy, string]> = [
  ["businessObjective", "Objective"],
  ["audienceSegments", "Audience"],
  ["platformPriorities", "Platform priorities"],
  ["contentPillars", "Content pillars"],
  ["recommendedFormats", "Formats"],
  ["postingFrequency", "Posting frequency"],
  ["brandVoiceGuidance", "Brand voice"],
  ["engagementStrategy", "Engagement"],
  ["campaignIdeas", "Campaigns"],
  ["hashtagGroups", "Hashtags"],
  ["keywordGroups", "Keywords"],
  ["callsToAction", "CTAs"],
  ["kpis", "KPIs"],
  ["risks", "Risks"],
  ["assumptions", "Assumptions"],
];

export default function ProjectResearchPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const queryClient = useQueryClient();
  const key = ["project-research", projectId] as const;
  const query = useQuery({ queryKey: key, queryFn: () => getResearchWorkspace(projectId), enabled: !!projectId });
  const [brief, setBrief] = useState<ResearchBrief>(emptyBrief);
  const [competitor, setCompetitor] = useState({ name: "", websiteUrl: "", platforms: "", strengths: "", weaknesses: "", opportunities: "", notes: "" });
  const [reference, setReference] = useState({ title: "", url: "", type: "OTHER", platform: "", tags: "", description: "" });
  const [observation, setObservation] = useState({ category: "OTHER", title: "", content: "" });
  const [focus, setFocus] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>(["AUDIENCE", "COMPETITOR", "CONTENT"]);
  const [editFinding, setEditFinding] = useState<Record<string, string>>({});
  const [strategyText, setStrategyText] = useState<Record<string, string>>({});

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (query.data?.brief) setBrief({ ...emptyBrief, ...query.data.brief });
    if (query.data?.strategy) setStrategyText(strategyToText(query.data.strategy));
  }, [query.data?.brief, query.data?.strategy]);

  const readOnly = Boolean(query.data?.readOnly);
  const refresh = () => queryClient.invalidateQueries({ queryKey: key });
  const counts = useMemo(() => ({
    competitors: query.data?.competitors.length ?? 0,
    references: query.data?.references.length ?? 0,
    approved: query.data?.approvedFindings.length ?? 0,
    pending: query.data?.pendingFindings.length ?? 0,
  }), [query.data]);

  const briefSave = useMutation({ mutationFn: () => saveResearchBrief(projectId, normalizeBrief(brief)), onSuccess: () => { toast.success("Research brief saved"); void refresh(); }, onError: () => toast.error("Research brief could not be saved.") });
  const competitorCreate = useMutation({ mutationFn: () => createCompetitor(projectId, { name: competitor.name, websiteUrl: competitor.websiteUrl || undefined, platforms: split(competitor.platforms), strengths: split(competitor.strengths), weaknesses: split(competitor.weaknesses), opportunities: split(competitor.opportunities), notes: competitor.notes || undefined }), onSuccess: () => { setCompetitor({ name: "", websiteUrl: "", platforms: "", strengths: "", weaknesses: "", opportunities: "", notes: "" }); toast.success("Competitor added"); void refresh(); }, onError: () => toast.error("Competitor could not be added.") });
  const referenceCreate = useMutation({ mutationFn: () => createReference(projectId, { title: reference.title, url: reference.url || undefined, type: reference.type, platform: reference.platform || undefined, tags: split(reference.tags), description: reference.description || undefined }), onSuccess: () => { setReference({ title: "", url: "", type: "OTHER", platform: "", tags: "", description: "" }); toast.success("Reference added"); void refresh(); }, onError: (error) => toast.error(safeError(error, "Reference could not be added.")) });
  const observationCreate = useMutation({ mutationFn: () => createObservation(projectId, observation), onSuccess: () => { setObservation({ category: "OTHER", title: "", content: "" }); toast.success("Observation added"); void refresh(); }, onError: () => toast.error("Observation could not be added.") });
  const analyze = useMutation({ mutationFn: () => analyzeResearch(projectId, { categories: selectedCategories, focusInstructions: focus || undefined }), onSuccess: () => { toast.success("Findings generated for review"); void refresh(); }, onError: () => toast.error("Research analysis failed. Please retry with clearer source notes.") });
  const findingReview = useMutation({ mutationFn: ({ id, input }: { id: string; input: Record<string, unknown> }) => reviewFinding(projectId, id, input), onSuccess: () => { toast.success("Finding review saved"); void refresh(); }, onError: () => toast.error("Finding review could not be saved.") });
  const strategyGenerate = useMutation({ mutationFn: () => generateStrategy(projectId), onSuccess: (data) => { setStrategyText(strategyToText(data)); toast.success("Strategy draft generated"); void refresh(); }, onError: () => toast.error("Strategy could not be generated. Approve findings first.") });
  const strategySave = useMutation({ mutationFn: () => saveStrategy(projectId, textToStrategy(strategyText)), onSuccess: () => { toast.success("Strategy draft saved"); void refresh(); }, onError: () => toast.error("Strategy could not be saved.") });
  const strategyApprove = useMutation({ mutationFn: () => approveStrategy(projectId), onSuccess: () => { toast.success("Strategy approved and spreadsheet sync queued"); void refresh(); }, onError: () => toast.error("Strategy could not be approved.") });

  if (query.isLoading) return <BrandLoader fullScreen label="Loading research workspace..." />;
  if (query.isError || !query.data) return <main className="grid min-h-[70vh] place-items-center p-6"><Card><CardContent className="p-8 text-center"><p>Research workspace could not be loaded.</p><Button onClick={() => query.refetch()} className="mt-4"><RefreshCw />Retry</Button></CardContent></Card></main>;
  const workspace = query.data;

  return <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <Link href={`/projects/${projectId}`} className="text-sm text-muted-foreground hover:underline">{workspace.project.title}</Link>
        <h1 className="mt-1 text-3xl font-semibold">Marketing Research</h1>
        <div className="mt-2 flex flex-wrap gap-2"><Badge>{workspace.researchStatus}</Badge><Badge variant="outline">{workspace.client.name}</Badge>{workspace.readOnly && <Badge variant="secondary">Read-only</Badge>}</div>
      </div>
      <Button nativeButton={false} variant="outline" render={<Link href={`/projects/${projectId}`} />}>Project workspace</Button>
    </header>

    <section className="grid gap-3 md:grid-cols-5">
      <Stat label="Competitors" value={counts.competitors} />
      <Stat label="References" value={counts.references} />
      <Stat label="Approved" value={counts.approved} />
      <Stat label="Pending" value={counts.pending} />
      <Stat label="Strategy" value={workspace.strategy?.status ?? "Not started"} />
    </section>

    <Tabs defaultValue="overview" className="space-y-5">
      <TabsList className="flex h-auto flex-wrap justify-start"><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="competitors">Competitors</TabsTrigger><TabsTrigger value="references">References</TabsTrigger><TabsTrigger value="observations">Observations</TabsTrigger><TabsTrigger value="findings">Findings</TabsTrigger><TabsTrigger value="strategy">Strategy</TabsTrigger></TabsList>
      <TabsContent value="overview"><Card><CardHeader><CardTitle>Research brief</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-2"><BriefField label="Business goal" value={brief.businessGoal} onChange={(value) => setBrief({ ...brief, businessGoal: value })} readOnly={readOnly} /><BriefField label="Research goal" value={brief.researchGoal} onChange={(value) => setBrief({ ...brief, researchGoal: value })} readOnly={readOnly} /><BriefField label="Target market" value={brief.targetMarket} onChange={(value) => setBrief({ ...brief, targetMarket: value })} readOnly={readOnly} /><BriefField label="Geographic focus" value={brief.geographicFocus} onChange={(value) => setBrief({ ...brief, geographicFocus: value })} readOnly={readOnly} /><BriefField label="Audience notes" value={brief.audienceNotes} onChange={(value) => setBrief({ ...brief, audienceNotes: value })} readOnly={readOnly} /><BriefField label="Constraints" value={brief.constraints} onChange={(value) => setBrief({ ...brief, constraints: value })} readOnly={readOnly} /><BriefField label="Known competitors" value={(brief.knownCompetitors ?? []).join(", ")} onChange={(value) => setBrief({ ...brief, knownCompetitors: split(value) })} readOnly={readOnly} /><BriefField label="Platforms" value={(brief.platforms ?? []).join(", ")} onChange={(value) => setBrief({ ...brief, platforms: split(value) })} readOnly={readOnly} /><div className="md:col-span-2"><BriefField label="Additional context" value={brief.additionalContext} onChange={(value) => setBrief({ ...brief, additionalContext: value })} readOnly={readOnly} /></div><div className="md:col-span-2"><Button disabled={readOnly || briefSave.isPending} onClick={() => briefSave.mutate()}><Save />Save brief</Button></div></CardContent></Card></TabsContent>

      <TabsContent value="competitors"><Card><CardHeader><CardTitle>Competitors</CardTitle></CardHeader><CardContent className="space-y-4"><div className="grid gap-2 md:grid-cols-3"><Input aria-label="Competitor name" placeholder="Name" value={competitor.name} disabled={readOnly} onChange={(e) => setCompetitor({ ...competitor, name: e.target.value })} /><Input placeholder="Website" value={competitor.websiteUrl} disabled={readOnly} onChange={(e) => setCompetitor({ ...competitor, websiteUrl: e.target.value })} /><Input placeholder="Platforms" value={competitor.platforms} disabled={readOnly} onChange={(e) => setCompetitor({ ...competitor, platforms: e.target.value })} /><Input placeholder="Strengths" value={competitor.strengths} disabled={readOnly} onChange={(e) => setCompetitor({ ...competitor, strengths: e.target.value })} /><Input placeholder="Weaknesses" value={competitor.weaknesses} disabled={readOnly} onChange={(e) => setCompetitor({ ...competitor, weaknesses: e.target.value })} /><Input placeholder="Opportunities" value={competitor.opportunities} disabled={readOnly} onChange={(e) => setCompetitor({ ...competitor, opportunities: e.target.value })} /><Textarea className="md:col-span-3" placeholder="Observations" value={competitor.notes} disabled={readOnly} onChange={(e) => setCompetitor({ ...competitor, notes: e.target.value })} /></div><Button disabled={readOnly || !competitor.name.trim() || competitorCreate.isPending} onClick={() => competitorCreate.mutate()}><Plus />Add competitor</Button><div className="grid gap-3 md:grid-cols-2">{workspace.competitors.map((item) => <Card key={item.id}><CardContent className="p-4"><p className="font-medium">{item.name}</p><p className="mt-1 text-sm text-muted-foreground">{item.platforms.join(", ") || "No platforms"}</p><p className="mt-2 text-sm whitespace-pre-wrap">{item.notes}</p></CardContent></Card>)}</div></CardContent></Card></TabsContent>

      <TabsContent value="references"><Card><CardHeader><CardTitle>References</CardTitle></CardHeader><CardContent className="space-y-4"><div className="grid gap-2 md:grid-cols-3"><Input aria-label="Reference title" placeholder="Title" value={reference.title} disabled={readOnly} onChange={(e) => setReference({ ...reference, title: e.target.value })} /><Input aria-label="Reference URL" placeholder="https://..." value={reference.url} disabled={readOnly} onChange={(e) => setReference({ ...reference, url: e.target.value })} /><Input placeholder="Platform" value={reference.platform} disabled={readOnly} onChange={(e) => setReference({ ...reference, platform: e.target.value })} /><Input placeholder="Type" value={reference.type} disabled={readOnly} onChange={(e) => setReference({ ...reference, type: e.target.value })} /><Input placeholder="Tags" value={reference.tags} disabled={readOnly} onChange={(e) => setReference({ ...reference, tags: e.target.value })} /><Input placeholder="Description" value={reference.description} disabled={readOnly} onChange={(e) => setReference({ ...reference, description: e.target.value })} /></div><Button disabled={readOnly || !reference.title.trim() || referenceCreate.isPending} onClick={() => referenceCreate.mutate()}><Plus />Add reference</Button><div className="space-y-2">{workspace.references.map((item) => <div key={item.id} className="flex items-center justify-between rounded-lg border p-3 text-sm"><div><p className="font-medium">{item.title}</p><p className="text-muted-foreground">{item.type}{item.platform ? ` / ${item.platform}` : ""}</p></div>{item.url && <Button nativeButton={false} size="icon" variant="ghost" render={<a href={item.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${item.title}`} />}><ExternalLink /></Button>}</div>)}</div></CardContent></Card></TabsContent>

      <TabsContent value="observations"><Card><CardHeader><CardTitle>Observations</CardTitle></CardHeader><CardContent className="space-y-4"><div className="grid gap-2 md:grid-cols-[180px_1fr]"><Input placeholder="Category" value={observation.category} disabled={readOnly} onChange={(e) => setObservation({ ...observation, category: e.target.value })} /><Input aria-label="Observation title" placeholder="Title" value={observation.title} disabled={readOnly} onChange={(e) => setObservation({ ...observation, title: e.target.value })} /><Textarea className="md:col-span-2" aria-label="Observation content" placeholder="Quick research note" value={observation.content} disabled={readOnly} onChange={(e) => setObservation({ ...observation, content: e.target.value })} /></div><Button disabled={readOnly || !observation.title.trim() || !observation.content.trim() || observationCreate.isPending} onClick={() => observationCreate.mutate()}><Plus />Add observation</Button>{workspace.observations.map((item) => <Card key={item.id}><CardContent className="p-4"><Badge variant="outline">{item.category}</Badge><p className="mt-2 font-medium">{item.title}</p><p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{item.content}</p></CardContent></Card>)}</CardContent></Card></TabsContent>

      <TabsContent value="findings"><Card><CardHeader><CardTitle>AI analysis and review</CardTitle></CardHeader><CardContent className="space-y-5"><div className="space-y-3"><div className="flex flex-wrap gap-2">{categories.map((category) => <Button key={category} size="sm" variant={selectedCategories.includes(category) ? "default" : "outline"} disabled={readOnly} onClick={() => setSelectedCategories((current) => current.includes(category) ? current.filter((item) => item !== category) : [...current, category])}>{category}</Button>)}</div><Textarea aria-label="Analysis focus" placeholder="Focus instructions" disabled={readOnly} value={focus} onChange={(e) => setFocus(e.target.value)} /><Button disabled={readOnly || analyze.isPending} onClick={() => analyze.mutate()}><FlaskConical />{analyze.isPending ? "Generating..." : "Generate findings"}</Button></div><div className="grid gap-3 md:grid-cols-2">{workspace.pendingFindings.map((finding) => <Card key={finding.id} className="border-amber-300"><CardContent className="space-y-3 p-4"><Badge>{finding.category}</Badge><Input value={editFinding[`${finding.id}:title`] ?? finding.title} onChange={(e) => setEditFinding({ ...editFinding, [`${finding.id}:title`]: e.target.value })} disabled={readOnly} /><p className="text-sm text-muted-foreground">{finding.explanation}</p><pre className="max-h-40 overflow-auto rounded bg-muted p-2 text-xs">{JSON.stringify(finding.proposedValue, null, 2)}</pre><div className="flex flex-wrap gap-2"><Button size="sm" disabled={readOnly || findingReview.isPending} onClick={() => findingReview.mutate({ id: finding.id, input: { action: "APPROVE" } })}><Check />Approve</Button><Button size="sm" variant="outline" disabled={readOnly || findingReview.isPending} onClick={() => findingReview.mutate({ id: finding.id, input: { action: "EDIT_AND_APPROVE", title: editFinding[`${finding.id}:title`] ?? finding.title } })}>Edit and approve</Button><Button size="sm" variant="ghost" disabled={readOnly || findingReview.isPending} onClick={() => findingReview.mutate({ id: finding.id, input: { action: "REJECT" } })}><X />Reject</Button></div></CardContent></Card>)}</div><h3 className="font-medium">Approved findings</h3>{workspace.approvedFindings.map((finding) => <Card key={finding.id}><CardContent className="p-4"><Badge variant="outline">{finding.category}</Badge><p className="mt-2 font-medium">{finding.title}</p><p className="mt-1 text-sm text-muted-foreground">{finding.explanation}</p></CardContent></Card>)}<p className="text-sm text-muted-foreground">Rejected findings: {workspace.rejectedFindingCount}</p></CardContent></Card></TabsContent>

      <TabsContent value="strategy"><Card><CardHeader><CardTitle>Social-media strategy</CardTitle></CardHeader><CardContent className="space-y-4"><div className="flex flex-wrap gap-2"><Button disabled={readOnly || strategyGenerate.isPending} onClick={() => strategyGenerate.mutate()}><Lightbulb />Generate draft</Button><Button variant="outline" disabled={readOnly || strategySave.isPending} onClick={() => strategySave.mutate()}><Save />Save</Button><Button disabled={readOnly || strategyApprove.isPending || !workspace.strategy} onClick={() => strategyApprove.mutate()}><Check />Approve</Button>{workspace.strategy?.status && <Badge>{workspace.strategy.status}</Badge>}</div><div className="grid gap-3 md:grid-cols-2">{strategyFields.map(([keyName, label]) => <label key={keyName} className="space-y-1 text-sm"><span className="font-medium">{label}</span><Textarea value={strategyText[String(keyName)] ?? ""} disabled={readOnly} onChange={(e) => setStrategyText({ ...strategyText, [String(keyName)]: e.target.value })} /></label>)}</div></CardContent></Card></TabsContent>
    </Tabs>
  </main>;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></CardContent></Card>;
}

function BriefField({ label, value, onChange, readOnly }: { label: string; value?: string | null; onChange: (value: string) => void; readOnly: boolean }) {
  return <label className="space-y-1 text-sm"><span className="font-medium">{label}</span><Textarea value={value ?? ""} disabled={readOnly} onChange={(event) => onChange(event.target.value)} /></label>;
}

function split(value?: string) {
  return (value ?? "").split(",").map((item) => item.trim()).filter(Boolean);
}

function normalizeBrief(value: ResearchBrief) {
  return { ...value, knownCompetitors: value.knownCompetitors ?? [], platforms: value.platforms ?? [] };
}

function strategyToText(strategy: MarketingStrategy) {
  return Object.fromEntries(strategyFields.map(([key]) => [String(key), stringify(strategy[key])]));
}

function textToStrategy(value: Record<string, string>): MarketingStrategy {
  const strategy: MarketingStrategy = {};
  for (const [key] of strategyFields) {
    const raw = value[String(key)]?.trim();
    if (!raw) continue;
    (strategy as Record<string, unknown>)[key] = ["businessObjective", "brandVoiceGuidance", "engagementStrategy"].includes(String(key)) ? raw : split(raw);
  }
  return strategy;
}

function stringify(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map((item) => typeof item === "string" ? item : JSON.stringify(item)).join(", ");
  return JSON.stringify(value);
}

function safeError(error: unknown, fallback: string) {
  if (typeof error === "object" && error && "response" in error) {
    const data = (error as { response?: { data?: { message?: unknown } } }).response?.data;
    if (typeof data?.message === "string") return data.message;
  }
  return fallback;
}