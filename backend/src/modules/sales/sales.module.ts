import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { FiscalizationModule } from "../fiscalization/fiscalization.module";
import { InvoicesController } from "./invoices.controller";
import { InvoicesService } from "./invoices.service";

@Module({
  imports: [AuthModule, FiscalizationModule], // CompanyGuard + fiscal coupon hooks
  controllers: [InvoicesController],
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class SalesModule {}
