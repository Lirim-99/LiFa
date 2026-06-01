import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { CurrentCompany } from "../../common/decorators/current-company.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { CompanyGuard } from "../auth/guards/company.guard";
import { RequirePermission } from "../permissions/decorators/require-permission.decorator";
import { ContactsService } from "./contacts.service";
import { ContactFilterDto } from "./dto/contact-filter.dto";
import { CreateContactDto } from "./dto/create-contact.dto";
import { UpdateContactDto } from "./dto/update-contact.dto";

/**
 * /contacts is company-scoped via the X-Company-Id header.
 * CompanyGuard resolves the active company; PermissionsGuard (global) gates
 * each route against the role-permission matrix.
 */
@Controller("contacts")
@UseGuards(CompanyGuard)
export class ContactsController {
  constructor(private readonly contacts: ContactsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission("contacts.create")
  create(
    @CurrentCompany("companyId") companyId: string,
    @CurrentUser("userId") userId: string,
    @Body() dto: CreateContactDto,
  ) {
    return this.contacts.create(companyId, dto, userId);
  }

  @Get()
  @RequirePermission("contacts.read")
  list(@CurrentCompany("companyId") companyId: string, @Query() filters: ContactFilterDto) {
    return this.contacts.findAll(companyId, filters);
  }

  @Get(":id")
  @RequirePermission("contacts.read")
  findOne(@CurrentCompany("companyId") companyId: string, @Param("id", ParseUUIDPipe) id: string) {
    return this.contacts.findById(companyId, id);
  }

  @Patch(":id")
  @RequirePermission("contacts.update")
  update(
    @CurrentCompany("companyId") companyId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateContactDto,
  ) {
    return this.contacts.update(companyId, id, dto);
  }
}
