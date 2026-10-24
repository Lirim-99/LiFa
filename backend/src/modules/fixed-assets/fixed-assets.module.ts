import { Module } from "@nestjs/common";
import { AccountingModule } from "../accounting/accounting.module";
import { AuthModule } from "../auth/auth.module";
import { FixedAssetsController } from "./fixed-assets.controller";
import { FixedAssetsService } from "./fixed-assets.service";

@Module({
  imports: [AuthModule, AccountingModule],
  controllers: [FixedAssetsController],
  providers: [FixedAssetsService],
  exports: [FixedAssetsService],
})
export class FixedAssetsModule {}
