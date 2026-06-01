import { Controller, Get } from "@nestjs/common";
import { Public } from "./common/decorators/public.decorator";

@Public()
@Controller()
export class AppController {
  @Get("health")
  getHealth(): { status: string } {
    return { status: "ok" };
  }
}
