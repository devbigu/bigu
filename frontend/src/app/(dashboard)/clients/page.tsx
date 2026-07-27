"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Plus, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BrandLoader } from "@/src/components/ui/brand-loader";
import { archiveClient, getClients, restoreClient, type ClientListFilters, type ClientStatus } from "@/src/features/clients";

export default function ClientsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ClientStatus | "ALL">("ACTIVE");
  const filters: ClientListFilters = { search: search || undefined, status };
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["clients", filters], queryFn: () => getClients(filters) });
  const action = useMutation({
    mutationFn: ({ id, restore }: { id: string; restore: boolean }) => restore ? restoreClient(id) : archiveClient(id),
    onSuccess: async (_, variables) => { await queryClient.invalidateQueries({ queryKey: ["clients"] }); toast.success(variables.restore ? "Client restored" : "Client archived"); },
    onError: (_, variables) => toast.error(variables.restore ? "Could not restore client" : "Could not archive client"),
  });
  return <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-3xl font-semibold">Clients</h1><p className="mt-1 text-muted-foreground">Manage client profiles and brand context.</p></div><Button nativeButton={false} render={<Link href="/clients/new" />}><Plus />Create client</Button></header>
    <div className="grid gap-3 sm:grid-cols-[1fr_180px]"><div className="relative"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search clients" aria-label="Search clients" /></div><Select value={status} onValueChange={(value) => setStatus(value as ClientStatus | "ALL")}><SelectTrigger aria-label="Status filter"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ACTIVE">Active</SelectItem><SelectItem value="ARCHIVED">Archived</SelectItem><SelectItem value="ALL">All</SelectItem></SelectContent></Select></div>
    {query.isLoading && <BrandLoader fullScreen label="Loading clients..." />}
    {query.isError && <Card><CardContent className="py-10 text-center"><p>We couldn’t load clients.</p><Button className="mt-4" variant="outline" onClick={() => query.refetch()}>Try again</Button></CardContent></Card>}
    {query.data?.length === 0 && <Card><CardContent className="py-12 text-center"><p className="font-medium">{search ? "No clients match your search" : `No ${status === "ALL" ? "" : status.toLowerCase() + " "}clients yet`}</p><p className="mt-1 text-sm text-muted-foreground">{search ? "Try a different search term or status." : "Create a client to get started."}</p></CardContent></Card>}
    <section className="grid gap-4 md:grid-cols-2">{query.data?.map((client) => <Card key={client.id}><CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle><Link className="hover:underline" href={`/clients/${client.id}`}>{client.name}</Link></CardTitle><CardDescription>{client.industry || "Industry not specified"}</CardDescription></div><Badge variant={client.status === "ACTIVE" ? "default" : "secondary"}>{client.status === "ACTIVE" ? "Active" : "Archived"}</Badge></div></CardHeader><CardContent><p className="line-clamp-2 text-sm text-muted-foreground">{client.description || "No description provided."}</p><p className="mt-4 text-xs text-muted-foreground">Updated {formatDistanceToNow(new Date(client.updatedAt), { addSuffix: true })}</p></CardContent><CardFooter className="justify-between"><Button nativeButton={false} variant="outline" render={<Link href={`/clients/${client.id}`} />}>View details</Button>{client.status === "ACTIVE" ? <AlertDialog><AlertDialogTrigger render={<Button variant="destructive" />}>Archive</AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Archive {client.name}?</AlertDialogTitle><AlertDialogDescription>The client will be hidden from active lists. You can restore it later.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => action.mutate({ id: client.id, restore: false })}>Archive</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog> : <Button variant="outline" disabled={action.isPending} onClick={() => action.mutate({ id: client.id, restore: true })}>Restore</Button>}</CardFooter></Card>)}</section>
  </main>;
}


