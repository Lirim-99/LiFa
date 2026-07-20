import { DepreciationMethod } from "@prisma/client";
import { Transform } from "class-transformer";
import { IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class CreateAssetDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsDateString()
  purchaseDate!: string;

  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  purchaseCost!: number;

  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  @IsOptional()
  residualValue?: number;

  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  usefulLifeMonths!: number;

  @IsOptional()
  @IsEnum(DepreciationMethod)
  depreciationMethod?: DepreciationMethod;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateAssetDto extends CreateAssetDto {}
