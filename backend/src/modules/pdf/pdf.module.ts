import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PdfController } from "./pdf.controller";
import { PdfService } from "./pdf.service";

@Module({
  imports: [AuthModule],
  controllers: [PdfController],
  providers: [PdfService],
  exports: [PdfService],
})
export class PdfModule {}
