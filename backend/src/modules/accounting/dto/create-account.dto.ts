import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";
import { AccountType, NormalBalance } from "@prisma/client";

export class CreateAccountDto {
  @IsString()
  @MaxLength(20)
  code!: string;

  @IsString()
  @MaxLength(255)
  name!: string;

  @IsEnum(AccountType)
  accountType!: AccountType;

  @IsEnum(NormalBalance)
  normalBalance!: NormalBalance;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  accountSubtype?: string;

  @IsOptional()
  @IsUUID()
  parentAccountId?: string;

  @IsOptional()
  @IsBoolean()
  isPostable?: boolean;
}
