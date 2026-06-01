import { Global, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { PermissionsController } from "./permissions.controller";
import { PermissionsGuard } from "./permissions.guard";
import { PermissionsService } from "./permissions.service";

@Global()
@Module({
  controllers: [PermissionsController],
  providers: [
    PermissionsService,
    // Global guard — every protected route gets a permission check when it
    // carries @RequirePermission(...); routes without the decorator pass.
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
  exports: [PermissionsService],
})
export class PermissionsModule {}
