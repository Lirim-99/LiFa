import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { PrismaService } from "../../prisma/prisma.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";

export interface JwtPayload {
  sub: string; // user id
  email: string;
  type: "access" | "refresh";
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds until accessToken expires
}

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<{ id: string; email: string }> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException("Email already registered");

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        passwordHash,
      },
      select: { id: true, email: true },
    });
    return user;
  }

  async login(dto: LoginDto): Promise<AuthTokens> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    // Always run the bcrypt compare to keep response timing uniform whether the
    // user exists or not — prevents email enumeration via timing side-channel.
    const hash =
      user?.passwordHash ?? "$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalid";
    const ok = await bcrypt.compare(dto.password, hash);
    if (!user || !ok || !user.isActive) {
      throw new UnauthorizedException("Invalid credentials");
    }
    return this.issueTokens({ userId: user.id, email: user.email });
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken);
    } catch {
      throw new UnauthorizedException("Invalid refresh token");
    }
    if (payload.type !== "refresh") {
      throw new UnauthorizedException("Wrong token type");
    }
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException("User no longer active");
    }
    return this.issueTokens({ userId: user.id, email: user.email });
  }

  private async issueTokens(args: { userId: string; email: string }): Promise<AuthTokens> {
    // Resolve to a numeric seconds value — @nestjs/jwt 11's `expiresIn` typing
    // only accepts a number or a narrow string-literal union, so passing the
    // raw env string fails type-checking.
    const accessSeconds = this.parseExpiresInSeconds(
      this.config.get<string>("JWT_ACCESS_EXPIRES_IN") ?? "1h",
    );
    const refreshSeconds = this.parseExpiresInSeconds(
      this.config.get<string>("JWT_REFRESH_EXPIRES_IN") ?? "7d",
    );

    const accessPayload: JwtPayload = { sub: args.userId, email: args.email, type: "access" };
    const refreshPayload: JwtPayload = { sub: args.userId, email: args.email, type: "refresh" };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(accessPayload, { expiresIn: accessSeconds }),
      this.jwt.signAsync(refreshPayload, { expiresIn: refreshSeconds }),
    ]);

    return { accessToken, refreshToken, expiresIn: accessSeconds };
  }

  /** Roughly converts "1h" / "30m" / "7d" / "3600" into seconds. */
  private parseExpiresInSeconds(value: string): number {
    if (/^\d+$/.test(value)) return parseInt(value, 10);
    const match = /^(\d+)([smhd])$/.exec(value);
    if (!match) return 3600;
    const n = parseInt(match[1], 10);
    const unit = match[2];
    return unit === "s" ? n : unit === "m" ? n * 60 : unit === "h" ? n * 3600 : n * 86400;
  }
}
