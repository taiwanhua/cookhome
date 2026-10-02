import { Module } from "@nestjs/common";

import { PROJECT_API_MODULES } from "./api-modules";

/**
 * 專案功能的入口:普通的 Nest module,匯入 `api-modules.ts` 列出的每個專案功能。
 * 只新增功能;核心 module / provider 的替換不在這個接縫裡。
 */
@Module({
  imports: PROJECT_API_MODULES.map((feature) => feature.module),
})
export class ProjectModule {}
