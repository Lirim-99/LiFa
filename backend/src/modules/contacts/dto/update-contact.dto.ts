import { Type } from "class-transformer";
import { IsBoolean, IsEmail, IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";

/**
 * All fields optional (PATCH semantics). The "at least one role flag must be
 * true" rule is enforced in the service layer for updates, because the DTO
 * doesn't have visibility into the contact's current is_customer / is_vendor
 * state — only the service knows whether flipping a flag would leave the
 * record without a business purpose. The DB-level CHECK is the final backstop.
 */
export class UpdateContactDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  legalName?: string;

  @IsOptional()
  @IsBoolean()
  isCustomer?: boolean;

  @IsOptional()
  @IsBoolean()
  isVendor?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

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
