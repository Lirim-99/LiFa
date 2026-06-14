import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsDate,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { PaymentMethod, PaymentType } from "@prisma/client";

export class CreatePaymentAllocationDto {
  // Exactly one of invoiceId / billId, matching the payment type
  // (RECEIVED → invoiceId, MADE → billId). Enforced in the service.
  @IsOptional()
  @IsUUID()
  invoiceId?: string;

  @IsOptional()
  @IsUUID()
  billId?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  allocatedAmount!: number;
}

export class CreatePaymentDto {
  @IsUUID()
  contactId!: string;

  // RECEIVED (customer pays our invoice) — default — or MADE (we pay a vendor bill).
  @IsOptional()
  @IsEnum(PaymentType)
  paymentType?: PaymentType;

  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  @Type(() => Date)
  @IsDate()
  paymentDate!: Date;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  totalAmount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  referenceNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePaymentAllocationDto)
  allocations!: CreatePaymentAllocationDto[];
}
