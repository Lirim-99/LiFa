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
import { CompanyLegalProfileService } from "./company-legal-profile.service";
import { CreateCompanyAddressDto } from "./dto/create-company-address.dto";
import { UpdateCompanyAddressDto } from "./dto/update-company-address.dto";
import { CreateCompanyActivityCodeDto } from "./dto/create-company-activity-code.dto";
import { UpdateCompanyActivityCodeDto } from "./dto/update-company-activity-code.dto";

@Controller("companies/:companyId")
export class CompanyLegalProfileController {
  constructor(private readonly profile: CompanyLegalProfileService) {}

  // ----- Addresses -------------------------------------------------------

  @Get("addresses")
  listAddresses(
    @Param("companyId", ParseUUIDPipe) companyId: string,
    @CurrentUser("userId") userId: string,
  ) {
    return this.profile.listAddresses(companyId, userId);
  }

  @Post("addresses")
  @HttpCode(HttpStatus.CREATED)
  createAddress(
    @Param("companyId", ParseUUIDPipe) companyId: string,
    @Body() dto: CreateCompanyAddressDto,
    @CurrentUser("userId") userId: string,
  ) {
    return this.profile.createAddress(companyId, dto, userId);
  }

  @Patch("addresses/:id")
  updateAddress(
    @Param("companyId", ParseUUIDPipe) companyId: string,
    @Param("id", ParseUUIDPipe) addressId: string,
    @Body() dto: UpdateCompanyAddressDto,
    @CurrentUser("userId") userId: string,
  ) {
    return this.profile.updateAddress(companyId, addressId, dto, userId);
  }

  @Delete("addresses/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteAddress(
    @Param("companyId", ParseUUIDPipe) companyId: string,
    @Param("id", ParseUUIDPipe) addressId: string,
    @CurrentUser("userId") userId: string,
  ): Promise<void> {
    return this.profile.deleteAddress(companyId, addressId, userId);
  }

  // ----- Activity codes --------------------------------------------------

  @Get("activity-codes")
  listActivityCodes(
    @Param("companyId", ParseUUIDPipe) companyId: string,
    @CurrentUser("userId") userId: string,
  ) {
    return this.profile.listActivityCodes(companyId, userId);
  }

  @Post("activity-codes")
  @HttpCode(HttpStatus.CREATED)
  createActivityCode(
    @Param("companyId", ParseUUIDPipe) companyId: string,
    @Body() dto: CreateCompanyActivityCodeDto,
    @CurrentUser("userId") userId: string,
  ) {
    return this.profile.createActivityCode(companyId, dto, userId);
  }

  @Patch("activity-codes/:id")
  updateActivityCode(
    @Param("companyId", ParseUUIDPipe) companyId: string,
    @Param("id", ParseUUIDPipe) codeId: string,
    @Body() dto: UpdateCompanyActivityCodeDto,
    @CurrentUser("userId") userId: string,
  ) {
    return this.profile.updateActivityCode(companyId, codeId, dto, userId);
  }

  @Delete("activity-codes/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteActivityCode(
    @Param("companyId", ParseUUIDPipe) companyId: string,
    @Param("id", ParseUUIDPipe) codeId: string,
    @CurrentUser("userId") userId: string,
  ): Promise<void> {
    return this.profile.deleteActivityCode(companyId, codeId, userId);
  }
}
