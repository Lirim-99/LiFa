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

export class QuoteLineDto {
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

export class CreateQuoteDto {
  @IsUUID()
  contactId!: string;

  @IsDateString()
  issueDate!: string;

  @IsDateString()
  expiryDate!: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @ValidateNested({ each: true })
  @Type(() => QuoteLineDto)
  @ArrayMinSize(1)
  lines!: QuoteLineDto[];
}

export class UpdateQuoteDto extends CreateQuoteDto {}
