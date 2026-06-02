import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsDate,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { CreateJournalEntryLineDto } from "./create-journal-entry.dto";

/** Only DRAFT entries accept updates. Lines, when supplied, replace the set. */
export class UpdateJournalEntryDto {
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  entryDate?: Date;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  memo?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => CreateJournalEntryLineDto)
  lines?: CreateJournalEntryLineDto[];
}
