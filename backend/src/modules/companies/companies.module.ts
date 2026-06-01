import { Module } from "@nestjs/common";
import { CompaniesController } from "./companies.controller";
import { CompaniesService } from "./companies.service";
import { CompanyLegalProfileController } from "./company-legal-profile.controller";
import { CompanyLegalProfileService } from "./company-legal-profile.service";

@Module({
  controllers: [CompaniesController, CompanyLegalProfileController],
  providers: [CompaniesService, CompanyLegalProfileService],
  exports: [CompaniesService],
})
export class CompaniesModule {}
