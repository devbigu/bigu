"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { Eye, EyeOff, Loader2, LogIn } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login } from "../api/auth.api";
import { currentUserQueryKey } from "../hooks/use-current-user";
import { loginSchema, type LoginFormValues } from "../schemas/auth.schema";

function getErrorMessage(error: unknown) {
  if (error instanceof AxiosError) {
    const message = (error.response?.data as { message?: string })?.message;
    return message || "Unable to sign in. Check your credentials and try again.";
  }

  return "Unable to sign in. Check your credentials and try again.";
}

export function LoginForm({ adminEntry = false }: { adminEntry?: boolean }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showPassword, setShowPassword] = useState(false);
  const [backendError, setBackendError] = useState<string | null>(null);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identifier: "",
      password: "",
    },
  });

  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: (user) => {
      queryClient.setQueryData(currentUserQueryKey, user);
      if (user.mustChangePassword) router.push("/change-password");
      else if (adminEntry && user.role !== "ADMIN") router.push("/dashboard");
      else router.push(user.role === "ADMIN" ? "/admin" : "/dashboard");
    },
    onError: (error) => {
      setBackendError(getErrorMessage(error));
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    setBackendError(null);
    loginMutation.mutate(values);
  });

  return (
    <Card className="w-full max-w-md rounded-lg shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl">{adminEntry ? "Administrator sign in" : "Sign in to BigU"}</CardTitle>
        <CardDescription>{adminEntry ? "Use your company administrator account." : "Use your internal account to continue."}</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-5" onSubmit={onSubmit} noValidate>
          <div className="space-y-2">
            <Label htmlFor="identifier">Username or email</Label>
            <Input
              id="identifier"
              type="text"
              autoComplete="username"
              aria-invalid={!!form.formState.errors.identifier}
              {...form.register("identifier")}
            />
            {form.formState.errors.identifier ? (
              <p className="text-sm text-destructive">{form.formState.errors.identifier.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="flex rounded-lg border border-input bg-background focus-within:ring-3 focus-within:ring-ring/50">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                className="border-0 focus-visible:ring-0"
                aria-invalid={!!form.formState.errors.password}
                {...form.register("password")}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((value) => !value)}
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </Button>
            </div>
            {form.formState.errors.password ? (
              <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
            ) : null}
          </div>

          {backendError ? <p role="alert" className="text-sm text-destructive">{backendError}</p> : null}

          <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
            {loginMutation.isPending ? <Loader2 className="animate-spin" /> : <LogIn />}
            {loginMutation.isPending ? "Signing in" : "Sign in"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}


