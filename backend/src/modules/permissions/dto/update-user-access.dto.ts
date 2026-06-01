import { IsIn, IsString } from "class-validator";
import { ROLE_CODES } from "../permissions.matrix";

export class UpdateUserAccessDto {
  @IsString()
  @IsIn(ROLE_CODES as readonly string[])
  roleCode!: string;
}
