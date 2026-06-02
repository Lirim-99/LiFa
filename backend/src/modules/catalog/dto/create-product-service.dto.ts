import { Type } from "class-transformer";
import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from "class-validator";
import { ProductServiceType } from "@prisma/client";

export class CreateProductServiceDto {
  @IsString()
  @MaxLength(255)
  name!: string;

  @IsEnum(ProductServiceType)
  type!: ProductServiceType;

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
  incomeAccountId?: string;

  @IsOptional()
  @IsUUID()
  expenseAccountId?: string;

  @IsOptional()
  @IsUUID()
  defaultTaxRateId?: string;
}
