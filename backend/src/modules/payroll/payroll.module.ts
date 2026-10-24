import { Module } from "@nestjs/common";
import { AccountingModule } from "../accounting/accounting.module";
import { AuthModule } from "../auth/auth.module";
import { PayrollController } from "./payroll.controller";
import { PayrollService } from "./payroll.service";

@Module({
  imports: [AuthModule, AccountingModule],
  controllers: [PayrollController],
  providers: [PayrollService],
  exports: [PayrollService],
})
export class PayrollModule {}
