import { Transform, Type } from "class-transformer";
import { IsBoolean, IsDate, IsEnum, IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import { JournalEntryStatus } from "@prisma/client";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

const toBool = ({ value }: { value: unknown }) => {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
};

export class JournalEntryFilterDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(JournalEntryStatus)
  status?: JournalEntryStatus;

  /** MANUAL | INVOICE | PAYMENT | INVOICE_VOID | PAYMENT_VOID. Free string. */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  sourceType?: string;

  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  reversed?: boolean;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;

  @IsOptional()
  @IsIn(["entryDate", "createdAt", "entryNumber"])
  declare sortBy?: string;
}
