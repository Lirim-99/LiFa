import { Transform } from "class-transformer";
import { IsNumber, Min } from "class-validator";

export class CloseSessionDto {
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  closingBalance!: number;
}
