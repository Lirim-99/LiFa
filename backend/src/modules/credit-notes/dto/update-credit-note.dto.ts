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
import { CreateCreditNoteLineDto } from "./create-credit-note.dto";

export class UpdateCreditNoteDto {
  @IsOptional()
  @IsUUID()
  contactId?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  issueDate?: Date;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;

  @IsOptional()
  @IsUUID()
  originalInvoiceId?: string;

  @IsOptional()
  @IsUUID()
  originalBillId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateCreditNoteLineDto)
  lines?: CreateCreditNoteLineDto[];
}
