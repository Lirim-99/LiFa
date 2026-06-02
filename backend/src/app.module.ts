import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { CommonModule } from "./common";
import { AccountingModule } from "./modules/accounting/accounting.module";
import { AuditModule } from "./modules/audit/audit.module";
import { AuthModule } from "./modules/auth/auth.module";
import { CatalogModule } from "./modules/catalog/catalog.module";
import { CompaniesModule } from "./modules/companies/companies.module";
import { ContactsModule } from "./modules/contacts/contacts.module";
import { PermissionsModule } from "./modules/permissions/permissions.module";
import { SalesModule } from "./modules/sales/sales.module";
import { TaxModule } from "./modules/tax/tax.module";
import { UsersModule } from "./modules/users/users.module";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    CommonModule,
    AuthModule,
    UsersModule,
    PermissionsModule,
    AuditModule,
    CompaniesModule,
    ContactsModule,
    TaxModule,
    AccountingModule,
    CatalogModule,
    SalesModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
