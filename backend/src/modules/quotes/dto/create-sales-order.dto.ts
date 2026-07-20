import { Transform, Type } from "class-transformer";
import {
  ArrayMinSize,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from "class-validator";

export class SalesOrderLineDto {
  @IsOptional()
  @IsUUID()
  productServiceId?: string;

  @IsString()
  description!: string;

  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0.0001)
  quantity!: number;

  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  @IsOptional()
  discountPercent?: number;

  @Transform(({ value }) => Number(value))
  @IsNumber()
  @IsOptional()
  taxAmount?: number;
}

export class CreateSalesOrderDto {
  @IsUUID()
  contactId!: string;

  @IsDateString()
  orderDate!: string;

  @IsOptional()
  @IsDateString()
  deliveryDate?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsUUID()
  quoteId?: string;

  @ValidateNested({ each: true })
  @Type(() => SalesOrderLineDto)
  @ArrayMinSize(1)
  lines!: SalesOrderLineDto[];
}

export class UpdateSalesOrderDto extends CreateSalesOrderDto {}
