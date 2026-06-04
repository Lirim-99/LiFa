import { Type } from "class-transformer";
import { IsDate, IsOptional, IsUUID } from "class-validator";

export class DateRangeQueryDto {
  @Type(() => Date)
  @IsDate()
  from!: Date;

  @Type(() => Date)
  @IsDate()
  to!: Date;
}

export class GeneralLedgerQueryDto extends DateRangeQueryDto {
  @IsUUID()
  accountId!: string;
}

export class AsOfQueryDto {
  @Type(() => Date)
  @IsDate()
  asOf!: Date;
}

export class ArAgingQueryDto {
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  asOf?: Date;
}
