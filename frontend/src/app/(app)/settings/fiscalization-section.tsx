"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
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
import { Select } from "@/components/ui/select";
import { useT } from "@/i18n/client";
import { translateOptions } from "@/i18n/translate";
import { useFiscalConfig, useUpsertFiscalConfig } from "@/lib/queries/fiscalization";
import { FISCAL_PROVIDERS, type FiscalProvider } from "@/lib/types";

interface FormShape {
  enabled: boolean;
  provider: FiscalProvider;
  environment: "TEST" | "PRODUCTION";
  businessUnitCode: string;
  operatorCode: string;
  efsSoftwareCode: string;
  efsMaintainer: string;
  verificationBaseUrl: string;
}

const DEFAULTS: FormShape = {
  enabled: false,
  provider: "NONE",
  environment: "TEST",
  businessUnitCode: "",
  operatorCode: "",
  efsSoftwareCode: "",
  efsMaintainer: "",
  verificationBaseUrl: "",
};

export function FiscalizationSection() {
  const t = useT();
  const { data: config, isLoading } = useFiscalConfig();
  const upsert = useUpsertFiscalConfig();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const { register, handleSubmit, reset } = useForm<FormShape>({ defaultValues: DEFAULTS });

  useEffect(() => {
    if (!config) return;
    reset({
      enabled: config.enabled,
      provider: config.provider,
      environment: config.environment,
      businessUnitCode: config.businessUnitCode ?? "",
      operatorCode: config.operatorCode ?? "",
      efsSoftwareCode: config.efsSoftwareCode ?? "",
      efsMaintainer: config.efsMaintainer ?? "",
      verificationBaseUrl: config.verificationBaseUrl ?? "",
    });
  }, [config, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    setSaved(false);
    try {
      await upsert.mutateAsync(values);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("fiscal.saveFailed"));
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("fiscal.title")}</CardTitle>
        <CardDescription>{t("fiscal.description")}</CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit} noValidate>
        <CardContent className="space-y-4">
          {isLoading ? (
            <p className="text-sm text-zinc-500">{t("common.loading")}</p>
          ) : (
            <>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" {...register("enabled")} />
                {t("fiscal.enabled")}
              </label>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="provider">{t("fiscal.provider")}</Label>
                  <Select id="provider" {...register("provider")}>
                    {translateOptions(FISCAL_PROVIDERS, t).map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="environment">{t("fiscal.environment")}</Label>
                  <Select id="environment" {...register("environment")}>
                    <option value="TEST">{t("fiscal.envTest")}</option>
                    <option value="PRODUCTION">{t("fiscal.envProduction")}</option>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="businessUnitCode">{t("fiscal.businessUnit")}</Label>
                  <Input id="businessUnitCode" {...register("businessUnitCode")} />
                </div>
                <div>
                  <Label htmlFor="operatorCode">{t("fiscal.operator")}</Label>
                  <Input id="operatorCode" {...register("operatorCode")} />
                </div>
                <div>
                  <Label htmlFor="efsSoftwareCode">{t("fiscal.efsSoftwareCode")}</Label>
                  <Input id="efsSoftwareCode" {...register("efsSoftwareCode")} />
                </div>
                <div>
                  <Label htmlFor="efsMaintainer">{t("fiscal.efsMaintainer")}</Label>
                  <Input id="efsMaintainer" {...register("efsMaintainer")} />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="verificationBaseUrl">{t("fiscal.verificationBaseUrl")}</Label>
                  <Input
                    id="verificationBaseUrl"
                    placeholder="https://"
                    {...register("verificationBaseUrl")}
                  />
                </div>
              </div>
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                {t("fiscal.note")}
              </p>
            </>
          )}
          <FormError message={error ?? undefined} />
        </CardContent>
        <CardFooter className="justify-between">
          <span className="text-sm text-emerald-600 dark:text-emerald-400">
            {saved ? t("fiscal.saved") : ""}
          </span>
          <Button type="submit" loading={upsert.isPending}>
            {t("fiscal.save")}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
