import { Transform } from "class-transformer";
import { IsBoolean, IsEnum, IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import { ProductServiceType } from "@prisma/client";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

const toBool = ({ value }: { value: unknown }) => {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
};

export class ProductServiceFilterDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(ProductServiceType)
  type?: ProductServiceType;

  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsIn(["name", "createdAt", "sku"])
  declare sortBy?: string;
}
