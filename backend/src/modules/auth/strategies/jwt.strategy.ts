import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import type { JwtPayload } from "../auth.service";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(config: ConfigService) {
    const secret = config.get<string>("JWT_SECRET");
    if (!secret) {
      throw new Error("JWT_SECRET is not configured. See backend/.env.example.");
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  /**
   * Called by passport-jwt after the token signature is verified. The return
   * value is assigned to `request.user`.
   */
  validate(payload: JwtPayload): AuthenticatedUser {
    if (payload.type !== "access") {
      throw new UnauthorizedException("Wrong token type");
    }
    return { userId: payload.sub, email: payload.email };
  }
}
