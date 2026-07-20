import { StockMovementType } from "@prisma/client";
import { Transform } from "class-transformer";
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min } from "class-validator";

export class CreateStockMovementDto {
  @IsUUID()
  warehouseId!: string;

  @IsUUID()
  productServiceId!: string;

  @IsEnum(StockMovementType)
  type!: StockMovementType;

  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0.0001)
  quantity!: number;

  @IsOptional()
  @Transform(({ value }) => (value != null ? Number(value) : undefined))
  @IsNumber()
  @Min(0)
  unitCost?: number;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsDateString()
  movementDate!: string;
}
