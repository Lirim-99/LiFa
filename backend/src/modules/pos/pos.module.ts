import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PaymentsModule } from "../payments/payments.module";
import { SalesModule } from "../sales/sales.module";
import { PosController } from "./pos.controller";
import { PosService } from "./pos.service";

@Module({
  imports: [AuthModule, SalesModule, PaymentsModule],
  controllers: [PosController],
  providers: [PosService],
  exports: [PosService],
})
export class PosModule {}
