import { createHash, randomBytes } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import { type JwtPayload, TokenExpiredError, sign, verify } from "jsonwebtoken";
import { Types } from "mongoose";

import { AUTH_CONFIG, type AuthConfig } from "./auth.config";

/** access token 的 `aud`:後台使用者(ADR-0003;會員為 front,打後台 API 一律拒)。 */
export const ADMIN_AUDIENCE = "admin";

export interface AccessTokenClaims {
  userId: Types.ObjectId;
  currentOrgId: Types.ObjectId | null;
}

export type AccessTokenVerification =
  | { status: "valid"; claims: AccessTokenClaims }
  | { status: "expired" }
  | { status: "invalid" };

/**
 * token 的簽發與驗證(ADR-0003):
 * - access:JWT HS256、`aud=admin`、payload 只放 userId(`sub`)與當前組織 id(`orgId`)
 * - refresh:隨機高熵字串;資料庫只存其 SHA-256 雜湊(高熵值不需慢雜湊,查詢時以雜湊定位)
 */
@Injectable()
export class TokenService {
  constructor(@Inject(AUTH_CONFIG) private readonly config: AuthConfig) {}

  signAccessToken(claims: AccessTokenClaims): string {
    const payload =
      claims.currentOrgId === null
        ? {}
        : { orgId: String(claims.currentOrgId) };
    return sign(payload, this.config.jwtSecret, {
      algorithm: "HS256",
      audience: ADMIN_AUDIENCE,
      subject: String(claims.userId),
      expiresIn: Math.floor(this.config.accessTokenTtlMs / 1000),
    });
  }

  verifyAccessToken(token: string): AccessTokenVerification {
    let decoded: JwtPayload | string;
    try {
      decoded = verify(token, this.config.jwtSecret, {
        algorithms: ["HS256"],
        audience: ADMIN_AUDIENCE,
      });
    } catch (error) {
      return error instanceof TokenExpiredError
        ? { status: "expired" }
        : { status: "invalid" };
    }
    if (
      typeof decoded === "string" ||
      !Types.ObjectId.isValid(decoded.sub ?? "")
    ) {
      return { status: "invalid" };
    }
    const orgId = (decoded as { orgId?: unknown }).orgId;
    return {
      status: "valid",
      claims: {
        userId: new Types.ObjectId(decoded.sub),
        currentOrgId:
          typeof orgId === "string" && Types.ObjectId.isValid(orgId)
            ? new Types.ObjectId(orgId)
            : null,
      },
    };
  }

  generateRefreshToken(): string {
    return randomBytes(32).toString("base64url");
  }

  hashRefreshToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  refreshTokenExpiresAt(now = new Date()): Date {
    return new Date(now.getTime() + this.config.refreshTokenTtlMs);
  }
}
