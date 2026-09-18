import { createHash, randomBytes } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import type { Types } from "mongoose";

import type { Persisted } from "../../database/base.repository";
import {
  type ActionTokenDocument,
  ActionTokensRepository,
} from "../../database/database.module";
import type { ActionTokenType } from "../../database/schemas/action-token.schema";
import { LOOKUP, asAccount } from "./account-operator";
import { PASSWORD_CONFIG, type PasswordConfig } from "./password.config";

export interface IssuedActionToken {
  /** 明碼 token,只出現在信件連結裡;資料庫存雜湊。 */
  token: string;
  expiresAt: Date;
}

export type StoredActionToken = Persisted<ActionTokenDocument> & {
  _id: Types.ObjectId;
};

/**
 * 單次動作 token(ADR-0009):啟用信 7 天、重設密碼 30 分鐘(環境變數可調);
 * 隨機高熵字串、資料庫只存 SHA-256 雜湊(高熵值不需慢雜湊,查詢時以雜湊定位)、用過即標 usedAt。
 */
@Injectable()
export class ActionTokenService {
  constructor(
    private readonly actionTokens: ActionTokensRepository,
    @Inject(PASSWORD_CONFIG) private readonly config: PasswordConfig,
  ) {}

  async issue(
    userId: Types.ObjectId,
    type: ActionTokenType,
  ): Promise<IssuedActionToken> {
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + this.ttlOf(type));
    await this.actionTokens.create(asAccount(userId), {
      userId,
      type,
      tokenHash: hashActionToken(token),
      expiresAt,
    });
    return { token, expiresAt };
  }

  /** 以明碼 token 找出仍有效(未用、未逾期)的那一筆;找不到 / 已用 / 逾期一律回 null,不區分。 */
  async findValid(rawToken: string): Promise<StoredActionToken | null> {
    const stored = await this.actionTokens.findOne(LOOKUP, {
      tokenHash: hashActionToken(rawToken),
    });
    if (!stored) {
      return null;
    }
    const isUsed = stored.usedAt !== null;
    const isExpired = stored.expiresAt.getTime() <= Date.now();
    return isUsed || isExpired ? null : stored;
  }

  /** 原子地標記已使用(單次使用);回 false 表示同時有另一個請求搶先用掉了。 */
  async markUsed(token: StoredActionToken): Promise<boolean> {
    const modified = await this.actionTokens.updateMany(
      asAccount(token.userId),
      { _id: token._id, usedAt: null },
      { $set: { usedAt: new Date() } },
    );
    return modified === 1;
  }

  private ttlOf(type: ActionTokenType): number {
    return type === "activation"
      ? this.config.activationTokenTtlMs
      : this.config.passwordResetTokenTtlMs;
  }
}

export function hashActionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
