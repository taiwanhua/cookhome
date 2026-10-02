import { fields as baseFields } from "../../../seeds/base/fields";
import { formModuleDeclaration } from "../../../seeds/base/form-module-declaration";
import {
  type ModuleSeedDeclaration,
  permissionKey,
} from "../../../seeds/base/module-declaration";
import type {
  ProjectSeedSettings,
  SeedSource,
} from "../../../seeds/base/seed-source";
import {
  type SeedDocumentSet,
  type SeedRelationSet,
  seedRef,
} from "../../../src/seed/seed-declaration";

/**
 * 夾具:一個**非空的專案來源**(正式的 `seeds/project/` 目前是空的)。用來驗兩方來源的組裝:
 * 專案模組掛在底座父節點底下、根組織專屬的繼承、模板納入專案模組、專案普通種子引用底座、
 * 條目層級的引用排序、重複關聯去重。內容只供測試,不是任何正式專案的設定。
 */

/** 專案初值:根組織另取名、說明清空、給時區;兩個底座模組指定初值。 */
export const fixtureProjectSettings: ProjectSeedSettings = {
  rootOrg: {
    name: "專案甲營運中心",
    description: null,
    settings: { timezone: "Asia/Taipei" },
  },
  moduleInitialValues: {
    "demo.sample-two": { enabled: false, icon: "star" },
    "demo-form": {
      settings: { list: { columns: [], builtin: { status: false } } },
    },
    overview: { icon: null },
  },
};

export const PROJECT_REPORT_KEY = "demo.project-report";
export const PROJECT_AUDIT_KEY = "system.project-audit";
export const PROJECT_FORM_KEY = "project-form";

/** 掛在底座 `demo` 群組底下的專案模組(一般模組:租戶看得到)。 */
const projectReportModule: ModuleSeedDeclaration = {
  nodes: [
    {
      key: PROJECT_REPORT_KEY,
      name: "專案報表",
      sidebarType: "link",
      parentKey: "demo",
      order: 9,
      route: "project-report",
      icon: "chart",
      settings: { defaultRange: "month" },
    },
    {
      key: `${PROJECT_REPORT_KEY}.view-page`,
      name: "報表詳情",
      sidebarType: "hidden",
      parentKey: PROJECT_REPORT_KEY,
      order: 1,
      route: "view-page",
    },
  ],
  permissions: [
    {
      key: permissionKey(PROJECT_REPORT_KEY, "view"),
      moduleKey: PROJECT_REPORT_KEY,
      name: "檢視",
    },
    {
      key: permissionKey(PROJECT_REPORT_KEY, "export"),
      moduleKey: PROJECT_REPORT_KEY,
      name: "匯出",
    },
  ],
  dataScopeTarget: {
    collection: "project_reports",
    name: "專案報表",
    fields: [{ name: "kind", label: "種類", type: "string" }],
  },
};

/** 掛在底座 `system` 群組底下、根組織專屬的專案模組;子節點沒有自己標 isRootOnly,靠繼承。 */
const projectAuditModule: ModuleSeedDeclaration = {
  nodes: [
    {
      key: PROJECT_AUDIT_KEY,
      name: "專案稽核",
      sidebarType: "link",
      parentKey: "system",
      order: 20,
      route: "project-audit",
      isRootOnly: true,
    },
    {
      key: `${PROJECT_AUDIT_KEY}.ops`,
      name: "稽核作業",
      sidebarType: "hidden",
      parentKey: PROJECT_AUDIT_KEY,
      order: 1,
    },
  ],
  permissions: [
    {
      key: permissionKey(`${PROJECT_AUDIT_KEY}.ops`, "purge"),
      moduleKey: `${PROJECT_AUDIT_KEY}.ops`,
      name: "清除稽核紀錄",
    },
  ],
};

/** 專案的表單模組(頂層):沿用底座的 helper。 */
const projectFormModule = formModuleDeclaration({
  key: PROJECT_FORM_KEY,
  name: "專案申請",
  parentKey: null,
  route: "project-form",
  order: 30,
  icon: "description",
  description: "專案夾具的表單模組",
  settings: { list: { builtin: { status: true } } },
});

/**
 * 專案的普通種子。`child` 宣告在 `parent` 前面、又引用它:組裝時要以條目為單位排序,
 * 不能只排整個 set。兩筆都引用底座的種子(根組織、性別類別)。
 */
const projectReportTypes: SeedDocumentSet = {
  kind: "documents",
  collection: "project_report_types",
  entries: [
    {
      key: "child",
      data: {
        name: "子類型",
        parentId: seedRef("project_report_types", "parent"),
        orgId: seedRef("orgs", "root"),
        enabled: true,
      },
    },
    {
      key: "parent",
      data: {
        name: "母類型",
        parentId: null,
        categoryId: seedRef("field_categories", "gender"),
        relatedIds: [seedRef("orgs", "root"), seedRef("roles", "tenant-admin")],
        enabled: true,
      },
    },
  ],
};

/** 專案在底座既有的類別底下多種一個全域選項(同一個 collection 沿用底座的認養政策)。 */
const projectFieldOptions: SeedDocumentSet = {
  ...baseFields,
  entries: [
    {
      key: "demo-category.dessert",
      data: {
        categoryId: seedRef("field_categories", "demo-category"),
        orgId: null,
        value: "dessert",
        label: "甜點",
        order: 4,
        enabled: true,
      },
    },
  ],
};

const projectRoles: SeedDocumentSet = {
  kind: "documents",
  collection: "roles",
  entries: [
    {
      key: "project-auditor",
      data: {
        name: "專案稽核員",
        description: "專案夾具的種子角色",
        enabled: true,
        settings: {},
      },
    },
  ],
};

/** 專案角色的關聯;最後一筆與底座宣告的完全相同,組裝時去重。 */
const projectRoleRelations: SeedRelationSet = {
  kind: "relations",
  entries: [
    {
      type: "org_role",
      first: { collection: "orgs", key: "root" },
      second: { collection: "roles", key: "project-auditor" },
    },
    {
      type: "role_module",
      first: { collection: "roles", key: "project-auditor" },
      second: { collection: "modules", key: PROJECT_AUDIT_KEY },
    },
    {
      type: "org_role",
      first: { collection: "orgs", key: "root" },
      second: { collection: "roles", key: "super-admin" },
    },
  ],
};

export const fixtureProjectSource: SeedSource = {
  moduleDeclarations: [
    projectReportModule,
    projectAuditModule,
    projectFormModule,
  ],
  seeds: [
    // 關聯宣告在它引用的角色前面:順序由組裝排
    projectRoleRelations,
    projectRoles,
    projectReportTypes,
    projectFieldOptions,
  ],
};
