import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { FiscalizationModule } from "../fiscalization/fiscalization.module";
import { CreditNotesController } from "./credit-notes.controller";
import { CreditNotesService } from "./credit-notes.service";

@Module({
  imports: [AuthModule, FiscalizationModule],
  controllers: [CreditNotesController],
  providers: [CreditNotesService],
  exports: [CreditNotesService],
})
export class CreditNotesModule {}
