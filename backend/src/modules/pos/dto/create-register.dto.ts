import { IsString, MaxLength } from "class-validator";

export class CreateRegisterDto {
  @IsString()
  @MaxLength(100)
  name!: string;
}
