import { ExecutionContext, createParamDecorator } from "@nestjs/common";
import type { Request } from "express";

export interface AuthenticatedUser {
  userId: string;
  email: string;
}

/**
 * Extracts the authenticated user injected by `JwtAuthGuard` onto the request.
 * Routes that use this decorator must be protected by JWT auth (or marked
 * with `@Public()` on routes that explicitly do not need a user).
 */
export const CurrentUser = createParamDecorator<keyof AuthenticatedUser | undefined>(
  (data, ctx: ExecutionContext): AuthenticatedUser | AuthenticatedUser[keyof AuthenticatedUser] => {
    const request = ctx.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user) {
      throw new Error(
        "CurrentUser used on a request without a user. Apply JwtAuthGuard or mark the route @Public().",
      );
    }
    return data ? user[data] : user;
  },
);
