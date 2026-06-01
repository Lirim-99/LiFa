import { Type } from "class-transformer";
import {
  IsDate,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { LegalForm } from "@prisma/client";

// All fields optional — PATCH semantics.
export class UpdateCompanyDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  legalName?: string;

  @IsOptional()
  @IsEnum(LegalForm)
  legalForm?: LegalForm;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  tradeName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  uinNui?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  fiscalNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  vatNumber?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  registrationDate?: Date;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  website?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  defaultCurrency?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  fiscalYearStartMonth?: number;
}
