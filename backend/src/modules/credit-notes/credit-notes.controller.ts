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
import { CreateCreditNoteDto } from "./dto/create-credit-note.dto";
import { CreditNoteFilterDto } from "./dto/credit-note-filter.dto";
import { UpdateCreditNoteDto } from "./dto/update-credit-note.dto";
import { CreditNotesService } from "./credit-notes.service";

@Controller("credit-notes")
@UseGuards(CompanyGuard)
export class CreditNotesController {
  constructor(private readonly creditNotes: CreditNotesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission("invoices.create")
  create(
    @CurrentCompany("companyId") companyId: string,
    @CurrentUser("userId") userId: string,
    @Body() dto: CreateCreditNoteDto,
  ) {
    return this.creditNotes.create(companyId, dto, userId);
  }

  @Get()
  @RequirePermission("invoices.read")
  list(@CurrentCompany("companyId") companyId: string, @Query() filters: CreditNoteFilterDto) {
    return this.creditNotes.findAll(companyId, filters);
  }

  @Get(":id")
  @RequirePermission("invoices.read")
  findOne(@CurrentCompany("companyId") companyId: string, @Param("id", ParseUUIDPipe) id: string) {
    return this.creditNotes.findById(companyId, id);
  }

  @Patch(":id")
  @RequirePermission("invoices.update")
  update(
    @CurrentCompany("companyId") companyId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateCreditNoteDto,
  ) {
    return this.creditNotes.update(companyId, id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission("invoices.delete")
  async delete(
    @CurrentCompany("companyId") companyId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.creditNotes.delete(companyId, id);
  }

  @Post(":id/issue")
  @HttpCode(HttpStatus.OK)
  @RequirePermission("invoices.issue")
  issue(
    @CurrentCompany("companyId") companyId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser("userId") userId: string,
  ) {
    return this.creditNotes.issue(companyId, id, userId);
  }

  @Post(":id/void")
  @HttpCode(HttpStatus.OK)
  @RequirePermission("invoices.void")
  void(
    @CurrentCompany("companyId") companyId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser("userId") userId: string,
  ) {
    return this.creditNotes.void(companyId, id, userId);
  }
}
