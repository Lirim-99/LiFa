import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AccountsController } from "./accounts.controller";
import { AccountsService } from "./accounts.service";
import { CompanyAccountDefaultsController } from "./company-account-defaults.controller";
import { CompanyAccountDefaultsService } from "./company-account-defaults.service";
import { PeriodsController } from "./periods.controller";
import { PeriodsService } from "./periods.service";

@Module({
  imports: [AuthModule], // CompanyGuard
  controllers: [AccountsController, PeriodsController, CompanyAccountDefaultsController],
  providers: [AccountsService, PeriodsService, CompanyAccountDefaultsService],
  exports: [AccountsService, PeriodsService, CompanyAccountDefaultsService],
})
export class AccountingModule {}
