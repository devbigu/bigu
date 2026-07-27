import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ProjectForm } from "@/src/features/projects/components/project-form";

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  const { clientId } = await searchParams;
  const backHref = clientId ? `/clients/${clientId}` : "/projects";

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div>
        <Button
          nativeButton={false}
          variant="ghost"
          render={<Link href={backHref} />}
          className="-ml-3 mb-3"
        >
          <ArrowLeft />
          Back
        </Button>
        <h1 className="text-3xl font-semibold">Create project</h1>
        <p className="mt-1 text-muted-foreground">
          Set the working context before opening the project chat.
        </p>
      </div>
      <ProjectForm initialClientId={clientId} />
    </main>
  );
}
