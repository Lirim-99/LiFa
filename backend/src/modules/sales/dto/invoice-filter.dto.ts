import { Type } from "class-transformer";
import { IsDate, IsEnum, IsIn, IsOptional, IsUUID } from "class-validator";
import { InvoiceStatus } from "@prisma/client";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

export class InvoiceFilterDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

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

  @IsOptional()
  @IsIn(["issueDate", "dueDate", "createdAt", "invoiceNumber", "totalAmount"])
  declare sortBy?: string;
}
