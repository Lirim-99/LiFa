import { Type } from "class-transformer";
import { IsDate, IsEnum, IsIn, IsOptional, IsUUID } from "class-validator";
import { PaymentMethod, PaymentStatus } from "@prisma/client";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

export class PaymentFilterDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsUUID()
  contactId?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  paidFrom?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  paidTo?: Date;

  @IsOptional()
  @IsIn(["paymentDate", "createdAt", "totalAmount"])
  declare sortBy?: string;
}
