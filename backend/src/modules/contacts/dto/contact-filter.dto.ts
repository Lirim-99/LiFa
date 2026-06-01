import { Transform } from "class-transformer";
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

const toBool = ({ value }: { value: unknown }) => {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
};

export class ContactFilterDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  isCustomer?: boolean;

  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  isVendor?: boolean;

  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  isActive?: boolean;

  /** Case-insensitive substring match against display_name, legal_name, email. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  // Override sortBy to a closed allowlist — protects against arbitrary
  // column references via the global PaginationQueryDto's free-form sortBy.
  @IsOptional()
  @IsIn(["displayName", "createdAt"])
  declare sortBy?: string;
}
