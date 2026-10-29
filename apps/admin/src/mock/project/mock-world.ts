import type { ProjectMockWorld } from "../mock-world-source";

/**
 * 專案的 mock world(mock 開發模式要看到的專案模組與它們的假 api;型別與規則見 `mock-world-source.ts`)。
 * 由 `mock/mock-world.ts` 併入;底座版為空。
 */
export const projectMockWorld: ProjectMockWorld = {
  modules: () => [],
  handlers: () => [],
};
