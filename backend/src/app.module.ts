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
import { CreditNotesModule } from "./modules/credit-notes/credit-notes.module";
import { FiscalizationModule } from "./modules/fiscalization/fiscalization.module";
import { ExchangeRatesModule } from "./modules/exchange-rates/exchange-rates.module";
import { FixedAssetsModule } from "./modules/fixed-assets/fixed-assets.module";
import { InventoryModule } from "./modules/inventory/inventory.module";
import { PdfModule } from "./modules/pdf/pdf.module";
import { PayrollModule } from "./modules/payroll/payroll.module";
import { PosModule } from "./modules/pos/pos.module";
import { QuotesModule } from "./modules/quotes/quotes.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { PermissionsModule } from "./modules/permissions/permissions.module";
import { PurchasesModule } from "./modules/purchases/purchases.module";
import { ReportsModule } from "./modules/reports/reports.module";
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
    PurchasesModule,
    CreditNotesModule,
    PaymentsModule,
    FiscalizationModule,
    PdfModule,
    ExchangeRatesModule,
    FixedAssetsModule,
    InventoryModule,
    PayrollModule,
    PosModule,
    QuotesModule,
    ReportsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
