"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, BarChart3, CalendarCheck, FileText, LogOut, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClient } from "@/src/lib/api-client";
import { logout } from "@/src/features/auth/api/auth.api";
import { currentUserQueryKey } from "@/src/features/auth/hooks/use-current-user";
import { useAuthenticatedUser } from "@/src/features/auth";

const upcomingCards = [
  { title: "Active clients", icon: Users },
  { title: "Growth plans", icon: Activity },
  { title: "Month-end tasks", icon: CalendarCheck },
  { title: "Reports", icon: FileText },
];

export function DashboardHome() {
  const user = useAuthenticatedUser();
  const router = useRouter();
  const queryClient = useQueryClient();
  const healthQuery = useQuery({
    queryKey: ["health"],
    queryFn: async () => {
      const response = await apiClient.get<{ status: string }>("/health");
      return response.data;
    },
    retry: false,
  });

  async function handleLogout() {
    await logout().catch(() => undefined);
    queryClient.removeQueries({ queryKey: currentUserQueryKey });
    router.replace("/login");
  }

  return (
    <main className="min-h-screen bg-muted/30 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-4 rounded-lg border bg-background p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="size-5" aria-hidden="true" />
              <h1 className="text-2xl font-semibold tracking-normal">BigU</h1>
            </div>
            <p className="text-muted-foreground">Welcome, {user.name}</p>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{user.role}</Badge>
              {/* <Badge variant={healthQuery.data?.status === "ok" ? "default" : "outline"}>
                API {healthQuery.data?.status === "ok" ? "connected" : "checking"}
              </Badge> */}
            </div>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut />
            Logout
          </Button>
        </header>
        

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Upcoming BigU modules">
          {upcomingCards.map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.title} className="rounded-lg">
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle>{item.title}</CardTitle>
                    <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                  </div>
                  <CardDescription>Upcoming</CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  This module is planned for a later phase.
                </CardContent>
              </Card>
            );
          })}
        </section>
      </div>
    </main>
  );
}