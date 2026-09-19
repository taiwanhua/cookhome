import type { OperatorContext } from "../operator-context";

/**
 * **plugin(schema 層)與 DataScopeService(Nest 層)之間的接縫**(ADR-0008 的執行面)。
 *
 * 為什麼需要這個介面:資料範圍規則要在**查詢中介層**套用才繞不過(與租戶保底同一個位置),
 * 但中介層是 Mongoose schema 層的東西 — schema 在模組 import 時就定義完,那時還沒有 Nest 容器,
 * 讓 plugin 直接 import DataScopeService 會把資料層綁死在 Nest 上(也會產生迴圈相依)。
 * 因此方向反過來:**資料層定義介面,`data-scope/` 在 Nest 啟動時把實作註冊進來**。
 *
 * 沒有註冊實作時(如 `base.repository.test.ts` 那種不起 Nest 的單元測試)規則不套 —
 * 租戶保底仍然在,安全性不因此打折;規則是「在保底之內再縮小」,少套只會看得比較多,
 * 而能看到的上限永遠是可見範圍。正式執行路徑由 `AppModule` 匯入 `DataScopeModule` 保證有實作。
 */
export interface DataScopeRuleProvider {
  /**
   * 回傳該 collection 對此操作者要 **AND** 進查詢的條件;沒有規則命中 → `null`
   * (ADR-0008:「沒有規則命中操作者 → 預設 = 可見範圍內」)。
   */
  conditionFor(
    collection: string,
    operator: OperatorContext,
  ): Promise<Record<string, unknown> | null>;
}

let registered: DataScopeRuleProvider | undefined;

/** 由 `DataScopeService` 在 Nest 啟動時呼叫;傳 `undefined` 解除註冊(app 關閉時)。 */
export function setDataScopeRuleProvider(
  provider: DataScopeRuleProvider | undefined,
): void {
  registered = provider;
}

export function getDataScopeRuleProvider(): DataScopeRuleProvider | undefined {
  return registered;
}
