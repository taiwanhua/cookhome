# @repo/domain

前後端共用的**純邏輯**(STRUCT-07):沒有框架依賴、api 與 admin / front 都會用、規則只能有一份。
按主題分資料夾、以子路徑匯出:

```ts
import { validatePassword } from "@repo/domain/password";
```

入包門檻(三個都要符合):①純函式 / 純型別,不碰 React、Nest、Mongoose ②api 與 admin(或 front)都會用 ③兩邊漂移會出事。

新主題 = 新資料夾 `src/<topic>/index.ts`,再到 `package.json` 的 `exports` 與 `typesVersions` 各加一條
(api 以 CommonJS + `moduleResolution: node` 編譯,看不到 `exports`,靠 `typesVersions` 才找得到子路徑的型別)。

## `workflow`:給執行端(api)的合約

`@repo/domain/workflow` 的 `advance` 只回「要做的動作」,寫入由 api 執行。兩條執行端一定要守的規則(完整說明在 `src/workflow/advance.ts` 檔頭):

- **實例建立時為版本的每個節點建一筆 `pending` 的 `StepState`**(`initialStepStates(definition)`),之後只改欄位、不增刪元素 —— 推進的條件更新是對 `steps` 陣列元素下條件,元素不存在條件就永遠不成立。
- **同一輪內 `updateInstance` 的條件不成立就中止本輪**,重讀再呼叫 `advance`;其他動作的條件不成立代表已做過,照常往下。`invalidState` = 權威資料自相矛盾,不寫、記 log、留在「需要推進」等人工處理。
