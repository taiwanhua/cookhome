# 命名(GEN)

## GEN-01 檔案與資料夾一律 kebab-case;元件一個資料夾

`unicorn/filename-case` 強制 kebab-case(`__tests__` 豁免)。元件以資料夾為單位,入口固定 `index.tsx`:

```
✅ packages/ui/src/counter-button/index.tsx
❌ packages/ui/src/CounterButton.tsx
```

## GEN-02 識別符英文,使用者可見文案繁體中文

變數、函數、型別、GraphQL schema 一律英文;渲染到畫面上的文字、錯誤訊息的使用者可讀部分一律繁體中文。

```tsx
✅ const emptyMessage = "還沒有食譜,快來新增第一道菜!";
❌ const 空訊息 = "No recipes yet";
```

## GEN-03 型別 PascalCase;props 介面叫 `XxxProps`;不加 `I` 前綴

```ts
✅ interface LinkProps { … }
❌ interface ILink { … }
```

## GEN-04 布林值用 is / has / should / can 開頭

```ts
✅ const isLoading = …;  const hasError = …;  newTab?: boolean; // 既有例外,沿用
❌ const loading = …;    const error = …;     // 讀不出是布林
```

## GEN-05 自己命名時縮寫詞當一般單字;沿用外部庫的名稱不改

```ts
✅ const apiUrl = …;  function createGraphqlClient() {}   // 自己命名
✅ import { GraphQLClient } from "graphql-request";        // 外部庫,原樣沿用
❌ const APIURL = …;
```

## GEN-06 workspace 套件名一律 `@repo/` 前綴,無例外

apps 與 packages 的 `package.json` name 統一加 scope,避免與 npm 套件撞名(例:app 叫 `storybook` 會和它依賴的 `storybook` 套件衝突)。

```
✅ "@repo/admin"、"@repo/api"、"@repo/ui"
❌ "admin"、"storybook"
```
