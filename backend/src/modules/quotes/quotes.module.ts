import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { QuotesController, SalesOrdersController } from "./quotes.controller";
import { QuotesService } from "./quotes.service";

@Module({
  imports: [AuthModule],
  controllers: [QuotesController, SalesOrdersController],
  providers: [QuotesService],
  exports: [QuotesService],
})
export class QuotesModule {}
