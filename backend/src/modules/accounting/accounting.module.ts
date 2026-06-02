import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AccountsController } from "./accounts.controller";
import { AccountsService } from "./accounts.service";
import { CompanyAccountDefaultsController } from "./company-account-defaults.controller";
import { CompanyAccountDefaultsService } from "./company-account-defaults.service";
import { JournalEntriesController } from "./journal-entries.controller";
import { JournalEntriesService } from "./journal-entries.service";
import { PeriodsController } from "./periods.controller";
import { PeriodsService } from "./periods.service";

@Module({
  imports: [AuthModule], // CompanyGuard
  controllers: [
    AccountsController,
    PeriodsController,
    CompanyAccountDefaultsController,
    JournalEntriesController,
  ],
  providers: [
    AccountsService,
    PeriodsService,
    CompanyAccountDefaultsService,
    JournalEntriesService,
  ],
  exports: [AccountsService, PeriodsService, CompanyAccountDefaultsService, JournalEntriesService],
})
export class AccountingModule {}
