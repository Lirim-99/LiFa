import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from "class-validator";
import { AddressType } from "@prisma/client";

export class UpdateCompanyAddressDto {
  @IsOptional()
  @IsEnum(AddressType)
  addressType?: AddressType;

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
  @IsBoolean()
  isPrimary?: boolean;
}
