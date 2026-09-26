/**
 * 流程管理的模組 key 與權限 key(正本 `docs/modules/workflows.md`「模組 key 與權限表」,seed
 * `apps/db-migrator/seeds/modules/system.ts`)。**不是**根組織專屬:root 管共用流程、租戶管理員管自己的
 * 客製流程;「是不是自己的流程 / 站在根組織」由 api 算在 `workflow.abilities`,前端直接用、不再相乘。
 */
export const WORKFLOWS_MODULE_KEY = "system.workflows";

/** 阻擋清單(隱藏頁):路由節點兼權限容器,改派 / 新增審核者 / 重試推進綁在它底下。 */
export const WORKFLOWS_BLOCKED_PAGE_KEY = `${WORKFLOWS_MODULE_KEY}.blocked-page`;

export const WORKFLOWS_PERMISSIONS = {
  view: `${WORKFLOWS_MODULE_KEY}.view`,
  /** 建流程:站在根組織 = 共用、站在租戶內 = 客製 */
  create: `${WORKFLOWS_MODULE_KEY}.create`,
  edit: `${WORKFLOWS_MODULE_KEY}.edit`,
  publish: `${WORKFLOWS_MODULE_KEY}.publish`,
  assign: `${WORKFLOWS_MODULE_KEY}.assign`,
  /** 阻擋清單、改派、新增審核者、重試推進(不靠父模組 wildcard) */
  reassign: `${WORKFLOWS_BLOCKED_PAGE_KEY}.reassign`,
} as const;
