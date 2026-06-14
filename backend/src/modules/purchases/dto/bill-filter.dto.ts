import { Type } from "class-transformer";
import { IsDate, IsEnum, IsIn, IsOptional, IsUUID } from "class-validator";
import { BillStatus } from "@prisma/client";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

export class BillFilterDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(BillStatus)
  status?: BillStatus;

  @IsOptional()
  @IsUUID()
  contactId?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  billedFrom?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  billedTo?: Date;

  @IsOptional()
  @IsIn(["billDate", "dueDate", "createdAt", "billNumber", "totalAmount"])
  declare sortBy?: string;
}
