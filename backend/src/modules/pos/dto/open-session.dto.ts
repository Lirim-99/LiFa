import { Transform } from "class-transformer";
import { IsNumber, IsUUID, Min } from "class-validator";

export class OpenSessionDto {
  @IsUUID()
  registerId!: string;

  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  openingBalance!: number;
}
