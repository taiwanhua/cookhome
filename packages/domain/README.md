# @repo/domain

前後端共用的**純邏輯**(STRUCT-07):沒有框架依賴、api 與 admin / front 都會用、規則只能有一份。
按主題分資料夾、以子路徑匯出:

```ts
import { validatePassword } from "@repo/domain/password";
```

入包門檻(三個都要符合):①純函式 / 純型別,不碰 React、Nest、Mongoose ②api 與 admin(或 front)都會用 ③兩邊漂移會出事。

新主題 = 新資料夾 `src/<topic>/index.ts`,再到 `package.json` 的 `exports` 與 `typesVersions` 各加一條
(api 以 CommonJS + `moduleResolution: node` 編譯,看不到 `exports`,靠 `typesVersions` 才找得到子路徑的型別)。
