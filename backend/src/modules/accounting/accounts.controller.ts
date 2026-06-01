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
  UseGuards,
} from "@nestjs/common";
import { CurrentCompany } from "../../common/decorators/current-company.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { CompanyGuard } from "../auth/guards/company.guard";
import { RequirePermission } from "../permissions/decorators/require-permission.decorator";
import { AccountsService } from "./accounts.service";
import { CreateAccountDto } from "./dto/create-account.dto";
import { UpdateAccountDto } from "./dto/update-account.dto";

@Controller("accounts")
@UseGuards(CompanyGuard)
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission("accounting.create")
  create(
    @CurrentCompany("companyId") companyId: string,
    @CurrentUser("userId") userId: string,
    @Body() dto: CreateAccountDto,
  ) {
    return this.accounts.create(companyId, dto, userId);
  }

  @Get()
  @RequirePermission("accounting.read")
  list(@CurrentCompany("companyId") companyId: string) {
    return this.accounts.findAll(companyId);
  }

  @Get(":id")
  @RequirePermission("accounting.read")
  findOne(@CurrentCompany("companyId") companyId: string, @Param("id", ParseUUIDPipe) id: string) {
    return this.accounts.findById(companyId, id);
  }

  @Patch(":id")
  @RequirePermission("accounting.update")
  update(
    @CurrentCompany("companyId") companyId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateAccountDto,
  ) {
    return this.accounts.update(companyId, id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission("accounting.delete")
  async deactivate(
    @CurrentCompany("companyId") companyId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.accounts.deactivate(companyId, id);
  }
}
