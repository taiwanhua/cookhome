import { Injectable } from "@nestjs/common";
import { Types } from "mongoose";

import { isWildcardKey } from "@repo/domain/permission";

import { AuditService } from "../audit/audit.service";
import type { Persisted } from "../database/base.repository";
import {
  type ModuleDocument,
  ModulesRepository,
  type PermissionDocument,
  PermissionsRepository,
} from "../database/database.module";
import type { OperatorContext } from "../database/operator-context";
import { OwnerProtectionService } from "../orgs/owner-protection.service";
import type { ModuleSidebarType } from "../permission/models/me-module.model";
import type { SetModuleEnabledInput } from "./dto/set-module-enabled.input";
import type { SetPermissionEnabledInput } from "./dto/set-permission-enabled.input";
import {
  type ModuleAdminNode,
  type PermissionAdmin,
} from "./models/module-admin.model";
import { moduleManagerError } from "./module-manager-error";

type ModuleRecord = Persisted<ModuleDocument>;
type PermissionRecord = Persisted<PermissionDocument>;

/** 審計動作名(`docs/modules/module-manager.md` 最後一段;targetType 分別為 module / permission)。 */
const AUDIT = {
  module: { action: "module.toggle-enabled", targetType: "module" },
  permission: {
    action: "permission.toggle-enabled",
    targetType: "permission",
  },
} as const;

/** 模組樹的 `*` 恆排最前,其餘依 key;同層模組依 order 再依 key(與側欄同一個排序)。 */
function comparePermissions(a: PermissionRecord, b: PermissionRecord): number {
  const aWildcard = isWildcardKey(a.key);
  const bWildcard = isWildcardKey(b.key);
  if (aWildcard !== bWildcard) {
    return aWildcard ? -1 : 1;
  }
  return a.key.localeCompare(b.key);
}

function compareModules(a: ModuleRecord, b: ModuleRecord): number {
  return a.order - b.order || a.key.localeCompare(b.key);
}

function toPermissionAdmin(permission: PermissionRecord): PermissionAdmin {
  return {
    id: String(permission._id),
    key: permission.key,
    name: permission.name,
    description: permission.description ?? null,
    enabled: permission.enabled,
  };
}

/**
 * 模組文件 + 權限文件 → 樹。`parentId` 指向的節點不在 `modules` 集合內時(理論上只會發生在
 * 把子樹單獨組出來的情況,如 `setModuleEnabled` 的回傳),該節點就是本次回傳的樹根。
 */
function buildTree(
  modules: ModuleRecord[],
  permissions: PermissionRecord[],
): ModuleAdminNode[] {
  const permissionsByModule = new Map<string, PermissionRecord[]>();
  for (const permission of permissions) {
    const moduleId = String(permission.moduleId);
    permissionsByModule.set(moduleId, [
      ...(permissionsByModule.get(moduleId) ?? []),
      permission,
    ]);
  }
  const nodes = new Map<string, ModuleAdminNode>();
  for (const module of modules.toSorted(compareModules)) {
    nodes.set(String(module._id), {
      id: String(module._id),
      key: module.key,
      name: module.name,
      parentId: module.parentId === null ? null : String(module.parentId),
      // schema 的字串值與 GraphQL enum 的內部值相同(group / link / hidden)
      sidebarType: module.sidebarType as ModuleSidebarType,
      order: module.order,
      description: module.description ?? null,
      enabled: module.enabled,
      permissions: (permissionsByModule.get(String(module._id)) ?? [])
        .toSorted(comparePermissions)
        .map((permission) => toPermissionAdmin(permission)),
      children: [],
    });
  }
  const roots: ModuleAdminNode[] = [];
  for (const node of nodes.values()) {
    const parent =
      node.parentId === null ? undefined : nodes.get(node.parentId);
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

/**
 * 模組與權限(`system.module-manager`,根組織專屬;`docs/modules/module-manager.md`)。
 *
 * **治理面,與 `permission/` 的解析分開**:`PermissionResolver` 回答「**我**進得去哪裡、
 * 能用什麼」(吃 enabled 當過濾條件),這裡回答「平台**宣告**了什麼、哪些開著」
 * (把 enabled 當可寫的狀態)。同一份 `modules` / `permissions` 資料,兩種讀法,
 * 刻意不共用程式 — 共用會逼其中一邊長出「要不要過濾」的旗標參數。
 *
 * 模組樹本身(新增 / 刪除節點)走 code + PR 的 seed(ADR-0002),執行期唯一可變的欄位
 * 就是 `enabled`,所以本服務只有一個查詢與兩個切換。
 */
@Injectable()
export class ModuleManagerService {
  constructor(
    private readonly modules: ModulesRepository,
    private readonly permissions: PermissionsRepository,
    private readonly audit: AuditService,
    private readonly ownerProtection: OwnerProtectionService,
  ) {}

  /**
   * 全樹:含側欄看不到的 hidden 節點與隱藏的 `api` 權限樹,含已停用的模組與權限
   * (停用以 `enabled` 表示,不以「不回」表示 — 不然停用後就再也開不回來了)。
   */
  async tree(operator: OperatorContext): Promise<ModuleAdminNode[]> {
    await this.assertRootOperator(operator, "moduleTree");
    const [modules, permissions] = await Promise.all([
      this.modules.findMany(operator, {}),
      this.permissions.findMany(operator, {}),
    ]);
    return buildTree(modules, permissions);
  }

  /**
   * 模組的停用 / 啟用。**停用連動整棵子樹**:把自己與全部子孫(`ancestors` 含自己者,
   * 物化路徑 ADR-0005)一併寫成 `enabled=false`。
   *
   * 為什麼要真的寫下去,而不是查詢時再看祖先:`PermissionResolver` 確實會連動剔除
   * (`pruneDisabledSubtrees`),但治理面這一頁要顯示每個節點自己的狀態,
   * 而「顯示的值」與「生效的值」分成兩套一定會對不起來(ADR-0002 的 `enabled` 是
   * runtime 唯一可變欄位,一個欄位一個真相)。落庫之後,樹上讀到什麼就是什麼。
   *
   * **啟用只啟用自己這一節**(與組織管理同一條規則):子樹當初為什麼被關掉,
   * 這裡沒有資訊可還原 — 一律由人逐層決定,不會「啟用父模組」就把刻意關掉的子模組打開。
   */
  async setModuleEnabled(
    operator: OperatorContext,
    input: SetModuleEnabledInput,
  ): Promise<ModuleAdminNode> {
    await this.assertRootOperator(operator, AUDIT.module.action);
    const module = await this.requireModule(operator, input.id);
    const before = module.enabled;
    const cascadedKeys = input.enabled
      ? []
      : await this.disableSubtree(operator, module);
    const updated =
      before === input.enabled
        ? module
        : ((await this.modules.updateById(operator, module._id, {
            $set: { enabled: input.enabled },
          })) ?? module);

    await this.audit.record(operator, {
      action: AUDIT.module.action,
      targetType: AUDIT.module.targetType,
      targetId: module._id,
      before: { key: module.key, enabled: before },
      after: {
        key: module.key,
        enabled: input.enabled,
        // 連動關掉的子孫(啟用時恆為空陣列);稽核要看得出這一次到底影響了哪些頁
        cascadedModuleKeys: cascadedKeys,
      },
    });
    return this.subtreeOf(operator, updated);
  }

  /**
   * 權限的停用 / 啟用(全域 kill switch,ADR-0011 步驟 4):停用後任何人都不再持有它,
   * 連超級管理員也不給,`X.*` 也展不出它。不連動任何東西 — 權限沒有樹。
   */
  async setPermissionEnabled(
    operator: OperatorContext,
    input: SetPermissionEnabledInput,
  ): Promise<PermissionAdmin> {
    await this.assertRootOperator(operator, AUDIT.permission.action);
    const permission = await this.requirePermission(operator, input.id);
    const before = permission.enabled;
    const updated =
      before === input.enabled
        ? permission
        : ((await this.permissions.updateById(operator, permission._id, {
            $set: { enabled: input.enabled },
          })) ?? permission);

    await this.audit.record(operator, {
      action: AUDIT.permission.action,
      targetType: AUDIT.permission.targetType,
      targetId: permission._id,
      before: { key: permission.key, enabled: before },
      after: { key: permission.key, enabled: input.enabled },
    });
    return toPermissionAdmin(updated);
  }

  /** 子孫一併停用;回傳這一次實際被連動關掉的模組 key(本來就關著的不算)。 */
  private async disableSubtree(
    operator: OperatorContext,
    module: ModuleRecord,
  ): Promise<string[]> {
    const descendants = await this.modules.findMany(operator, {
      ancestors: module._id,
      enabled: true,
    });
    if (descendants.length === 0) {
      return [];
    }
    await this.modules.updateMany(
      operator,
      { _id: { $in: descendants.map((descendant) => descendant._id) } },
      { $set: { enabled: false } },
    );
    return descendants
      .map((descendant) => descendant.key)
      .toSorted((a, b) => a.localeCompare(b));
  }

  /** 這個模組加上它整棵子樹(切換後的最新狀態),組成一棵以它為根的 `ModuleAdminNode`。 */
  private async subtreeOf(
    operator: OperatorContext,
    module: ModuleRecord,
  ): Promise<ModuleAdminNode> {
    const descendants = await this.modules.findMany(operator, {
      ancestors: module._id,
    });
    const branch = [module, ...descendants];
    const permissions = await this.permissions.findMany(operator, {
      moduleId: { $in: branch.map((node) => node._id) },
    });
    const [root] = buildTree(branch, permissions);
    if (!root) {
      throw new Error(`模組 ${module.key} 組不出子樹(不該發生)`);
    }
    return root;
  }

  /**
   * 模組與權限是根組織專屬(ADR-0009):`@RequirePermission` 守到「有沒有這個權限」,
   * 這一層守「站在哪裡」— 權限可能經角色被帶到別的組織。判斷點與租戶作業共用
   * `OwnerProtectionService.isRootOperator`(當前組織 `parentId === null`),不另寫一套。
   *
   * 與租戶作業不同、**不另外要求管理範圍是 `"all"`**:`modules` / `permissions` 是全表種子
   * 資料、沒掛 tenantScope(`database.module.ts`),寫入不會被管理範圍靜默過濾掉。
   */
  private async assertRootOperator(
    operator: OperatorContext,
    action: string,
  ): Promise<void> {
    if (!(await this.ownerProtection.isRootOperator(operator))) {
      throw moduleManagerError(
        "FORBIDDEN",
        `${action} is only available from the root org`,
      );
    }
  }

  private async requireModule(
    operator: OperatorContext,
    id: string,
  ): Promise<ModuleRecord> {
    const module = Types.ObjectId.isValid(id)
      ? await this.modules.findById(operator, id)
      : null;
    if (module === null) {
      throw moduleManagerError("NOT_FOUND", `Module ${id} not found`);
    }
    return module;
  }

  private async requirePermission(
    operator: OperatorContext,
    id: string,
  ): Promise<PermissionRecord> {
    const permission = Types.ObjectId.isValid(id)
      ? await this.permissions.findById(operator, id)
      : null;
    if (permission === null) {
      throw moduleManagerError("NOT_FOUND", `Permission ${id} not found`);
    }
    return permission;
  }
}
