import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsDate,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { CreateInvoiceLineDto } from "./create-invoice.dto";

/**
 * PATCH a DRAFT invoice. Lines, when supplied, REPLACE the existing line set —
 * partial line updates aren't supported in MVP (much simpler validation +
 * recalculation that way). Only DRAFT invoices accept any update.
 */
export class UpdateInvoiceDto {
  @IsOptional()
  @IsUUID()
  contactId?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  issueDate?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dueDate?: Date;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceLineDto)
  lines?: CreateInvoiceLineDto[];
}
