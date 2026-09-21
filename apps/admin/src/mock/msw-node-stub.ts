/**
 * `msw/node` 的空殼,只在 mock 模式由 `vite.mock.config.ts` 以 alias 換進來。
 *
 * 為什麼需要:`src/test/msw/server.ts` 在**模組層**呼叫 `setupServer()`,而 msw 的 exports map
 * 對 `./node` 的 `browser` 條件是 `null` —— 瀏覽器端根本載不進那一包,整條夾具鏈會在 Vite
 * 解析時就炸。夾具檔實際用到的只有同檔的 `api`(`graphql.link(...)`);`server` 只出現在
 * 型別位置(`Parameters<typeof import("./server").server.use>`,編譯後即消失),
 * 所以這個空殼的方法不會被呼叫到。
 *
 * 不改 `src/test/msw/server.ts` 是刻意的:那支是 jest 測試的正本(TEST-08),
 * 讓它去遷就 mock 模式只會讓測試那一端變複雜。
 */
const noop = (): void => {
  /* 空殼:mock 模式不存在 node 端的假伺服器 */
};

export const setupServer = () => ({
  use: noop,
  listen: noop,
  close: noop,
  resetHandlers: noop,
  events: { removeAllListeners: noop },
});
