import { Body, Controller, Get, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { SwitchCompanyDto } from "./dto/switch-company.dto";
import { UsersService, UserCompanyAccessSummary } from "./users.service";

@Controller("users")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get("me")
  me(@CurrentUser("userId") userId: string) {
    return this.users.getProfile(userId);
  }

  @Get("me/companies")
  myCompanies(@CurrentUser("userId") userId: string): Promise<UserCompanyAccessSummary[]> {
    return this.users.getCompanies(userId);
  }

  @Post("me/switch-company")
  @HttpCode(HttpStatus.NO_CONTENT)
  async switchCompany(
    @CurrentUser("userId") userId: string,
    @Body() dto: SwitchCompanyDto,
  ): Promise<void> {
    await this.users.switchDefaultCompany(userId, dto.companyId);
  }
}
