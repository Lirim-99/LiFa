import { Type } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { TaxCalculationType, TaxScope } from "@prisma/client";

export class CreateTaxRateDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsString()
  @MaxLength(50)
  code!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(100)
  rate!: number;

  @IsEnum(TaxCalculationType)
  calculationType!: TaxCalculationType;

  @IsEnum(TaxScope)
  scope!: TaxScope;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
