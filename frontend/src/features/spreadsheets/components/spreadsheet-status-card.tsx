"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Download,
  ExternalLink,
  History,
  RefreshCw,
  Sheet,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  createClientSpreadsheet,
  downloadProjectSpreadsheet,
  getClientSpreadsheet,
  getProjectSpreadsheet,
  getProjectSpreadsheetJobs,
  syncClientSpreadsheet,
  syncProjectSpreadsheet,
  type SpreadsheetState,
} from "../api";

const stateLabels: Record<SpreadsheetState, string> = {
  NOT_CONFIGURED: "Not configured",
  CREATING: "Creating",
  PENDING: "Sync pending",
  SYNCING: "Synchronizing",
  SYNCED: "Synchronized",
  FAILED: "Sync failed",
  CONFLICT: "Conflict",
};

function StateBadge({ state }: { state: SpreadsheetState }) {
  return (
    <Badge
      variant={
        state === "FAILED" || state === "CONFLICT"
          ? "destructive"
          : state === "SYNCED"
            ? "default"
            : "secondary"
      }
    >
      {stateLabels[state]}
    </Badge>
  );
}

export function ProjectSpreadsheetCard({
  projectId,
  projectTitle,
}: {
  projectId: string;
  projectTitle: string;
}) {
  const queryClient = useQueryClient();
  const [showHistory, setShowHistory] = useState(false);
  const statusKey = ["project-spreadsheet", projectId] as const;
  const status = useQuery({
    queryKey: statusKey,
    queryFn: () => getProjectSpreadsheet(projectId),
    enabled: Boolean(projectId),
    refetchInterval: 5_000,
  });
  const jobs = useQuery({
    queryKey: ["project-spreadsheet-jobs", projectId],
    queryFn: () => getProjectSpreadsheetJobs(projectId),
    enabled: showHistory,
    refetchInterval: showHistory ? 5_000 : false,
  });
  const sync = useMutation({
    mutationFn: () => syncProjectSpreadsheet(projectId),
    onSuccess: async () => {
      toast.success("Saved to project. Spreadsheet sync pending...");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: statusKey }),
        queryClient.invalidateQueries({
          queryKey: ["project-spreadsheet-jobs", projectId],
        }),
      ]);
    },
    onError: () => toast.error("Spreadsheet sync could not be queued."),
  });
  const download = useMutation({
    mutationFn: () => downloadProjectSpreadsheet(projectId),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${safeDownloadName(projectTitle)}-BigU-export.xlsx`;
      anchor.click();
      URL.revokeObjectURL(url);
    },
    onError: () => toast.error("Excel export could not be generated."),
  });

  const data = status.data;
  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sheet className="size-4" /> Spreadsheet
          </CardTitle>
          {data ? <StateBadge state={data.state} /> : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {status.isLoading ? (
          <p className="text-muted-foreground">Loading spreadsheet status...</p>
        ) : status.isError || !data ? (
          <p className="text-destructive">Spreadsheet status is unavailable.</p>
        ) : (
          <>
            <div className="grid gap-1">
              <p className="font-medium">
                {data.workbook?.name ?? "Client workbook"}
              </p>
              <p className="text-muted-foreground">
                Worksheet: {data.worksheet?.name ?? "Not created"}
              </p>
              <p className="text-muted-foreground">
                Last synchronized: {formatDate(data.worksheet?.lastSyncedAt)}
              </p>
              {!data.providerConfigured ? (
                <p className="text-amber-700 dark:text-amber-300">
                  Google Sheets credentials are not configured. PostgreSQL saves
                  and Excel exports remain available.
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {data.worksheet?.externalUrl ? (
                <Button
                  size="sm"
                  variant="outline"
                  nativeButton={false}
                  render={
                    <a
                      href={data.worksheet.externalUrl}
                      target="_blank"
                      rel="noreferrer"
                    />
                  }
                >
                  <ExternalLink /> Open worksheet
                </Button>
              ) : null}
              <Button
                size="sm"
                onClick={() => sync.mutate()}
                disabled={sync.isPending || !data.providerConfigured}
              >
                <RefreshCw className={sync.isPending ? "animate-spin" : ""} />
                {data.state === "NOT_CONFIGURED" ? "Create worksheet" : "Sync now"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowHistory((value) => !value)}
              >
                <History /> View sync history
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => download.mutate()}
                disabled={download.isPending}
              >
                <Download /> Download Excel
              </Button>
            </div>
          </>
        )}
        {showHistory ? (
          <div className="space-y-2 border-t pt-3">
            {jobs.isLoading ? (
              <p className="text-muted-foreground">Loading sync history...</p>
            ) : jobs.data?.length ? (
              jobs.data.slice(0, 8).map((job) => (
                <div
                  key={job.id}
                  className="flex flex-wrap items-start justify-between gap-2 rounded-md border p-2"
                >
                  <div>
                    <p className="font-medium">
                      {job.operation.replaceAll("_", " ").toLowerCase()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(job.requestedAt)} / attempt {job.attempts}
                    </p>
                    {job.errorMessage ? (
                      <p className="mt-1 text-xs text-destructive">
                        {job.errorMessage}
                      </p>
                    ) : null}
                  </div>
                  <Badge
                    variant={job.status === "FAILED" ? "destructive" : "secondary"}
                  >
                    {job.status.toLowerCase()}
                  </Badge>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground">No sync jobs yet.</p>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function ClientSpreadsheetCard({ clientId }: { clientId: string }) {
  const queryClient = useQueryClient();
  const statusKey = ["client-spreadsheet", clientId] as const;
  const status = useQuery({
    queryKey: statusKey,
    queryFn: () => getClientSpreadsheet(clientId),
    enabled: Boolean(clientId),
    refetchInterval: 5_000,
  });
  const sync = useMutation({
    mutationFn: () =>
      status.data?.workbook
        ? syncClientSpreadsheet(clientId)
        : createClientSpreadsheet(clientId),
    onSuccess: async () => {
      toast.success("Client workbook sync pending...");
      await queryClient.invalidateQueries({ queryKey: statusKey });
    },
    onError: () => toast.error("Client workbook sync could not be queued."),
  });
  const data = status.data;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sheet className="size-4" /> Client workbook
          </CardTitle>
          {data ? <StateBadge state={data.state} /> : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {status.isLoading ? (
          <p className="text-muted-foreground">Loading workbook status...</p>
        ) : status.isError || !data ? (
          <p className="text-destructive">Workbook status is unavailable.</p>
        ) : (
          <>
            <div>
              <p className="font-medium">
                {data.workbook?.name ?? "No client workbook yet"}
              </p>
              <p className="text-muted-foreground">
                {data.workbook?.worksheetCount ?? 0} project worksheets
              </p>
              <p className="text-muted-foreground">
                Last synchronized: {formatDate(data.workbook?.lastSyncedAt)}
              </p>
              {!data.providerConfigured ? (
                <p className="mt-2 text-amber-700 dark:text-amber-300">
                  Google Sheets credentials are not configured.
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {data.workbook?.externalUrl ? (
                <Button
                  size="sm"
                  variant="outline"
                  nativeButton={false}
                  render={
                    <a
                      href={data.workbook.externalUrl}
                      target="_blank"
                      rel="noreferrer"
                    />
                  }
                >
                  <ExternalLink /> Open workbook
                </Button>
              ) : null}
              <Button
                size="sm"
                onClick={() => sync.mutate()}
                disabled={sync.isPending || !data.providerConfigured}
              >
                <RefreshCw className={sync.isPending ? "animate-spin" : ""} />
                {data.workbook ? "Sync workbook" : "Create workbook"}
              </Button>
            </div>
            {data.projects.length > 0 ? (
              <div className="space-y-2 border-t pt-3">
                {data.projects.map((project) => (
                  <div
                    key={project.projectId}
                    className="flex flex-wrap items-center justify-between gap-2"
                  >
                    <div>
                      <p className="font-medium">{project.projectName}</p>
                      <p className="text-xs text-muted-foreground">
                        {project.worksheetName} worksheet
                      </p>
                    </div>
                    {project.worksheetUrl ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        nativeButton={false}
                        render={
                          <a
                            href={project.worksheetUrl}
                            target="_blank"
                            rel="noreferrer"
                          />
                        }
                      >
                        Open <ExternalLink />
                      </Button>
                    ) : (
                      <Badge variant="secondary">
                        {project.worksheetStatus.toLowerCase()}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function formatDate(value?: string | null) {
  if (!value) return "Not synchronized yet";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function safeDownloadName(value: string) {
  return (
    value
      .replace(/[^a-zA-Z0-9 _.-]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 80) || "project"
  );
}
