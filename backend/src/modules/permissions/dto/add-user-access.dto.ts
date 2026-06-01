import { IsEmail, IsIn, IsString } from "class-validator";
import { ROLE_CODES } from "../permissions.matrix";

export class AddUserAccessDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsIn(ROLE_CODES as readonly string[])
  roleCode!: string;
}
