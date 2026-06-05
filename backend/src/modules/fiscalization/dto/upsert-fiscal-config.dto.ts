import { FiscalProvider } from "@prisma/client";
import { IsBoolean, IsEnum, IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export class UpsertFiscalConfigDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsEnum(FiscalProvider)
  provider?: FiscalProvider;

  @IsOptional()
  @IsIn(["TEST", "PRODUCTION"])
  environment?: "TEST" | "PRODUCTION";

  @IsOptional()
  @IsString()
  @MaxLength(50)
  businessUnitCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  operatorCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  efsSoftwareCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  efsMaintainer?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  verificationBaseUrl?: string;
}
