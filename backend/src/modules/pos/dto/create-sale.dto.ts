import { PosPaymentMethod } from "@prisma/client";
import { Transform, Type } from "class-transformer";
import { ArrayMinSize, IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateNested } from "class-validator";

export class PosSaleLineDto {
  @IsUUID()
  productServiceId!: string;

  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0.0001)
  quantity!: number;

  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  unitPrice!: number;
}

export class CreateSaleDto {
  @IsUUID()
  sessionId!: string;

  @IsEnum(PosPaymentMethod)
  paymentMethod!: PosPaymentMethod;

  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  amountPaid!: number;

  @IsOptional()
  @IsString()
  customerName?: string;

  @ValidateNested({ each: true })
  @Type(() => PosSaleLineDto)
  @ArrayMinSize(1)
  lines!: PosSaleLineDto[];
}
