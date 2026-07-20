import { IsDateString } from "class-validator";

export class RunDepreciationDto {
  @IsDateString()
  periodDate!: string;
}
