import { Injectable } from "@nestjs/common";

/**
 * 發布步驟 3 / 4 裡每一筆寫入前的檢查點名稱(依寫入順序)。
 * - `permission`:建 / 復活 / 改名一筆欄位級權限(每筆各過一次)
 * - `retire-permission`:把不再宣告的權限標 `retiredAt`(每筆各過一次)
 * - `publish-version`:這一版 `publishing → published`
 * - `retire-previous`:前一個 `published → retired`
 * - `current-version`:`forms.currentVersion` 指向新版(步驟 4 的最後一筆)
 */
export type PublishCheckpoint =
  | "permission"
  | "retire-permission"
  | "publish-version"
  | "retire-previous"
  | "current-version";

/**
 * 發布的檢查點(正式環境什麼都不做)。
 *
 * 為什麼有它:四步發布**不用 Mongo 交易**(ADR-0007;本機與 CI 單節點),一致性靠「任何一步失敗都停在
 * 做到一半的樣子,重試從步驟 3 冪等重跑」。要驗「中途失敗後重試,結果與一次成功相同」,
 * 測試必須能讓某一筆寫入**真的**在半路失敗 —— GraphQL 端點上看不到這個能力,
 * 所以測試經 `app.get(FormPublishHooks)` 讓指定檢查點丟錯(TEST-07 的第二個接縫,理由同上)。
 */
@Injectable()
export class FormPublishHooks {
  private last: PublishCheckpoint | null = null;

  /** 最後走到的檢查點(除錯用)。 */
  get lastCheckpoint(): PublishCheckpoint | null {
    return this.last;
  }

  /** 走到某個檢查點;正式環境只記下來就放行(測試以 spy 在這裡丟錯)。 */
  reached(checkpoint: PublishCheckpoint): Promise<void> {
    this.last = checkpoint;
    return Promise.resolve();
  }
}
