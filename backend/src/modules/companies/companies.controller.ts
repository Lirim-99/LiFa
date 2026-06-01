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
} from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermission } from "../permissions/decorators/require-permission.decorator";
import { CompaniesService } from "./companies.service";
import { CreateCompanyDto } from "./dto/create-company.dto";
import { UpdateCompanyDto } from "./dto/update-company.dto";

@Controller("companies")
export class CompaniesController {
  constructor(private readonly companies: CompaniesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateCompanyDto, @CurrentUser("userId") userId: string) {
    return this.companies.create(dto, userId);
  }

  @Get()
  list(@CurrentUser("userId") userId: string) {
    return this.companies.findByUser(userId);
  }

  @Get(":id")
  findOne(@Param("id", ParseUUIDPipe) id: string, @CurrentUser("userId") userId: string) {
    return this.companies.findById(id, userId);
  }

  @Patch(":id")
  @RequirePermission("company.update", { companyIdParam: "id" })
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateCompanyDto,
    @CurrentUser("userId") userId: string,
  ) {
    return this.companies.update(id, dto, userId);
  }
}
