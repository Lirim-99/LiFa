import { Type } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from "class-validator";
import { ProductServiceType } from "@prisma/client";

export class UpdateProductServiceDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsEnum(ProductServiceType)
  type?: ProductServiceType;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  sku?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  unit?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  salePrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  purchasePrice?: number;

  @IsOptional()
  @IsUUID()
  incomeAccountId?: string | null;

  @IsOptional()
  @IsUUID()
  expenseAccountId?: string | null;

  @IsOptional()
  @IsUUID()
  defaultTaxRateId?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
