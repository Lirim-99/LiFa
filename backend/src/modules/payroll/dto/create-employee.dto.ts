import { EmploymentType } from "@prisma/client";
import { Transform } from "class-transformer";
import { IsDateString, IsEmail, IsEnum, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class CreateEmployeeDto {
  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsOptional()
  @IsString()
  personalNumber?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  position?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsEnum(EmploymentType)
  employmentType?: EmploymentType;

  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  grossSalary!: number;

  @IsOptional()
  @IsString()
  bankAccount?: string;
}

export class UpdateEmployeeDto extends CreateEmployeeDto {}
