"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  ArrowUp,
  Edit,
  FileText,
  Microscope,
  Paperclip,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { type KeyboardEvent, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { BrandLoader } from "@/src/components/ui/brand-loader";
import {
  getProjectWorkspace,
  reviewProjectChange,
  reviewProjectFile,
  streamProjectMessage,
  uploadProjectFile,
  type ProjectChangeRequest,
  type ProjectWorkspace,
} from "@/src/features/project-workspace/api";
import {
  archiveProject,
  restoreProject,
  updateProjectStatus,
} from "@/src/features/projects/api";
import type { ProjectStatus } from "@/src/features/projects/types";
import { ProjectSpreadsheetCard } from "@/src/features/spreadsheets/components/spreadsheet-status-card";
import { getResearchWorkspace } from "@/src/features/project-research/api";
import { MessageContent } from "@/src/features/project-workspace/components/message-content";

const statusLabels: Record<ProjectStatus, string> = {
  DRAFT: "Draft",
  ACTIVE: "Active",
  COMPLETED: "Completed",
  ARCHIVED: "Archived",
};
const typeLabels: Record<string, string> = {
  SOCIAL_MEDIA_MANAGEMENT: "Social media management",
  SEO_MANAGEMENT: "SEO management",
  WEBSITE_DEVELOPMENT: "Website development",
  SOFTWARE_DEVELOPMENT: "Software development",
};

const labels: Record<string, string> = {
  name: "Name",
  industry: "Industry",
  description: "Description",
  targetAudience: "Target audience",
  brandVoice: "Brand voice",
  websiteUrl: "Website",
  instagramUrl: "Instagram",
  facebookUrl: "Facebook",
  businessObjectives: "Business objectives",
};

function period(month: number | null, year: number | null) {
  if (!month || !year) return null;
  return new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1));
}

export default function ProjectWorkspacePage() {
  const { projectId } = useParams<{ projectId: string }>();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [activeStream, setActiveStream] = useState<{
    messageId: string | null;
    content: string;
    status: "THINKING" | "STREAMING" | "FAILED" | "CANCELLED";
  } | null>(null);
  const [text, setText] = useState("");
  const [edits, setEdits] = useState<Record<string, string>>({});
  const workspaceKey = ["project-workspace", projectId] as const;
  const query = useQuery({
    queryKey: workspaceKey,
    queryFn: () => getProjectWorkspace(projectId),
    enabled: !!projectId,
  });
  const researchQuery = useQuery({
    queryKey: ["project-research", projectId],
    queryFn: () => getResearchWorkspace(projectId),
    enabled: !!projectId,
  });
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: workspaceKey }),
      queryClient.invalidateQueries({ queryKey: ["project", projectId] }),
      queryClient.invalidateQueries({ queryKey: ["projects"] }),
    ]);
  };
  const send = useMutation({
    mutationFn: async (content: string) => {
      const controller = new AbortController();
      abortRef.current = controller;
      setActiveStream({ messageId: null, content: "", status: "THINKING" });
      await streamProjectMessage({
        projectId,
        content,
        signal: controller.signal,
        onEvent(event) {
          if (event.type === "message.created") {
            queryClient.setQueryData<ProjectWorkspace>(
              workspaceKey,
              (current) =>
                current
                  ? {
                      ...current,
                      messages: [...current.messages, event.message],
                    }
                  : current,
            );
          } else if (event.type === "assistant.started") {
            setActiveStream({
              messageId: event.messageId,
              content: "",
              status: "THINKING",
            });
          } else if (event.type === "assistant.delta") {
            setActiveStream((current) => ({
              messageId: event.messageId,
              content: `${current?.content ?? ""}${event.delta}`,
              status: "STREAMING",
            }));
          } else if (event.type === "proposal.created") {
            queryClient.setQueryData<ProjectWorkspace>(
              workspaceKey,
              (current) =>
                current
                  ? {
                      ...current,
                      changeRequests: [
                        ...current.changeRequests,
                        event.proposal,
                      ],
                    }
                  : current,
            );
          } else if (event.type === "assistant.completed") {
            queryClient.setQueryData<ProjectWorkspace>(
              workspaceKey,
              (current) =>
                current
                  ? {
                      ...current,
                      messages: [
                        ...current.messages.filter(
                          (message) => message.id !== event.message.id,
                        ),
                        event.message,
                      ],
                    }
                  : current,
            );
            setActiveStream(null);
          } else {
            setActiveStream((current) => ({
              messageId: event.messageId,
              content: event.partialContent ?? current?.content ?? "",
              status:
                event.type === "assistant.cancelled" ? "CANCELLED" : "FAILED",
            }));
          }
        },
      });
    },
    onMutate: () => setText(""),
    onSuccess: refresh,
    onError: (error) => {
      const cancelled =
        error instanceof DOMException && error.name === "AbortError";
      setActiveStream((current) => ({
        messageId: current?.messageId ?? null,
        content: current?.content ?? "",
        status: cancelled ? "CANCELLED" : "FAILED",
      }));
      if (!cancelled) {
        toast.error("BigU could not complete the response. Please try again.");
      }
      void refresh();
    },
    onSettled: () => {
      abortRef.current = null;
    },
  });
  const review = useMutation({
    mutationFn: ({
      request,
      input,
    }: {
      request: ProjectChangeRequest;
      input: {
        action: string;
        proposedValue?: string;
        syncSpreadsheet?: boolean;
      };
    }) => reviewProjectChange(projectId, request.id, input),
    onSuccess: async (_data, variables) => {
      toast.success(
        variables.input.syncSpreadsheet === false
          ? "Saved to project"
          : "Saved to project. Spreadsheet sync pending...",
      );
      await Promise.all([
        refresh(),
        queryClient.invalidateQueries({
          queryKey: ["project-spreadsheet", projectId],
        }),
      ]);
    },
    onError: () => toast.error("The update could not be reviewed."),
  });
  const lifecycle = useMutation({
    mutationFn: ({
      action,
      status,
    }: {
      action: "archive" | "restore" | "status";
      status?: ProjectStatus;
    }) => {
      if (action === "archive") return archiveProject(projectId);
      if (action === "restore") return restoreProject(projectId);
      if (!status) throw new Error("Status is required.");
      return updateProjectStatus(projectId, status);
    },
    onSuccess: async (_project, variables) => {
      toast.success(
        variables.action === "archive"
          ? "Project archived"
          : variables.action === "restore"
            ? "Project restored"
            : "Project status updated",
      );
      await refresh();
    },
    onError: () => toast.error("Project status could not be updated."),
  });
  const upload = useMutation({
    mutationFn: (file: File) => uploadProjectFile(projectId, file),
    onSuccess: async () => {
      toast.success("File uploaded for review");
      await refresh();
    },
    onError: () => toast.error("File upload failed."),
  });
  const fileReview = useMutation({
    mutationFn: ({
      id,
      action,
    }: {
      id: string;
      action: "approve" | "reject";
    }) => reviewProjectFile(projectId, id, action),
    onSuccess: refresh,
    onError: () => toast.error("The file review could not be saved."),
  });
  const submit = () => {
    const content = text.trim();
    if (content && !send.isPending) send.mutate(content);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  if (query.isLoading)
    return <BrandLoader fullScreen label="Loading project workspace..." />;
  if (query.isError || !query.data) {
    return (
      <main className="grid min-h-[70vh] place-items-center p-6">
        <Card>
          <CardContent className="p-8 text-center">
            <p>Project workspace could not be loaded.</p>
            <Button onClick={() => query.refetch()} className="mt-4">
              <RefreshCw />
              Retry
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const workspace = query.data;
  const project = workspace.project;
  const projectPeriod = period(project.month, project.year);
  const archived =
    project.status === "ARCHIVED" || workspace.client.status === "ARCHIVED";
  const nextStatus: ProjectStatus | null =
    project.status === "DRAFT"
      ? "ACTIVE"
      : project.status === "ACTIVE"
        ? "COMPLETED"
        : project.status === "COMPLETED"
          ? "ACTIVE"
          : null;

  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl flex-col">
      <header className="sticky top-0 z-10 border-b bg-background/90 px-4 py-3 backdrop-blur sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            className="text-sm text-muted-foreground hover:text-foreground hover:underline"
            href={`/clients/${workspace.client.id}`}
          >
            {workspace.client.name}
          </Link>
          <span className="text-muted-foreground">/</span>
          <h1 className="font-semibold">{project.title}</h1>
          <Badge
            variant={project.status === "ACTIVE" ? "default" : "secondary"}
          >
            {statusLabels[project.status as ProjectStatus]}
          </Badge>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>
            {project.projectType
              ? (typeLabels[project.projectType] ?? project.projectType)
              : "Project type not set"}
          </span>
          <span>/</span>
          <span>{projectPeriod ?? "Period not set"}</span>
          <span>/</span>
          <span>{project.assignedUser?.name ?? "Unassigned"}</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            nativeButton={false}
            size="sm"
            variant="outline"
            disabled={archived}
            render={<Link href={`/projects/${projectId}/edit`} />}
          >
            <Edit />
            Edit
          </Button>
          <Button
            nativeButton={false}
            size="sm"
            variant="outline"
            render={<Link href={`/projects/${projectId}/research`} />}
          >
            <Microscope />
            Research
          </Button>          <Button
            nativeButton={false}
            size="sm"
            variant="outline"
            render={<Link href={`/growth-plans/${projectId}`} />}
          >
            Growth plan
          </Button>
          {nextStatus && (
            <Button
              size="sm"
              variant="outline"
              disabled={lifecycle.isPending || archived}
              onClick={() =>
                lifecycle.mutate({ action: "status", status: nextStatus })
              }
            >
              {nextStatus === "COMPLETED" ? "Mark completed" : "Mark active"}
            </Button>
          )}
          {archived ? (
            <Button
              size="sm"
              variant="outline"
              disabled={lifecycle.isPending}
              onClick={() => lifecycle.mutate({ action: "restore" })}
            >
              <RotateCcw />
              Restore
            </Button>
          ) : (
            <AlertDialog>
              <AlertDialogTrigger
                render={
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={lifecycle.isPending}
                  />
                }
              >
                <Archive />
                Archive
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Archive {project.title}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Messages, files, instructions, SOP state, worksheet mapping,
                    and sync history will stay attached.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => lifecycle.mutate({ action: "archive" })}
                  >
                    Archive
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </header>

      <section className="flex-1 space-y-5 px-3 py-6 sm:px-6 mb-40">
        {archived && (
          <Card className="max-w-3xl border-amber-300/70 bg-amber-50/60 text-amber-950">
            <CardContent className="p-4 text-sm">
              This project is archived and read-only. Historical messages,
              files, spreadsheet status, and sync history remain visible.
            </CardContent>
          </Card>
        )}
        <Card className="max-w-3xl">
          <CardHeader>
            <CardTitle className="text-base">Project details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
            <p>
              <span className="text-muted-foreground">Client:</span>{" "}
              {workspace.client.name}
            </p>
            <p>
              <span className="text-muted-foreground">Assignee:</span>{" "}
              {project.assignedUser?.name ?? "Unassigned"}
            </p>
            <p>
              <span className="text-muted-foreground">Type:</span>{" "}
              {project.projectType
                ? (typeLabels[project.projectType] ?? project.projectType)
                : "Not set"}
            </p>
            <p>
              <span className="text-muted-foreground">Dates:</span>{" "}
              {[project.startDate?.slice(0, 10), project.endDate?.slice(0, 10)]
                .filter(Boolean)
                .join(" to ") || "Not set"}
            </p>
            <p>
              <span className="text-muted-foreground">Month/year:</span>{" "}
              {projectPeriod ?? "Not set"}
            </p>
            <p>
              <span className="text-muted-foreground">Content target:</span>{" "}
              {project.contentTarget ?? "Not set"}
            </p>
            {project.platforms.length > 0 && (
              <p className="sm:col-span-2">
                <span className="text-muted-foreground">Platforms:</span>{" "}
                {project.platforms.join(", ")}
              </p>
            )}
          </CardContent>
        </Card>
        <ProjectSpreadsheetCard
          projectId={projectId}
          projectTitle={project.title}
        />
        <Card className="max-w-3xl">
          <CardHeader>
            <CardTitle className="text-base">Marketing research</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">
                {researchQuery.data?.researchStatus ?? "Not started"}
              </p>
              <p className="text-muted-foreground">
                {researchQuery.data
                  ? `${researchQuery.data.approvedFindings.length} approved findings / ${researchQuery.data.pendingFindings.length} awaiting review`
                  : "Open the research workspace to start a brief."}
              </p>
            </div>
            <Button
              nativeButton={false}
              variant="outline"
              render={<Link href={`/projects/${projectId}/research`} />}
            >
              <Microscope />
              Open research
            </Button>
          </CardContent>
        </Card>

        {(project.growthObjective ||
          project.platforms.length > 0 ||
          workspace.instructions.length > 0) && (
          <Card className="max-w-3xl bg-muted/20">
            <CardHeader>
              <CardTitle className="text-base">Project context</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {project.growthObjective && (
                <div>
                  <p className="font-medium">Growth objective</p>
                  <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                    {project.growthObjective}
                  </p>
                </div>
              )}
              {project.platforms.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {project.platforms.map((platform) => (
                    <Badge key={platform} variant="outline">
                      {platform}
                    </Badge>
                  ))}
                </div>
              )}
              {workspace.instructions
                .filter((item) => item.status === "ACTIVE")
                .map((item) => (
                  <div key={item.id}>
                    <p className="font-medium">{item.title}</p>
                    <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                      {item.content}
                    </p>
                  </div>
                ))}
            </CardContent>
          </Card>
        )}

        {workspace.messages.length === 0 && (
          <div className="mx-auto max-w-lg py-16 text-center">
            <h2 className="text-2xl font-semibold">
              Start working on {project.title}
            </h2>
            <p className="mt-2 text-muted-foreground">
              Ask a question, add project information, or attach context for
              BigU.
            </p>
          </div>
        )}
        {workspace.messages.map((message) => (
          <div
            key={message.id}
            className={
              message.senderType === "USER"
                ? "ml-auto max-w-[85%] rounded-3xl bg-muted px-4 py-3"
                : "max-w-3xl"
            }
          >
            <MessageContent content={message.content} />
            {message.status === "FAILED" && (
              <Badge variant="destructive" className="mt-2">
                Failed - retry your message
              </Badge>
            )}
          </div>
        ))}
        {activeStream && (
          <div className="max-w-3xl">
            <MessageContent
              content={activeStream.content}
              fallback="BigU is thinking..."
            />
            {(activeStream.status === "FAILED" ||
              activeStream.status === "CANCELLED") && (
              <Badge variant="destructive" className="mt-2">
                {activeStream.status === "CANCELLED"
                  ? "Stopped"
                  : "Response interrupted"}
              </Badge>
            )}
          </div>
        )}
        {send.isPending && !activeStream && (
          <div
            className="max-w-3xl text-sm text-muted-foreground"
            role="status"
          >
            BigU is responding&
          </div>
        )}

        {workspace.changeRequests.map((request) => (
          <Card key={request.id} className="max-w-3xl border-amber-300/60">
            <CardHeader>
              <CardTitle className="text-base">
                Record project information /{" "}
                {labels[request.fieldName] || request.fieldName}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <span className="font-medium">Current:</span>
                <p className="text-muted-foreground">
                  {request.oldValue || "Not provided"}
                </p>
              </div>
              <div>
                <span className="font-medium">Proposed:</span>
                {request.status === "PENDING" ? (
                  <Input
                    value={edits[request.id] ?? request.proposedValue}
                    onChange={(event) =>
                      setEdits((current) => ({
                        ...current,
                        [request.id]: event.target.value,
                      }))
                    }
                  />
                ) : (
                  <p>{request.proposedValue}</p>
                )}
              </div>
              {request.explanation && (
                <p className="text-muted-foreground">{request.explanation}</p>
              )}
              {request.status === "PENDING" ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={review.isPending}
                    onClick={() =>
                      review.mutate({
                        request,
                        input: { action: "APPROVE", syncSpreadsheet: true },
                      })
                    }
                  >
                    Confirm and sync
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={review.isPending}
                    onClick={() =>
                      review.mutate({
                        request,
                        input: { action: "APPROVE", syncSpreadsheet: false },
                      })
                    }
                  >
                    Save without spreadsheet sync
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={review.isPending}
                    onClick={() =>
                      review.mutate({
                        request,
                        input: {
                          action: "EDIT_AND_APPROVE",
                          proposedValue:
                            edits[request.id] ?? request.proposedValue,
                          syncSpreadsheet: true,
                        },
                      })
                    }
                  >
                    Save edited and sync
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={review.isPending}
                    onClick={() =>
                      review.mutate({ request, input: { action: "REJECT" } })
                    }
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Badge variant="secondary">
                  {request.status.toLowerCase()}
                </Badge>
              )}
            </CardContent>
          </Card>
        ))}

        {workspace.files.length > 0 && (
          <Card className="max-w-3xl">
            <CardHeader>
              <CardTitle className="text-base">Project files</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {workspace.files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {file.originalName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {file.processingStatus
                          .toLowerCase()
                          .replaceAll("_", " ")}
                      </p>
                    </div>
                  </div>
                  {file.processingStatus === "READY_FOR_REVIEW" &&
                    !archived && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() =>
                            fileReview.mutate({
                              id: file.id,
                              action: "approve",
                            })
                          }
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            fileReview.mutate({ id: file.id, action: "reject" })
                          }
                        >
                          Reject
                        </Button>
                      </div>
                    )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </section>

      <footer className="fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-background via-background to-transparent p-3 pt-8 sm:p-6 md:left-(--sidebar-width)">
        <div className="mx-auto flex w-full max-w-3xl items-end gap-1 rounded-3xl border bg-background p-2 shadow-lg sm:gap-2">
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept=".pdf,.docx,.txt,.csv,.jpg,.jpeg,.png,.webp,.mp3,.m4a,.wav,.ogg,.webm,.mp4"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) upload.mutate(file);
              event.target.value = "";
            }}
          />
          <Button
            className="my-auto shrink-0"
            variant="ghost"
            size="icon"
            aria-label="Attach file"
            disabled={upload.isPending || archived}
            onClick={() => fileRef.current?.click()}
          >
            <Paperclip />
          </Button>
          <Textarea
            aria-label="Message"
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={onKeyDown}
            disabled={archived}
            placeholder={
              archived
                ? "This project is archived"
                : "Ask about this project or add project information..."
            }
            className="min-w-0 flex-1 max-h-48 min-h-11 resize-none border-0 shadow-none focus-visible:ring-0"
          />
          {send.isPending ? (
            <Button
              size="icon"
              variant="outline"
              className="shrink-0 rounded-full"
              aria-label="Stop generation"
              onClick={() => abortRef.current?.abort()}
            >
              <span className="size-3 rounded-sm bg-current" />
            </Button>
          ) : (
            <Button
              size="icon"
              className="my-auto shrink-0 rounded-full"
              aria-label="Send message"
              disabled={!text.trim() || send.isPending || archived}
              onClick={submit}
            >
              <ArrowUp />
            </Button>
          )}
        </div>
      </footer>
    </main>
  );
}



