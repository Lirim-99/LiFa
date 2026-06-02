import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermission } from "./decorators/require-permission.decorator";
import { AddUserAccessDto } from "./dto/add-user-access.dto";
import { UpdateUserAccessDto } from "./dto/update-user-access.dto";
import { PermissionsService } from "./permissions.service";

@Controller("companies/:companyId/users")
export class PermissionsController {
  constructor(private readonly permissions: PermissionsService) {}

  @Get()
  @RequirePermission("permissions.manage", { companyIdParam: "companyId" })
  list(@Param("companyId", ParseUUIDPipe) companyId: string) {
    return this.permissions.listUsers(companyId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission("permissions.manage", { companyIdParam: "companyId" })
  add(
    @Param("companyId", ParseUUIDPipe) companyId: string,
    @Body() dto: AddUserAccessDto,
    @CurrentUser("userId") actingUserId: string,
  ) {
    return this.permissions.addUser(companyId, dto, actingUserId);
  }

  @Patch(":userId")
  @RequirePermission("permissions.manage", { companyIdParam: "companyId" })
  update(
    @Param("companyId", ParseUUIDPipe) companyId: string,
    @Param("userId", ParseUUIDPipe) userId: string,
    @Body() dto: UpdateUserAccessDto,
    @CurrentUser("userId") actingUserId: string,
  ) {
    return this.permissions.updateUserRole(companyId, userId, dto, actingUserId);
  }

  @Delete(":userId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission("permissions.manage", { companyIdParam: "companyId" })
  remove(
    @Param("companyId", ParseUUIDPipe) companyId: string,
    @Param("userId", ParseUUIDPipe) userId: string,
    @CurrentUser("userId") actingUserId: string,
  ): Promise<void> {
    return this.permissions.removeUser(companyId, userId, actingUserId);
  }
}
