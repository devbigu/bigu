"use client";

import { ChangeEvent, FormEvent, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { ChevronDown, ImagePlus, Monitor, Moon, SlidersHorizontal, Sun, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AccountMenu } from "@/src/components/layout/account-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { currentUserQueryKey, useCurrentUser } from "@/src/features/auth/hooks/use-current-user";
import {
  removeAvatar,
  updateAppearance,
  updateCurrentUser,
  updateThemePreference,
  uploadAvatar,
} from "@/src/features/settings/api";
import type { ThemePreference } from "@/src/features/settings/types";
import { AccentColorSettings } from "@/src/features/settings/components/accent-color-settings";
import { ThemeColorSettings } from "@/src/features/settings/components/theme-color-settings";
import { applyAccentColor, applyThemeColor, cacheAccentColor, cacheThemeColor, DEFAULT_ACCENT_COLOR } from "@/src/features/settings/lib/accent-color";

const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function message(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof error.response === "object" &&
    error.response !== null &&
    "data" in error.response &&
    typeof error.response.data === "object" &&
    error.response.data !== null &&
    "message" in error.response.data
  ) {
    const value = error.response.data.message;
    return Array.isArray(value) ? value.join(" ") : String(value);
  }
  return "Something went wrong. Please try again.";
}

export default function SettingsPage() {
  const search = useSearchParams();
  const requested = search.get("tab");
  const initialTab = ["profile", "appearance", "account"].includes(requested ?? "")
    ? requested!
    : "profile";
  const currentUser = useCurrentUser();
  const { data: user } = currentUser;
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const { setTheme } = useTheme();
  const [name, setName] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [showCustomization, setShowCustomization] = useState(false);

  const updateProfile = useMutation({
    mutationFn: updateCurrentUser,
    onSuccess: (updated) => {
      queryClient.setQueryData(currentUserQueryKey, updated);
      toast.success("Profile updated.");
    },
    onError: (error) => toast.error(message(error)),
  });
  const avatar = useMutation({
    mutationFn: uploadAvatar,
    onSuccess: (updated) => {
      queryClient.setQueryData(currentUserQueryKey, updated);
      toast.success("Profile image updated.");
    },
    onError: (error) => toast.error(message(error)),
  });
  const remove = useMutation({
    mutationFn: removeAvatar,
    onSuccess: (updated) => {
      queryClient.setQueryData(currentUserQueryKey, updated);
      toast.success("Profile image removed.");
    },
    onError: (error) => toast.error(message(error)),
  });
  const theme = useMutation({
    mutationFn: updateThemePreference,
    onSuccess: (updated) => {
      queryClient.setQueryData(currentUserQueryKey, updated);
      toast.success("Appearance saved.");
    },
    onError: () => {
      toast.error("Theme could not be saved. Your previous theme was restored.");
    },
  });

  const appearance = useMutation({
    mutationFn: updateAppearance,
    onSuccess: (updated) => {
      queryClient.setQueryData(currentUserQueryKey, updated);
      const savedColor = updated.accentColor ?? DEFAULT_ACCENT_COLOR;
      applyAccentColor(savedColor);
      cacheAccentColor(savedColor);
      applyThemeColor(updated.themeColor ?? null);
      cacheThemeColor(updated.themeColor ?? null);
      toast.success("Appearance saved.");
    },
    onError: () => {
      applyAccentColor(user?.accentColor ?? DEFAULT_ACCENT_COLOR);
      applyThemeColor(user?.themeColor ?? null);
      toast.error("Accent color could not be saved. Your previous color was restored.");
    },
  });
  if (currentUser.isPending) return <main className="p-6 text-sm text-muted-foreground">Loading settingsâ€¦</main>;
  if (currentUser.isError || !user) return <main className="p-6"><p>We couldnâ€™t load your account information.</p><Button variant="outline" onClick={() => currentUser.refetch()}>Try again</Button></main>;

  function submit(event: FormEvent) {
    event.preventDefault();
    const cleanName = (name ?? user!.name).trim();
    const cleanUsername = (username ?? user!.username).trim();
    if (!cleanName || cleanName.length > 120) {
      toast.error("Display name must be between 1 and 120 characters.");
      return;
    }
    if (!/^[a-zA-Z0-9._-]{3,40}$/.test(cleanUsername)) {
      toast.error("Username must be 3Ã¢â‚¬â€œ40 characters using letters, numbers, dots, underscores, or hyphens.");
      return;
    }
    updateProfile.mutate({ name: cleanName, username: cleanUsername });
  }

  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!allowedTypes.includes(file.type)) {
      toast.error("Choose a JPG, PNG, or WebP image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Profile image must be no larger than 5 MB.");
      return;
    }
    avatar.mutate(file);
  }

  function chooseTheme(choice: ThemePreference) {
    const previous = user!.themePreference;
    setTheme(choice.toLowerCase());
    theme.mutate(choice, { onError: () => previous && setTheme(previous.toLowerCase()) });
  }

  const created = new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(
    new Date(user.createdAt ?? 0),
  );

  return (
    <main className="mx-auto w-full max-w-4xl p-4 sm:p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold tracking-tight">Settings</h2>
        <p className="text-sm text-muted-foreground">
          Manage your profile, appearance, and account.
        </p>
      </div>
      <Tabs defaultValue={initialTab}>
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
        </TabsList>
        <TabsContent value="profile" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Profile image</CardTitle>
              <CardDescription>JPG, PNG or WebP. Maximum 5 MB.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-4">
              <Avatar className="size-20">
                {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={`${user.name} profile`} /> : null}
                <AvatarFallback className="text-xl">{initials(user.name) || <UserRound />}</AvatarFallback>
              </Avatar>
              <input ref={fileRef} className="sr-only" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onChange={selectFile} />
              <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={avatar.isPending}>
                <ImagePlus /> {avatar.isPending ? "UploadingÃ¢â‚¬Â¦" : "Upload image"}
              </Button>
              <Button variant="outline" onClick={() => remove.mutate()} disabled={!user.avatarUrl || remove.isPending}>
                <Trash2 /> {remove.isPending ? "RemovingÃ¢â‚¬Â¦" : "Remove"}
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Profile information</CardTitle>
              <CardDescription>This information identifies you throughout BigU.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="grid gap-4" onSubmit={submit}>
                <div className="grid gap-2">
                  <Label htmlFor="name">Display name</Label>
                  <Input id="name" maxLength={120} value={name ?? user.name} onChange={(event) => setName(event.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="username">Username</Label>
                  <Input id="username" maxLength={40} value={username ?? user.username} onChange={(event) => setUsername(event.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" value={user.email} readOnly disabled />
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">Role</span>
                  <Badge variant="secondary">{user.role}</Badge>
                </div>
                <Button className="w-fit" type="submit" disabled={updateProfile.isPending}>
                  {updateProfile.isPending ? "SavingÃ¢â‚¬Â¦" : "Save changes"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="appearance" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>Choose how BigU looks on this device.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-3">
              {([
                ["SYSTEM", Monitor, "System", "Follow your device setting"],
                ["LIGHT", Sun, "Light", "Always use light mode"],
                ["DARK", Moon, "Dark", "Always use dark mode"],
              ] as const).map(([value, Icon, title, description]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={user.themePreference === value}
                  disabled={theme.isPending}
                  onClick={() => chooseTheme(value)}
                  className="rounded-xl border p-4 text-left transition-colors hover:bg-accent aria-pressed:border-primary aria-pressed:ring-2 aria-pressed:ring-primary/20"
                >
                  <Icon className="mb-3 size-5" />
                  <span className="block font-medium">{title}</span>
                  <span className="text-xs text-muted-foreground">{description}</span>
                </button>
              ))}
              </div>
              <div className="mt-5 border-t pt-5">
                <Button
                  type="button"
                  variant="outline"
                  aria-expanded={showCustomization}
                  aria-controls="appearance-customization"
                  onClick={() => setShowCustomization((visible) => !visible)}
                >
                  <SlidersHorizontal />
                  {showCustomization ? "Hide customization" : "Customize"}
                  <ChevronDown className={`transition-transform ${showCustomization ? "rotate-180" : ""}`} />
                </Button>
              </div>
              {showCustomization ? (
                <div id="appearance-customization" className="mt-6 space-y-6">
                  <AccentColorSettings
                    savedColor={user.accentColor}
                    isSaving={appearance.isPending}
                    onSave={async (accentColor) => {
                      await appearance.mutateAsync({ accentColor });
                    }}
                  />
                  <ThemeColorSettings
                    savedColor={user.themeColor}
                    isSaving={appearance.isPending}
                    onSave={async (themeColor) => {
                      await appearance.mutateAsync({ themeColor });
                    }}
                  />
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="account" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Account</CardTitle><CardDescription>Protected account details are read-only.</CardDescription></CardHeader>
            <CardContent className="grid gap-4">
              <div><p className="text-xs text-muted-foreground">Email</p><p>{user.email}</p></div>
              <div><p className="text-xs text-muted-foreground">Role</p><p>{user.role}</p></div>
              <div><p className="text-xs text-muted-foreground">Member since</p><p>{created}</p></div>
              <div className="max-w-sm rounded-lg border p-2"><AccountMenu /></div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </main>
  );
}

