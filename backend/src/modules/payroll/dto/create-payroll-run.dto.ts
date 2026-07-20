import { Transform, Type } from "class-transformer";
import { IsDateString, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateNested } from "class-validator";

export class PayslipAdjustmentDto {
  @IsUUID()
  employeeId!: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  overtimeHours?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  bonusAmount?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  deductionAmount?: number;

  @IsOptional()
  @IsString()
  deductionNotes?: string;
}

export class CreatePayrollRunDto {
  @IsDateString()
  periodStart!: string;

  @IsDateString()
  periodEnd!: string;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => PayslipAdjustmentDto)
  adjustments?: PayslipAdjustmentDto[];
}
