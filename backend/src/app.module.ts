import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { CommonModule } from "./common";
import { AuthModule } from "./modules/auth/auth.module";
import { CompaniesModule } from "./modules/companies/companies.module";
import { ContactsModule } from "./modules/contacts/contacts.module";
import { PermissionsModule } from "./modules/permissions/permissions.module";
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
    CompaniesModule,
    ContactsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
