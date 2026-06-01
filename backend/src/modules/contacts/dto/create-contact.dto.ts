import { Type } from "class-transformer";
import { IsBoolean, IsEmail, IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";
import { AtLeastOneTrue } from "../../../common/validators/at-least-one-true.validator";

export class CreateContactDto {
  @IsString()
  @MaxLength(255)
  displayName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  legalName?: string;

  @AtLeastOneTrue(["isCustomer", "isVendor"])
  @IsOptional()
  @IsBoolean()
  isCustomer?: boolean;

  @IsOptional()
  @IsBoolean()
  isVendor?: boolean;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  taxId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  paymentTermsDays?: number;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  municipality?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  street?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
