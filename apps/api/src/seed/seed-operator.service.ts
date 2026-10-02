import { Injectable } from "@nestjs/common";

import { OperatorContextService } from "../auth/operator-context.service";
import { LOOKUP } from "../auth/password/account-operator";
import { OrgsRepository, UsersRepository } from "../database/database.module";
import {
  FormAccessService,
  type FormOperatorFacts,
} from "../forms/form-access.service";
import { OwnerProtectionService } from "../orgs/owner-protection.service";

/** 環境變數:該環境 root 初始管理員的帳號(普通 root seed 建的那一個;`docs/env-registry.md`)。 */
export const ROOT_ADMIN_ACCOUNT_ENV = "ROOT_ADMIN_ACCOUNT";

export const SEED_REQUEST_ERROR_CODES = [
  /** 沒有可用的操作者:未設定帳號、帳號不存在(普通 root seed 還沒跑)或沒有根組織。 */
  "OPERATOR_UNAVAILABLE",
  /** 帳號已停用。 */
  "OPERATOR_DISABLED",
  /** 帳號不是站在根組織的操作者(不是根組織成員,或管理範圍不是全部)。 */
  "OPERATOR_NOT_ROOT",
  /** 帳號缺少這次操作需要的既有權限。 */
  "OPERATOR_FORBIDDEN",
  /** 資料庫裡沒有共用互斥鎖(最外層命令沒有持鎖)。 */
  "LOCK_NOT_HELD",
  /** 鎖的 owner 不是請求帶來的那一個。 */
  "LOCK_OWNER_MISMATCH",
] as const;

export type SeedRequestErrorCode = (typeof SEED_REQUEST_ERROR_CODES)[number];

/** 不屬於單一定義的失敗(操作者不適用、鎖不符);發生在任何寫入之前,整份請求停止。 */
export class SeedRequestError extends Error {
  override name = "SeedRequestError";

  constructor(
    readonly code: SeedRequestErrorCode,
    message: string,
  ) {
    super(message);
  }
}

/**
 * 安裝受管定義的操作者:**該環境實際存在的 root 管理員**。
 *
 * 以 `ROOT_ADMIN_ACCOUNT` 查啟用中的帳號(登入線「以帳號定位」的同一種非租戶查詢),交給登入線的
 * `OperatorContextService` 算出操作者上下文,再由表單引擎的 `FormAccessService` 算事實 —— 與登入後
 * 每個請求走的是同一條路。這裡不建帳號、不改密碼、不指派角色,也不拼湊一份「看起來像超管」的上下文:
 * 帳號不存在、停用、不在根組織或權限不足都在任何寫入之前停止。
 */
@Injectable()
export class SeedOperatorService {
  constructor(
    private readonly users: UsersRepository,
    private readonly orgs: OrgsRepository,
    private readonly operatorContext: OperatorContextService,
    private readonly access: FormAccessService,
    private readonly ownerProtection: OwnerProtectionService,
  ) {}

  /** 解析操作者並確認他持有 `requiredPermissions` 的每一筆;不符丟 `SeedRequestError`。 */
  async resolve(
    requiredPermissions: readonly string[],
  ): Promise<FormOperatorFacts> {
    const account = (process.env[ROOT_ADMIN_ACCOUNT_ENV] ?? "").trim();
    if (account === "") {
      throw new SeedRequestError(
        "OPERATOR_UNAVAILABLE",
        `未設定 ${ROOT_ADMIN_ACCOUNT_ENV}:安裝受管定義需要該環境的 root 管理員帳號`,
      );
    }
    const user = await this.users.findOne(LOOKUP, { account });
    if (user === null) {
      throw new SeedRequestError(
        "OPERATOR_UNAVAILABLE",
        `帳號 ${account} 不存在:請先完成普通 root seed 再安裝受管定義`,
      );
    }
    if (!user.enabled) {
      throw new SeedRequestError("OPERATOR_DISABLED", `帳號 ${account} 已停用`);
    }
    const root = await this.orgs.findOne(LOOKUP, { parentId: null });
    if (root === null) {
      throw new SeedRequestError(
        "OPERATOR_UNAVAILABLE",
        "資料庫沒有根組織:請先完成普通 root seed",
      );
    }
    // 登入線在指定的組織不是所屬組織時會退回第一個所屬組織,所以解析後要再確認真的站在根組織
    const { operator } = await this.operatorContext.resolve(user._id, root._id);
    const facts = await this.access.factsOf(operator);
    if (
      operator.currentOrgId?.equals(root._id) !== true ||
      !facts.isRoot ||
      !(await this.ownerProtection.canActAsRoot(operator))
    ) {
      throw new SeedRequestError(
        "OPERATOR_NOT_ROOT",
        `帳號 ${account} 不是站在根組織的操作者(須為根組織成員且管理範圍為全部)`,
      );
    }
    const missing = requiredPermissions.filter(
      (key) => !this.access.has(facts, key),
    );
    if (missing.length > 0) {
      throw new SeedRequestError(
        "OPERATOR_FORBIDDEN",
        `帳號 ${account} 缺少權限:${missing.join("、")}`,
      );
    }
    return facts;
  }
}
