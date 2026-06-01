import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";
import { ActivityType } from "@prisma/client";

export class UpdateCompanyActivityCodeDto {
  @IsOptional()
  @IsEnum(ActivityType)
  activityType?: ActivityType;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
