"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FormError } from "@/components/ui/form-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/i18n/client";

type LoginValues = { email: string; password: string };

export function LoginForm() {
  const router = useRouter();
  const t = useT();
  const searchParams = useSearchParams();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const LoginSchema = z.object({
    email: z.string().email(t("auth.emailInvalid")),
    password: z.string().min(1, t("auth.passwordRequired")),
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(LoginSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setSubmitError(body.error ?? t("auth.signInFailed"));
      return;
    }
    const target = searchParams.get("from") ?? "/";
    router.replace(target);
    router.refresh();
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("auth.signInTitle")}</CardTitle>
        <CardDescription>{t("auth.signInDescription")}</CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit} noValidate>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="email">{t("common.email")}</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              invalid={!!errors.email}
              {...register("email")}
            />
            <FormError message={errors.email?.message} />
          </div>
          <div>
            <Label htmlFor="password">{t("auth.password")}</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              invalid={!!errors.password}
              {...register("password")}
            />
            <FormError message={errors.password?.message} />
          </div>
          <FormError message={submitError ?? undefined} />
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" loading={isSubmitting} className="w-full">
            {t("auth.signInTitle")}
          </Button>
          <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
            {t("auth.noAccount")}{" "}
            <Link
              href="/register"
              className="font-medium text-zinc-900 hover:underline dark:text-zinc-100"
            >
              {t("auth.createOne")}
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
