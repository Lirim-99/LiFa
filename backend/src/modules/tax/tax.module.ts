import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { TaxController } from "./tax.controller";
import { TaxService } from "./tax.service";

@Module({
  imports: [AuthModule], // CompanyGuard
  controllers: [TaxController],
  providers: [TaxService],
  exports: [TaxService],
})
export class TaxModule {}
