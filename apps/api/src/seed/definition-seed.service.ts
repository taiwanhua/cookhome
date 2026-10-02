import { Injectable, Logger } from "@nestjs/common";

import {
  type DefinitionSeedError,
  type DefinitionSeedItemResult,
  type DefinitionSeedRequest,
  type DefinitionSeedResult,
  type DefinitionSeedSet,
  definitionSeedId,
} from "@repo/domain/seed";

import { DefinitionInstaller, type SeedRun } from "./definition-installer";
import { SeedLockVerifier } from "./seed-lock.verifier";
import { SeedOperatorService, SeedRequestError } from "./seed-operator.service";

/** 安裝一筆定義時、原服務或資料庫丟出的失敗(不是衝突):停在做到一半的樣子,重跑會接續。 */
const APPLY_FAILED = "APPLY_FAILED";

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * 受管定義的程序介面(`@repo/domain/seed` 的 `DefinitionSeedRequest` → `DefinitionSeedResult`)。
 * 這是 CLI(`seed/run.ts`)背後唯一的入口,沒有 HTTP 或 GraphQL 端點。
 *
 * 一份請求的順序:
 * 1. 核對共用互斥鎖的 owner(只核對,不搶鎖)
 * 2. 解析真實操作者並驗這次會用到的既有權限(resolver 的 decorator 在這裡不會執行)
 * 3. `apply`:先對整批做零寫入預檢,有任何衝突就整批不寫;通過後依序安裝,每一筆之前再核對一次鎖,
 *    遇到第一個衝突或失敗就停(後面的宣告可能引用它)
 * 4. `inspect`:逐筆核對映射與凍結內容,不寫入
 *
 * 不會丟例外:失敗一律放進結果的 `errors` / 各筆的 `conflict`,由呼叫端判定整批失敗。
 */
@Injectable()
export class DefinitionSeedService {
  private readonly logger = new Logger(DefinitionSeedService.name);

  constructor(
    private readonly lock: SeedLockVerifier,
    private readonly operator: SeedOperatorService,
    private readonly installer: DefinitionInstaller,
  ) {}

  async execute(request: DefinitionSeedRequest): Promise<DefinitionSeedResult> {
    let run: SeedRun;
    try {
      await this.lock.assertHeldBy(request.lockOwner);
      run = {
        runId: request.runId,
        releaseCommit: request.releaseCommit,
        facts: await this.operator.resolve(this.permissionsOf(request)),
      };
    } catch (error) {
      if (error instanceof SeedRequestError) {
        return {
          results: [],
          errors: [{ code: error.code, message: error.message }],
        };
      }
      throw error;
    }
    return request.operation === "inspect"
      ? this.inspect(request, run)
      : this.apply(request, run);
  }

  /** 這份請求實際會用到的既有權限(依宣告的種類與操作)。 */
  private permissionsOf(request: DefinitionSeedRequest): string[] {
    return [
      ...new Set(
        request.seeds.flatMap((seed) =>
          this.installer.permissionsFor(seed, request.operation),
        ),
      ),
    ];
  }

  private async inspect(
    request: DefinitionSeedRequest,
    run: SeedRun,
  ): Promise<DefinitionSeedResult> {
    const results: DefinitionSeedItemResult[] = [];
    const errors: DefinitionSeedError[] = [];
    for (const seed of request.seeds) {
      try {
        await this.lock.assertHeldBy(request.lockOwner);
        results.push(await this.installer.inspect(run, seed));
      } catch (error) {
        errors.push(this.errorOf(seed, error, "INSPECT_FAILED"));
        break;
      }
    }
    return { results, errors };
  }

  private async apply(
    request: DefinitionSeedRequest,
    run: SeedRun,
  ): Promise<DefinitionSeedResult> {
    let conflicts: DefinitionSeedItemResult[];
    try {
      conflicts = await this.preflight(request, run);
    } catch (error) {
      this.logger.error(
        `預檢失敗:${messageOf(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      return {
        results: [],
        errors: [{ code: APPLY_FAILED, message: messageOf(error) }],
      };
    }
    if (conflicts.length > 0) {
      return { results: conflicts, errors: [] };
    }
    const results: DefinitionSeedItemResult[] = [];
    const errors: DefinitionSeedError[] = [];
    for (const seed of request.seeds) {
      try {
        // 每次續步核對 owner:鎖被換手後不再往下寫
        await this.lock.assertHeldBy(request.lockOwner);
        const result = await this.installer.apply(run, seed);
        results.push(result);
        if (result.conflict !== null) {
          break;
        }
      } catch (error) {
        errors.push(this.errorOf(seed, error, APPLY_FAILED));
        break;
      }
    }
    return { results, errors };
  }

  /**
   * 整批零寫入預檢:回全部衝突。同一份請求裡同一個 key 出現第二次時不預檢
   * (它的前提是前一筆裝完之後的狀態),留到輪到它時再判斷。
   */
  private async preflight(
    request: DefinitionSeedRequest,
    run: SeedRun,
  ): Promise<DefinitionSeedItemResult[]> {
    const conflicts: DefinitionSeedItemResult[] = [];
    const seen = new Set<string>();
    for (const seed of request.seeds) {
      const identity = `${seed.kind}:${seed.key}`;
      if (seen.has(identity)) {
        continue;
      }
      seen.add(identity);
      const conflict = await this.installer.preflight(run, seed);
      if (conflict !== null) {
        conflicts.push(conflict);
      }
    }
    return conflicts;
  }

  private errorOf(
    seed: DefinitionSeedSet,
    error: unknown,
    fallbackCode: string,
  ): DefinitionSeedError {
    this.logger.error(
      `${definitionSeedId(seed)} 失敗:${messageOf(error)}`,
      error instanceof Error ? error.stack : undefined,
    );
    return {
      code: error instanceof SeedRequestError ? error.code : fallbackCode,
      message: messageOf(error),
      kind: seed.kind,
      key: seed.key,
      revision: seed.revision,
    };
  }
}
