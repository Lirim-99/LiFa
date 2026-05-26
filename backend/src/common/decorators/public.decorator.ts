import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";

/**
 * Marks a route as not requiring JWT authentication. The global JwtAuthGuard
 * (added in Step 4) checks for this metadata and skips authentication.
 */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);
