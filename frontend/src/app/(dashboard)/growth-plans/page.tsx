"use client";

import { useQuery } from "@tanstack/react-query";
import { ExternalLink, FilterX, Microscope, RefreshCw, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BrandLoader } from "@/src/components/ui/brand-loader";
import { getClients } from "@/src/features/clients";
import { getActiveAssignees } from "@/src/features/projects";
import { getGrowthPlans, type GrowthPlanFilters, type GrowthPlanListItem, type GrowthPlanStrategyStatus } from "@/src/features/growth-plans";

const strategyOptions: Array<{ value: GrowthPlanStrategyStatus | ""; label: string }> = [
  { value: "", label: "All strategies" },
  { value: "NOT_STARTED", label: "Not started" },
  { value: "DRAFT", label: "Draft" },
  { value: "APPROVED", label: "Approved" },
];
const statusOptions = ["", "DRAFT", "ACTIVE", "COMPLETED", "ARCHIVED", "ALL"];
const typeOptions = ["", "SOCIAL_MEDIA_MANAGEMENT", "SEO_MANAGEMENT", "WEBSITE_DEVELOPMENT", "SOFTWARE_DEVELOPMENT"];

export default function GrowthPlansPage() {
  const [filters, setFilters] = useState<GrowthPlanFilters>({});
  const plansQuery = useQuery({ queryKey: ["growth-plans", filters], queryFn: () => getGrowthPlans(filters) });
  const clientsQuery = useQuery({ queryKey: ["clients", { status: "ACTIVE" }], queryFn: () => getClients({ status: "ACTIVE" }) });
  const assigneesQuery = useQuery({ queryKey: ["active-assignees"], queryFn: getActiveAssignees });
  const data = plansQuery.data;
  const hasFilters = Object.values(filters).some((value) => value !== undefined && value !== "");
  const knownProjects = useMemo(() => data?.summary.totalProjects ?? 0, [data]);

  return <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-3xl font-semibold">Growth Plans</h1>
        <p className="mt-1 text-sm text-muted-foreground">Review research-backed marketing strategies across clients and projects.</p>
      </div>
      <Button nativeButton={false} variant="outline" render={<Link href="/projects" />}><ExternalLink />Open projects</Button>
    </header>

    {plansQuery.isLoading ? <BrandLoader label="Loading growth plans..." /> : null}
    {plansQuery.isError ? <Card><CardContent className="py-10 text-center"><p>Growth plans could not be loaded.</p><Button className="mt-4" variant="outline" onClick={() => plansQuery.refetch()}><RefreshCw />Retry</Button></CardContent></Card> : null}

    {data ? <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Total projects" value={data.summary.totalProjects} onClick={() => setFilters({})} />
        <SummaryCard label="Not started" value={data.summary.notStarted} onClick={() => setFilters({ ...filters, strategyStatus: "NOT_STARTED" })} />
        <SummaryCard label="Draft strategies" value={data.summary.draft} onClick={() => setFilters({ ...filters, strategyStatus: "DRAFT" })} />
        <SummaryCard label="Approved strategies" value={data.summary.approved} onClick={() => setFilters({ ...filters, strategyStatus: "APPROVED" })} />
        <SummaryCard label="Research awaiting review" value={data.summary.pendingResearchReview} onClick={() => setFilters({ ...filters, researchStatus: "PENDING_REVIEW" })} />
      </section>

      <Card>
        <CardHeader><CardTitle className="text-base">Filters</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <label className="relative md:col-span-2 xl:col-span-2"><Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" /><Input aria-label="Search growth plans" className="pl-8" placeholder="Search client, project, objective" value={filters.search ?? ""} onChange={(event) => setFilters({ ...filters, search: event.target.value || undefined })} /></label>
          <Select label="Strategy status" value={filters.strategyStatus ?? ""} options={strategyOptions.map((item) => [item.value, item.label])} onChange={(value) => setFilters({ ...filters, strategyStatus: (value || undefined) as GrowthPlanStrategyStatus | undefined })} />
          <Select label="Client" value={filters.clientId ?? ""} options={[["", "All clients"], ...(clientsQuery.data ?? []).map((client) => [client.id, client.name] as [string, string])]} onChange={(value) => setFilters({ ...filters, clientId: value || undefined })} />
          <Select label="Project status" value={filters.projectStatus ?? ""} options={statusOptions.map((status) => [status, status || "Active + draft + completed"])} onChange={(value) => setFilters({ ...filters, projectStatus: (value || undefined) as GrowthPlanFilters["projectStatus"] })} />
          <Select label="Project type" value={filters.projectType ?? ""} options={typeOptions.map((type) => [type, label(type) || "All types"])} onChange={(value) => setFilters({ ...filters, projectType: value || undefined })} />
          <Select label="Assigned" value={filters.assignedUserId ?? ""} options={[["", "All employees"], ...(assigneesQuery.data ?? []).map((user) => [user.id, user.name] as [string, string])]} onChange={(value) => setFilters({ ...filters, assignedUserId: value || undefined })} />
          <Input aria-label="Platform filter" placeholder="Platform" value={filters.platform ?? ""} onChange={(event) => setFilters({ ...filters, platform: event.target.value || undefined })} />
          <Input aria-label="Month filter" type="number" min={1} max={12} placeholder="Month" value={filters.month ?? ""} onChange={(event) => setFilters({ ...filters, month: event.target.value ? Number(event.target.value) : undefined })} />
          <Input aria-label="Year filter" type="number" min={2000} placeholder="Year" value={filters.year ?? ""} onChange={(event) => setFilters({ ...filters, year: event.target.value ? Number(event.target.value) : undefined })} />
          <Button variant="outline" disabled={!hasFilters} onClick={() => setFilters({})}><FilterX />Clear filters</Button>
        </CardContent>
      </Card>

      {knownProjects === 0 && !hasFilters ? <Empty title="No projects yet" body="Create a project to start building research-backed growth plans." /> : null}
      {data.data.length === 0 && hasFilters ? <Empty title="No matching growth plans" body="Clear filters or broaden the search." /> : null}
      {data.data.length > 0 ? <PortfolioTable items={data.data} /> : null}
    </> : null}
  </main>;
}

function SummaryCard({ label, value, onClick }: { label: string; value: number; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"><Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></CardContent></Card></button>;
}

function PortfolioTable({ items }: { items: GrowthPlanListItem[] }) {
  return <Card><CardContent className="p-0"><div className="hidden md:block"><Table><TableHeader><TableRow><TableHead>Client</TableHead><TableHead>Project</TableHead><TableHead>Research</TableHead><TableHead>Strategy</TableHead><TableHead>Platforms</TableHead><TableHead>Last updated</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader><TableBody>{items.map((item) => <TableRow key={item.projectId} className={item.isReadOnly ? "bg-muted/30" : undefined}><TableCell>{item.client.name}</TableCell><TableCell><Link className="font-medium hover:underline" href={`/growth-plans/${item.projectId}`}>{item.projectTitle}</Link><span className="block text-xs text-muted-foreground">{label(item.projectType)} / {item.assignedUser?.name ?? "Unassigned"}</span></TableCell><TableCell><ResearchBadge item={item} /></TableCell><TableCell><StatusBadge status={item.strategyStatus} />{item.isReadOnly ? <Badge className="ml-1" variant="secondary">Read-only</Badge> : null}</TableCell><TableCell>{shortList(item.strategy?.platformPriorities)}</TableCell><TableCell>{date(item.lastUpdated)}</TableCell><TableCell><Actions item={item} /></TableCell></TableRow>)}</TableBody></Table></div><div className="grid gap-3 p-3 md:hidden">{items.map((item) => <Card key={item.projectId} size="sm" className={item.isReadOnly ? "bg-muted/30" : undefined}><CardContent className="space-y-3 p-4"><div><p className="text-xs text-muted-foreground">{item.client.name}</p><Link className="font-medium hover:underline" href={`/growth-plans/${item.projectId}`}>{item.projectTitle}</Link><p className="text-xs text-muted-foreground">{label(item.projectType)} / {item.assignedUser?.name ?? "Unassigned"}</p></div><div className="flex flex-wrap gap-1"><StatusBadge status={item.strategyStatus} /><ResearchBadge item={item} />{item.isReadOnly ? <Badge variant="secondary">Read-only</Badge> : null}</div><Actions item={item} /></CardContent></Card>)}</div></CardContent></Card>;
}

function Actions({ item }: { item: GrowthPlanListItem }) {
  return <div className="flex flex-wrap gap-1"><Button nativeButton={false} size="sm" variant="outline" render={<Link href={`/growth-plans/${item.projectId}`} />}>View</Button><Button nativeButton={false} size="sm" variant="outline" render={<Link href={`/projects/${item.projectId}`} />}>Project</Button><Button nativeButton={false} size="sm" variant="outline" render={<Link href={`/projects/${item.projectId}/research`} />}><Microscope />Research</Button>{item.strategyStatus === "DRAFT" && !item.isReadOnly ? <Button nativeButton={false} size="sm" render={<Link href={`/projects/${item.projectId}/research`} />}>Edit</Button> : null}{item.spreadsheet.worksheetUrl ? <Button nativeButton={false} size="sm" variant="ghost" render={<a href={item.spreadsheet.worksheetUrl} target="_blank" rel="noreferrer" />}><ExternalLink /></Button> : null}</div>;
}

function StatusBadge({ status }: { status: GrowthPlanStrategyStatus }) {
  const text = status === "NOT_STARTED" ? "Not started" : status === "DRAFT" ? "Draft" : "Approved";
  const variant = status === "APPROVED" ? "default" : status === "DRAFT" ? "secondary" : "outline";
  return <Badge variant={variant}>{text}</Badge>;
}
function ResearchBadge({ item }: { item: GrowthPlanListItem }) {
  return <Badge variant={item.research.pendingFindingCount ? "secondary" : "outline"}>{item.research.approvedFindingCount} approved / {item.research.pendingFindingCount} pending</Badge>;
}
function Select({ label: ariaLabel, value, options, onChange }: { label: string; value: string; options: Array<[string, string]>; onChange: (value: string) => void }) {
  return <select aria-label={ariaLabel} className="h-8 rounded-lg border border-input bg-background px-2 text-sm" value={value} onChange={(event) => onChange(event.target.value)}>{options.map(([value, label]) => <option key={value || label} value={value}>{label}</option>)}</select>;
}
function Empty({ title, body }: { title: string; body: string }) { return <Card><CardContent className="py-12 text-center"><p className="font-medium">{title}</p><p className="mt-1 text-sm text-muted-foreground">{body}</p></CardContent></Card>; }
function shortList(value?: unknown[]) { return value?.length ? value.map((item) => typeof item === "string" ? item : String(item)).slice(0, 3).join(", ") : "Not set"; }
function label(value?: string | null) { return (value ?? "").toLowerCase().replaceAll("_", " ").replace(/^\w/, (letter) => letter.toUpperCase()); }
function date(value?: string | null) { return value ? new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value)) : "Not updated"; }

