"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BrandLoader } from "@/src/components/ui/brand-loader";
import { getProject } from "@/src/features/projects/api";
import { ProjectForm } from "@/src/features/projects/components/project-form";

export default function EditProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const query = useQuery({ queryKey: ["project", projectId], queryFn: () => getProject(projectId), enabled: !!projectId });
  if (query.isLoading) return <BrandLoader fullScreen label="Loading project..." />;
  if (query.isError || !query.data) return <main className="grid min-h-[70vh] place-items-center p-6"><Card><CardContent className="p-8 text-center"><p>Project could not be loaded.</p><Button onClick={() => query.refetch()} className="mt-4"><RefreshCw />Retry</Button></CardContent></Card></main>;
  return <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
    <div>
      <Button nativeButton={false} variant="ghost" render={<Link href={`/projects/${projectId}`} />} className="-ml-3 mb-3"><ArrowLeft />Back</Button>
      <h1 className="text-3xl font-semibold">Edit project</h1>
      <p className="mt-1 text-muted-foreground">Update project details and assignment without changing history.</p>
    </div>
    <ProjectForm mode="edit" project={query.data} />
  </main>;
}
