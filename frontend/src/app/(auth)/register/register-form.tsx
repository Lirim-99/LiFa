"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

type RegisterValues = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
};

export function RegisterForm() {
  const router = useRouter();
  const t = useT();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const RegisterSchema = z.object({
    firstName: z.string().min(1, t("common.required")).max(100),
    lastName: z.string().min(1, t("common.required")).max(100),
    email: z.string().email(t("auth.emailInvalid")),
    // 8/72 mirrors the backend RegisterDto.
    password: z.string().min(8, t("auth.passwordMin")).max(72),
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({ resolver: zodResolver(RegisterSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setSubmitError(body.error ?? t("auth.registrationFailed"));
      return;
    }
    router.replace("/");
    router.refresh();
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("auth.createAccountTitle")}</CardTitle>
        <CardDescription>{t("auth.createAccountDescription")}</CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit} noValidate>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="firstName">{t("auth.firstName")}</Label>
              <Input
                id="firstName"
                autoComplete="given-name"
                invalid={!!errors.firstName}
                {...register("firstName")}
              />
              <FormError message={errors.firstName?.message} />
            </div>
            <div>
              <Label htmlFor="lastName">{t("auth.lastName")}</Label>
              <Input
                id="lastName"
                autoComplete="family-name"
                invalid={!!errors.lastName}
                {...register("lastName")}
              />
              <FormError message={errors.lastName?.message} />
            </div>
          </div>
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
              autoComplete="new-password"
              invalid={!!errors.password}
              {...register("password")}
            />
            <FormError message={errors.password?.message} />
          </div>
          <FormError message={submitError ?? undefined} />
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" loading={isSubmitting} className="w-full">
            {t("auth.createAccountButton")}
          </Button>
          <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
            {t("auth.alreadyHaveOne")}{" "}
            <Link
              href="/login"
              className="font-medium text-zinc-900 hover:underline dark:text-zinc-100"
            >
              {t("auth.signInTitle")}
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
