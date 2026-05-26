import { Global, Module } from "@nestjs/common";
import { DocumentSequenceService } from "./services/document-sequence.service";

/**
 * CommonModule exposes shared infrastructure to every domain module.
 * Marked @Global so individual modules don't need to import it explicitly.
 *
 * Filters and decorators are not registered as providers — they're applied
 * directly in `main.ts` (filters) or used as parameter decorators (no DI).
 */
@Global()
@Module({
  providers: [DocumentSequenceService],
  exports: [DocumentSequenceService],
})
export class CommonModule {}
