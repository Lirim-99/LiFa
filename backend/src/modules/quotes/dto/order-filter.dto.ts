import { Transform } from "class-transformer";
import { IsEnum, IsInt, IsOptional, Min } from "class-validator";
import { SalesOrderStatus } from "@prisma/client";

export class OrderFilterDto {
  @IsOptional()
  @IsEnum(SalesOrderStatus)
  status?: SalesOrderStatus;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  limit?: number;
}
