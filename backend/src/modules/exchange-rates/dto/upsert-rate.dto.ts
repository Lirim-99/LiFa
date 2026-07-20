import { Transform } from "class-transformer";
import { IsDateString, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class UpsertRateDto {
  @IsOptional()
  @IsString()
  baseCurrency?: string;

  @IsString()
  targetCurrency!: string;

  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0.00000001)
  rate!: number;

  @IsDateString()
  effectiveDate!: string;
}
