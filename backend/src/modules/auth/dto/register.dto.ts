import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";

export class RegisterDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName!: string;

  @IsEmail()
  @MaxLength(255)
  email!: string;

  // Rationale for 8/72: bcrypt silently truncates inputs > 72 bytes.
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;
}
