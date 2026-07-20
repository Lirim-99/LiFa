import { Type } from "class-transformer";
import { IsDate, IsEnum, IsOptional, IsUUID } from "class-validator";
import { CreditNoteStatus, CreditNoteType } from "@prisma/client";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

export class CreditNoteFilterDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(CreditNoteType)
  type?: CreditNoteType;

  @IsOptional()
  @IsEnum(CreditNoteStatus)
  status?: CreditNoteStatus;

  @IsOptional()
  @IsUUID()
  contactId?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  issuedFrom?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  issuedTo?: Date;
}
