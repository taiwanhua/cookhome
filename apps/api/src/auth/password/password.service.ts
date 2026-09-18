import { Inject, Injectable } from "@nestjs/common";
import { hash, verify as verifyPassword } from "@node-rs/argon2";
import type { Types } from "mongoose";

import { UsersRepository } from "../../database/database.module";
import { MailService } from "../../mail/mail.service";
import { authError } from "../auth-error";
import { AuthService, type IssuedTokens } from "../auth.service";
import type { RequestUser } from "../request-context";
import { LOOKUP, asAccount } from "./account-operator";
import { ActionTokenService } from "./action-token.service";
import { assertPasswordRule } from "./password-error";
import { PASSWORD_CONFIG, type PasswordConfig } from "./password.config";

/**
 * 「設定新密碼」的三個入口共用的後端(user-manager.md「密碼流程」;ADR-0009):
 * 啟用信(7 天)、重設信(30 分鐘)走 `setPassword`,首登強改走 `changePassword`。
 */
@Injectable()
export class PasswordService {
  constructor(
    private readonly users: UsersRepository,
    private readonly auth: AuthService,
    private readonly actionTokens: ActionTokenService,
    private readonly mail: MailService,
    @Inject(PASSWORD_CONFIG) private readonly config: PasswordConfig,
  ) {}

  /**
   * 忘記密碼:email 存在(且未停用)則建 password-reset token 並寄重設信;
   * 不存在也靜默成功(ADR-0003:不透露帳號是否存在)。停用者不寄 — 走完流程也不得取得登入 token。
   */
  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.users.findOne(LOOKUP, { email: email.trim() });
    if (!user?.enabled) {
      return;
    }
    const { token, expiresAt } = await this.actionTokens.issue(
      user._id,
      "password-reset",
    );
    await this.mail.sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      link: this.setPasswordLink(token),
      expiresAt,
    });
  }

  /**
   * 寄啟用信(建 activation token,7 天)。**呼叫時機屬第 3 段**(開通租戶、新增使用者,ADR-0009);
   * 本段只提供並以測試覆蓋。啟用逾期不重寄,由使用者走「忘記密碼」自助。
   */
  async sendActivationEmail(userId: Types.ObjectId): Promise<void> {
    const user = await this.users.findById(LOOKUP, userId);
    if (!user) {
      throw new Error(`寄啟用信失敗:使用者 ${String(userId)} 不存在`);
    }
    const { token, expiresAt } = await this.actionTokens.issue(
      user._id,
      "activation",
    );
    await this.mail.sendActivationEmail({
      to: user.email,
      name: user.name,
      link: this.setPasswordLink(token),
      expiresAt,
    });
  }

  /**
   * 以信件 token 設定新密碼(activation / password-reset 皆可):
   * 規則檢查 → token 有效(未用、未逾期;否則 TOKEN_EXPIRED)→ 使用者未停用 → 原子標記已用
   * → 寫入 argon2id 雜湊、清 mustChangePassword → 作廢該帳號全部 refresh → 直接發登入 token(免再登入)。
   * 規則不符時 token 不消耗,可用同一連結再試。
   */
  async setPassword(
    rawToken: string,
    newPassword: string,
  ): Promise<IssuedTokens> {
    assertPasswordRule(newPassword);
    const token = await this.actionTokens.findValid(rawToken);
    if (!token) {
      throw authError(
        "TOKEN_EXPIRED",
        "Action token is invalid, already used or expired",
      );
    }
    const user = await this.auth.loadActiveUser(token.userId);
    if (!(await this.actionTokens.markUsed(token))) {
      throw authError("TOKEN_EXPIRED", "Action token was already used");
    }
    await this.writePassword(user._id, newPassword);
    await this.auth.logoutAllDevices(user);
    return this.auth.issueTokens(user._id, null);
  }

  /**
   * 已登入者改密碼(首登強改亦走此路):目前密碼錯 → INVALID_CREDENTIALS;成功後清 mustChangePassword。
   * 不作廢其他裝置的 session(spec 未要求;需要時使用者可另按「登出所有裝置」)。
   */
  async changePassword(
    user: RequestUser,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    assertPasswordRule(newPassword);
    const isCurrentValid = await verifyPassword(
      user.passwordHash,
      currentPassword,
    );
    if (!isCurrentValid) {
      throw authError("INVALID_CREDENTIALS", "Current password is incorrect");
    }
    await this.writePassword(user._id, newPassword);
  }

  private async writePassword(
    userId: Types.ObjectId,
    newPassword: string,
  ): Promise<void> {
    // argon2id(ADR-0003);@node-rs/argon2 預設即 argon2id,與 seed 同套件
    const passwordHash = await hash(newPassword);
    await this.users.updateById(asAccount(userId), userId, {
      $set: { passwordHash, "settings.mustChangePassword": false },
    });
  }

  /** admin 的「設定新密碼」頁(#61:`/set-password?token=…`,啟用與重設共用)。 */
  private setPasswordLink(token: string): string {
    return `${this.config.adminAppUrl}/set-password?token=${encodeURIComponent(token)}`;
  }
}
