
import { IsUUID } from "class-validator";

export class SetAccountDefaultDto {
  @IsUUID()
  accountId!: string;
}
