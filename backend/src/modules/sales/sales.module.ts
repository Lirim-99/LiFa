import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { FiscalizationModule } from "../fiscalization/fiscalization.module";
import { InventoryModule } from "../inventory/inventory.module";
import { InvoicesController } from "./invoices.controller";
import { InvoicesService } from "./invoices.service";

@Module({
  imports: [AuthModule, FiscalizationModule, InventoryModule],
  controllers: [InvoicesController],
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class SalesModule {}
