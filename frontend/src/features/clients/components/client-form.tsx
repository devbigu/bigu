"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient, updateClient } from "../api";
import { clientSchema, type ClientFormValues } from "../schemas";

type ClientFormProps = { mode: "create" | "edit"; initialValues?: ClientFormValues; clientId?: string };
const emptyValues: ClientFormValues = { name: "", industry: "", description: "", targetAudience: "", brandVoice: "", websiteUrl: "", instagramUrl: "", facebookUrl: "", businessObjectives: "" };
const fields = [
  ["name", "Client name", false], ["industry", "Industry", false],
  ["description", "Description", true], ["targetAudience", "Target audience", true],
  ["brandVoice", "Brand voice", true], ["websiteUrl", "Website URL", false],
  ["instagramUrl", "Instagram URL", false], ["facebookUrl", "Facebook URL", false],
  ["businessObjectives", "Business objectives", true],
] as const;

function errorMessage(error: unknown) {
  if (!axios.isAxiosError(error)) return "Something went wrong. Please try again.";
  const data = error.response?.data as { message?: string | string[] } | undefined;
  return Array.isArray(data?.message) ? data.message.join(" ") : data?.message || (error.response ? "The request could not be completed." : "Could not connect to the server.");
}

export function ClientForm({ mode, initialValues, clientId }: ClientFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const form = useForm<ClientFormValues>({ resolver: zodResolver(clientSchema), defaultValues: initialValues ?? emptyValues });
  const mutation = useMutation({
    mutationFn: (values: ClientFormValues) => mode === "create" ? createClient(values) : updateClient(clientId!, values),
    onSuccess: async (client) => {
      await queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success(mode === "create" ? "Client created" : "Client updated");
      if (mode === "create") router.push(`/clients/${client.id}`);
      else { await queryClient.invalidateQueries({ queryKey: ["clients", client.id] }); router.refresh(); }
    },
  });

  return (
    <Card><CardContent className="pt-6">
      <form className="grid gap-5" onSubmit={form.handleSubmit((values) => mutation.mutate(values))} noValidate>
        <div className="grid gap-5 md:grid-cols-2">
          {fields.map(([name, label, multiline]) => {
            const error = form.formState.errors[name]?.message;
            const wide = multiline;
            return <div key={name} className={`grid gap-2 ${wide ? "md:col-span-2" : ""}`}>
              <Label htmlFor={name}>{label}{name === "name" ? " *" : ""}</Label>
              {multiline ? <Textarea id={name} rows={4} aria-invalid={!!error} {...form.register(name)} /> : <Input id={name} type={name.endsWith("Url") ? "url" : "text"} aria-invalid={!!error} {...form.register(name)} />}
              {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
            </div>;
          })}
        </div>
        {mutation.isError && <p className="text-sm text-destructive" role="alert">{errorMessage(mutation.error)}</p>}
        <div className="flex justify-end"><Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Saving…" : mode === "create" ? "Create client" : "Save changes"}</Button></div>
      </form>
    </CardContent></Card>
  );
}


