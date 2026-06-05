import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { FiscalizationController } from "./fiscalization.controller";
import { FiscalizationService } from "./fiscalization.service";
import { AtkEfsFiscalizationProvider } from "./providers/atk-efs.provider";
import { FISCALIZATION_PROVIDERS } from "./providers/fiscalization-provider.interface";
import { ManualEdiFiscalizationProvider } from "./providers/manual-edi.provider";
import { NoopFiscalizationProvider } from "./providers/noop.provider";

@Module({
  imports: [AuthModule, AuditModule], // CompanyGuard + AuditService
  controllers: [FiscalizationController],
  providers: [
    FiscalizationService,
    NoopFiscalizationProvider,
    ManualEdiFiscalizationProvider,
    AtkEfsFiscalizationProvider,
    {
      provide: FISCALIZATION_PROVIDERS,
      useFactory: (
        noop: NoopFiscalizationProvider,
        manual: ManualEdiFiscalizationProvider,
        atk: AtkEfsFiscalizationProvider,
      ) => [noop, manual, atk],
      inject: [
        NoopFiscalizationProvider,
        ManualEdiFiscalizationProvider,
        AtkEfsFiscalizationProvider,
      ],
    },
  ],
  exports: [FiscalizationService],
})
export class FiscalizationModule {}
