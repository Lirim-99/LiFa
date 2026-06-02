import { Type } from "class-transformer";
import { IsDate, IsIn, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

export class AuditFilterDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  entityType?: string;

  @IsOptional()
  @IsUUID()
  entityId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  action?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  occurredFrom?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  occurredTo?: Date;

  @IsOptional()
  @IsIn(["occurredAt"])
  declare sortBy?: string;
}
