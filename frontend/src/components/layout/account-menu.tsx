"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Palette, Settings, UserRound } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { logout } from "@/src/features/auth/api/auth.api";
import { currentUserQueryKey, useCurrentUser } from "@/src/features/auth/hooks/use-current-user";

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function AccountMenu({ onNavigate }: { onNavigate?: () => void }) {
  const currentUser = useCurrentUser();
  const { data: user } = currentUser;
  const queryClient = useQueryClient();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  if (currentUser.isPending) return <div aria-label="Loading account" className="h-12 animate-pulse rounded-lg bg-sidebar-accent" />;
  if (currentUser.isError || !user) return <button type="button" className="w-full rounded-lg p-2 text-left text-xs text-muted-foreground" onClick={() => currentUser.refetch()}>Account unavailable. Try again</button>;

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
      queryClient.removeQueries({ queryKey: currentUserQueryKey });
      queryClient.clear();
      router.replace("/login");
      router.refresh();
    } catch {
      toast.error("We couldn’t log you out. Please try again.");
      setLoggingOut(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Open account menu for ${user.name}`}
          className="flex w-full items-center gap-2 rounded-lg p-2 text-left outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring group-data-[collapsible=icon]:size-10 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-1"
        >
          <Avatar>
            {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
            <AvatarFallback>{initials(user.name) || <UserRound />}</AvatarFallback>
          </Avatar>
          <span className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <span className="block truncate text-sm font-medium">{user.name}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {user.email}
            </span>
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="w-64">
          <DropdownMenuLabel>
            <span className="block truncate text-sm text-foreground">{user.name}</span>
            <span className="block truncate font-normal">{user.email}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem render={<Link href="/settings?tab=profile" onClick={onNavigate} />}>
            <UserRound /> Profile
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/settings?tab=appearance" onClick={onNavigate} />}>
            <Palette /> Appearance
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/settings?tab=account" onClick={onNavigate} />}>
            <Settings /> Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setConfirming(true)}>
            <LogOut /> Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Log out of BigU?</AlertDialogTitle>
            <AlertDialogDescription>
              You will need to sign in again to access your workspace.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loggingOut}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={loggingOut}
              variant="destructive"
              onClick={handleLogout}
            >
              {loggingOut ? "Logging out…" : "Log out"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
