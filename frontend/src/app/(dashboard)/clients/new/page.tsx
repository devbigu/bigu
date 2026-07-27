import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ClientForm } from "@/src/features/clients";

export default function NewClientPage() {
  return <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 sm:p-6 lg:p-8"><div><Button nativeButton={false} variant="ghost" render={<Link href="/clients" />} className="-ml-3 mb-3"><ArrowLeft />Back to clients</Button><h1 className="text-3xl font-semibold">Create client</h1><p className="mt-1 text-muted-foreground">Add the business context your team needs to work effectively.</p></div><ClientForm mode="create" /></main>;
}


