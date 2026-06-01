import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";
import { AccountType, NormalBalance } from "@prisma/client";

export class UpdateAccountDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsEnum(AccountType)
  accountType?: AccountType;

  @IsOptional()
  @IsEnum(NormalBalance)
  normalBalance?: NormalBalance;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  accountSubtype?: string;

  @IsOptional()
  @IsUUID()
  parentAccountId?: string | null;

  @IsOptional()
  @IsBoolean()
  isPostable?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
