import { Global, Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AuditController } from "./audit.controller";
import { AuditService } from "./audit.service";

/**
 * Global so any domain service can inject AuditService for explicit
 * `auditService.log(...)` calls — see CONVENTIONS.md §7.
 */
@Global()
@Module({
  imports: [AuthModule], // CompanyGuard
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
