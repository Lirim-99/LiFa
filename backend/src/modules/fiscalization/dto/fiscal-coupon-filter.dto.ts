import { IsEnum, IsOptional } from "class-validator";
import { FiscalCouponStatus, FiscalCouponType } from "@prisma/client";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

export class FiscalCouponFilterDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(FiscalCouponStatus)
  status?: FiscalCouponStatus;

  @IsOptional()
  @IsEnum(FiscalCouponType)
  couponType?: FiscalCouponType;
}
