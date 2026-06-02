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
  Query,
  UseGuards,
} from "@nestjs/common";
import { CurrentCompany } from "../../common/decorators/current-company.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { CompanyGuard } from "../auth/guards/company.guard";
import { RequirePermission } from "../permissions/decorators/require-permission.decorator";
import { CreateJournalEntryDto } from "./dto/create-journal-entry.dto";
import { JournalEntryFilterDto } from "./dto/journal-entry-filter.dto";
import { UpdateJournalEntryDto } from "./dto/update-journal-entry.dto";
import { JournalEntriesService } from "./journal-entries.service";

@Controller("journal-entries")
@UseGuards(CompanyGuard)
export class JournalEntriesController {
  constructor(private readonly entries: JournalEntriesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission("accounting.create")
  create(
    @CurrentCompany("companyId") companyId: string,
    @CurrentUser("userId") userId: string,
    @Body() dto: CreateJournalEntryDto,
  ) {
    return this.entries.create(companyId, dto, userId);
  }

  @Get()
  @RequirePermission("accounting.read")
  list(@CurrentCompany("companyId") companyId: string, @Query() filters: JournalEntryFilterDto) {
    return this.entries.findAll(companyId, filters);
  }

  @Get(":id")
  @RequirePermission("accounting.read")
  findOne(@CurrentCompany("companyId") companyId: string, @Param("id", ParseUUIDPipe) id: string) {
    return this.entries.findById(companyId, id);
  }

  @Patch(":id")
  @RequirePermission("accounting.update")
  update(
    @CurrentCompany("companyId") companyId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateJournalEntryDto,
  ) {
    return this.entries.update(companyId, id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission("accounting.delete")
  async delete(
    @CurrentCompany("companyId") companyId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.entries.delete(companyId, id);
  }

  @Post(":id/post")
  @HttpCode(HttpStatus.OK)
  @RequirePermission("accounting.update")
  post(
    @CurrentCompany("companyId") companyId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser("userId") userId: string,
  ) {
    return this.entries.post(companyId, id, userId);
  }

  @Post(":id/void")
  @HttpCode(HttpStatus.OK)
  @RequirePermission("accounting.update")
  void(
    @CurrentCompany("companyId") companyId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser("userId") userId: string,
  ) {
    return this.entries.void(companyId, id, userId);
  }
}
