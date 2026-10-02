import { describe, expect, it } from "@jest/globals";

import type {
  DefinitionSeedSet,
  FormDefinitionSeedSet,
  SeedSet,
} from "@repo/domain/seed";

import {
  type MigrationSource,
  type SeedSnapshot,
  UpdatePlanError,
  buildUpdatePlan,
} from "./plan";

/** `buildUpdatePlan` 的純計畫行為(不碰資料庫、不讀檔)。 */

const HASH = `sha256:${"a".repeat(64)}`;

function migration(
  fileName: string,
  overrides: Partial<MigrationSource> = {},
): MigrationSource {
  const hasDependencies = (overrides.seedDependencies ?? []).length > 0;
  return {
    fileName,
    origin: "project",
    filePath: `/repo/migrations/project/${fileName}`,
    sourceHash: HASH,
    seedDependencies: [],
    exports: {
      up: true,
      down: false,
      appliesTo: hasDependencies,
      assertSeedInstallable: hasDependencies,
      verify: hasDependencies,
    },
    ...overrides,
  };
}

function workflow(key: string, revision: string): DefinitionSeedSet {
  return {
    kind: "workflow-definition",
    key,
    revision,
    name: `流程 ${key}`,
    changelog: revision,
    desiredStatus: "published",
    checkFormKey: null,
    definition: {
      steps: [
        {
          key: "boss",
          name: "主管",
          assignee: { kind: "manager", level: 1 },
          mode: "any",
        },
      ],
    },
  };
}

function note(key: string, parentKey?: string): SeedSet {
  return {
    kind: "documents",
    collection: "plan_notes",
    entries: [
      {
        key,
        data:
          parentKey === undefined
            ? { name: key }
            : {
                name: key,
                parentId: {
                  $seedRef: { collection: "plan_notes", key: parentKey },
                },
              },
      },
    ],
  };
}

function snapshot(
  path: string,
  seed: SeedSet,
  requiresSeeds: string[] = [],
): SeedSnapshot {
  return { path, fileHash: HASH, seed, requiresSeeds };
}

function problemsOf(build: () => unknown): readonly string[] {
  try {
    build();
  } catch (error) {
    if (error instanceof UpdatePlanError) {
      return error.problems;
    }
    throw error;
  }
  return [];
}

const FLOW_R1 = "project/revisions/plan_flow.r1.seed.ts";
const FLOW_R2 = "project/revisions/plan_flow.r2.seed.ts";
const NOTE_A = "base/revisions/note-a.n1.seed.ts";
const NOTE_B = "project/revisions/note-b.n1.seed.ts";

describe("buildUpdatePlan", () => {
  it("依完整 filename 排序;已在 changelog 的不再待處理,來源已不存在的紀錄只列出", () => {
    const applied = [
      { fileName: "20260101000000_data_first.js", appliedAt: new Date(0) },
      { fileName: "20250101000000_data_gone.js", appliedAt: new Date(0) },
    ];
    const plan = buildUpdatePlan({
      current: [],
      snapshots: [],
      // 同一個時間戳、不同 basename 是合法的
      migrations: [
        migration("20260201000000_schema_b.js", { origin: "base" }),
        migration("20260201000000_data_a.js"),
        migration("20260101000000_data_first.js", { origin: "legacy" }),
      ],
      applied,
    });

    expect(plan.sources.map(({ fileName }) => fileName)).toEqual([
      "20260101000000_data_first.js",
      "20260201000000_data_a.js",
      "20260201000000_schema_b.js",
    ]);
    expect(plan.pending.map(({ source }) => source.fileName)).toEqual([
      "20260201000000_data_a.js",
      "20260201000000_schema_b.js",
    ]);
    expect(plan.applied).toEqual([applied[0]]);
    expect(plan.orphaned).toEqual([applied[1]]);
    expect(plan.planHash).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("依賴閉包:遞迴前置排在前面、每份只出現一次;定義附上兩個 hash", () => {
    const plan = buildUpdatePlan({
      current: [],
      snapshots: [
        snapshot(FLOW_R2, workflow("plan_flow", "r2"), [NOTE_B, NOTE_A]),
        snapshot(NOTE_B, note("b", "a"), [NOTE_A]),
        snapshot(NOTE_A, note("a")),
      ],
      migrations: [
        migration("20260201000000_data_a.js", {
          seedDependencies: [FLOW_R2, NOTE_A],
        }),
      ],
      applied: [],
    });

    const [planned] = plan.pending;
    expect(planned?.dependencies.map(({ path }) => path)).toEqual([
      NOTE_A,
      NOTE_B,
      FLOW_R2,
    ]);
    expect(planned?.dependencies.map(({ hashes }) => hashes !== null)).toEqual([
      false,
      false,
      true,
    ]);
  });

  it("計畫 hash 隨來源內容改變:migration、快照或目前的種子任何一項不同就不同", () => {
    const base = {
      current: [note("current")],
      snapshots: [snapshot(NOTE_A, note("a"))],
      migrations: [
        migration("20260201000000_data_a.js", { seedDependencies: [NOTE_A] }),
      ],
      applied: [],
    };
    const { planHash } = buildUpdatePlan(base);

    expect(buildUpdatePlan(base).planHash).toBe(planHash);
    expect(
      buildUpdatePlan({ ...base, current: [note("changed")] }).planHash,
    ).not.toBe(planHash);
    expect(
      buildUpdatePlan({
        ...base,
        snapshots: [{ ...snapshot(NOTE_A, note("a")), fileHash: "sha256:b" }],
      }).planHash,
    ).not.toBe(planHash);
    expect(
      buildUpdatePlan({
        ...base,
        migrations: base.migrations.map((item) => ({
          ...item,
          sourceHash: "sha256:c",
        })),
      }).planHash,
    ).not.toBe(planHash);
  });

  it("basename 在兩個來源重複、檔名不合規約、沒有 up:拒絕並列出全部問題", () => {
    const problems = problemsOf(() =>
      buildUpdatePlan({
        current: [],
        snapshots: [],
        migrations: [
          migration("20260201000000_data_a.js", { origin: "base" }),
          migration("20260201000000_data_a.js"),
          migration("20260201_data_short.js"),
          migration("20260301000000_data_no-up.js", {
            exports: {
              up: false,
              down: true,
              appliesTo: false,
              assertSeedInstallable: false,
              verify: false,
            },
          }),
        ],
        applied: [],
      }),
    );

    expect(problems).toEqual([
      "project:20260201_data_short.js 不符合命名規約 <時間戳>_<schema|data|cleanup>_<kebab-case>.js",
      "project:20260301000000_data_no-up.js 沒有 export up",
      expect.stringContaining("migration 檔名重複"),
    ]);
  });

  it("有 seed 依賴必須同時有三個檢查函式;已執行過的 migration 也照樣檢查依賴", () => {
    const problems = problemsOf(() =>
      buildUpdatePlan({
        current: [],
        snapshots: [],
        migrations: [
          migration("20260201000000_data_a.js", {
            seedDependencies: [NOTE_A],
            exports: {
              up: true,
              down: false,
              appliesTo: true,
              assertSeedInstallable: false,
              verify: false,
            },
          }),
        ],
        applied: [
          { fileName: "20260201000000_data_a.js", appliedAt: new Date(0) },
        ],
      }),
    );

    expect(problems).toEqual([
      "project:20260201000000_data_a.js 有 seedDependencies,必須同時 export assertSeedInstallable、verify",
      `project:20260201000000_data_a.js 依賴的快照 ${NOTE_A} 不存在`,
    ]);
  });

  it("快照循環、前置不存在、路徑不合法、root 初始帳號當快照:拒絕", () => {
    const problems = problemsOf(() =>
      buildUpdatePlan({
        current: [],
        snapshots: [
          snapshot(NOTE_A, note("a"), [NOTE_B]),
          snapshot(NOTE_B, note("b"), [
            NOTE_A,
            "project/revisions/gone.seed.ts",
          ]),
          snapshot(
            "base/revisions/root.seed.ts",
            { kind: "root-admin", orgKey: "root", roleKey: "super-admin" },
            ["../escape.seed.ts"],
          ),
        ],
        migrations: [
          migration("20260201000000_data_a.js", { seedDependencies: [NOTE_A] }),
        ],
        applied: [],
      }),
    );

    expect(problems).toEqual(
      expect.arrayContaining([
        `快照依賴循環:${NOTE_A} → ${NOTE_B} → ${NOTE_A}`,
        `快照 ${NOTE_B} 的前置 project/revisions/gone.seed.ts 不存在`,
        expect.stringContaining("「../escape.seed.ts」不合法"),
        expect.stringContaining("是 root 初始帳號"),
      ]),
    );
  });

  it("同一個 revision 有兩份快照、或目前 registry 的內容與快照不同:拒絕(同 revision 不可變)", () => {
    const changed = { ...workflow("plan_flow", "r1"), name: "改過名稱" };
    const problems = problemsOf(() =>
      buildUpdatePlan({
        current: [changed],
        snapshots: [
          snapshot(FLOW_R1, workflow("plan_flow", "r1")),
          snapshot(
            "base/revisions/plan_flow.r1.seed.ts",
            workflow("plan_flow", "r1"),
          ),
          snapshot(FLOW_R2, workflow("plan_flow", "r1")),
        ],
        migrations: [],
        applied: [],
      }),
    );

    expect(problems).toEqual(
      expect.arrayContaining([
        expect.stringContaining("workflow-definition:plan_flow@r1 有兩份快照"),
        `快照 ${FLOW_R2} 的內容是 workflow-definition:plan_flow@r1,檔名必須是 plan_flow.r1.seed.ts`,
        expect.stringContaining(
          "workflow-definition:plan_flow@r1 在目前 registry 的內容與快照",
        ),
      ]),
    );
  });

  it("普通種子前置的引用必須在依賴閉包內", () => {
    const problems = problemsOf(() =>
      buildUpdatePlan({
        current: [],
        snapshots: [snapshot(NOTE_B, note("b", "a"))],
        migrations: [
          migration("20260201000000_data_a.js", { seedDependencies: [NOTE_B] }),
        ],
        applied: [],
      }),
    );

    expect(problems).toEqual([
      expect.stringContaining("project:20260201000000_data_a.js 的依賴閉包:"),
    ]);
    expect(problems[0]).toContain("找不到種子文件 plan_notes.a");
  });
});

/** 一張掛在 `plan-form` 模組的共用表單;`extra` 可加欄位或帶入來源。 */
function form(
  key: string,
  revision: string,
  extra: {
    fields?: FormDefinitionSeedSet["definition"]["fields"];
    prefillFrom?: string;
  } = {},
): FormDefinitionSeedSet {
  return {
    kind: "form-definition",
    key,
    revision,
    name: `表單 ${key}`,
    changelog: revision,
    desiredStatus: "published",
    moduleKey: "plan-form",
    tabLabelTemplate: null,
    definition: {
      fields: [
        {
          key: "title",
          label: "主旨",
          type: "text",
          widget: { kind: "textField" },
          valueSource: { kind: "input" },
        },
        ...(extra.fields ?? []),
      ],
      layout: {
        sections: [
          {
            key: "basic",
            title: "基本資料",
            rows: [{ cols: [{ fieldKey: "title", span: 12 }] }],
          },
        ],
      },
      summaryMap: { title: "title" },
      prefills:
        extra.prefillFrom === undefined
          ? []
          : [
              {
                label: "帶入",
                source: {
                  provider: "form_submission",
                  labelField: "title",
                  formKey: extra.prefillFrom,
                },
                mapping: [{ sourceField: "title", fieldKey: "title" }],
              },
            ],
    },
  };
}

/** 表單模組的普通種子快照(歷史定義引用的模組要在同一個依賴閉包裡)。 */
const formModule: SeedSet = {
  kind: "documents",
  collection: "modules",
  entries: [{ key: "plan-form", data: { name: "表單", engine: "form" } }],
};

const MODULE = "base/revisions/plan-form-module.m1.seed.ts";
const FORM_R2 = "project/revisions/plan_form.r2.seed.ts";
const FORM_R3 = "project/revisions/plan_form.r3.seed.ts";
const OTHER_R1 = "project/revisions/plan_other.r1.seed.ts";
const FLOW_ON_FORM = "project/revisions/plan_check.r1.seed.ts";
const MIGRATION_V2 = "20260201000000_data_form-v2.js";
const MIGRATION_V3 = "20260301000000_data_form-v3.js";

describe("buildUpdatePlan:歷史定義的依賴閉包在寫入之前驗完", () => {
  it("合法的歷史閉包:同一個 key 的不同 revision 分屬兩支 migration,各自的閉包自足;順序照 requiresSeeds", () => {
    const plan = buildUpdatePlan({
      // 目前 registry 只登記第三版(模組由目前的宣告提供)
      current: [formModule, form("plan_form", "r3")],
      snapshots: [
        snapshot(MODULE, formModule),
        snapshot(FORM_R2, form("plan_form", "r2"), [MODULE]),
        snapshot(FORM_R3, form("plan_form", "r3"), [MODULE]),
      ],
      migrations: [
        migration(MIGRATION_V2, { seedDependencies: [FORM_R2] }),
        migration(MIGRATION_V3, { seedDependencies: [FORM_R3] }),
      ],
      applied: [],
    });

    expect(
      plan.pending.map(({ dependencies }) =>
        dependencies.map(({ path }) => path),
      ),
    ).toEqual([
      [MODULE, FORM_R2],
      [MODULE, FORM_R3],
    ]);
  });

  it("歷史定義引用的模組不在它的依賴閉包裡:拒絕,即使目前的 registry 有宣告那個模組", () => {
    const problems = problemsOf(() =>
      buildUpdatePlan({
        current: [formModule, form("plan_form", "r3")],
        snapshots: [snapshot(FORM_R2, form("plan_form", "r2"))],
        migrations: [migration(MIGRATION_V2, { seedDependencies: [FORM_R2] })],
        applied: [],
      }),
    );

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(`project:${MIGRATION_V2} 的依賴閉包:`);
    expect(problems[0]).toContain("form-definition:plan_form@r2");
    expect(problems[0]).toContain("plan-form");
  });

  it("歷史定義帶著寫死的環境 id(reference 欄位的固定預設值):拒絕", () => {
    const withFixedId = form("plan_form", "r2", {
      fields: [
        {
          key: "owner",
          label: "負責人",
          type: "reference",
          widget: { kind: "referencePicker" },
          valueSource: { kind: "input" },
          source: { provider: "user", labelField: "name" },
          default: { kind: "constant", value: "0123456789abcdef01234567" },
        },
      ],
    });
    const problems = problemsOf(() =>
      buildUpdatePlan({
        current: [formModule, form("plan_form", "r3")],
        snapshots: [
          snapshot(MODULE, formModule),
          snapshot(FORM_R2, withFixedId, [MODULE]),
        ],
        migrations: [migration(MIGRATION_V2, { seedDependencies: [FORM_R2] })],
        applied: [],
      }),
    );

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(`project:${MIGRATION_V2} 的依賴閉包:`);
    expect(problems[0]).toContain("form-definition:plan_form@r2");
    expect(problems[0]).toContain("fields.1.default");
  });

  it("歷史定義之間互相引用成環(兩張表單互相帶入):拒絕", () => {
    const problems = problemsOf(() =>
      buildUpdatePlan({
        current: [],
        snapshots: [
          snapshot(MODULE, formModule),
          snapshot(
            FORM_R2,
            form("plan_form", "r2", { prefillFrom: "plan_other" }),
            [MODULE],
          ),
          snapshot(
            OTHER_R1,
            form("plan_other", "r1", { prefillFrom: "plan_form" }),
            [MODULE],
          ),
        ],
        migrations: [
          migration(MIGRATION_V2, { seedDependencies: [FORM_R2, OTHER_R1] }),
        ],
        applied: [],
      }),
    );

    expect(problems).toEqual([
      expect.stringContaining(
        `project:${MIGRATION_V2} 的依賴閉包:種子引用循環:`,
      ),
    ]);
  });

  it("引用的定義不在閉包裡、或宣告順序把它排在使用者後面:拒絕;以 requiresSeeds 排對了就通過", () => {
    const check = {
      ...workflow("plan_check", "r1"),
      checkFormKey: "plan_form",
    };
    const base = {
      current: [],
      applied: [],
      migrations: [
        migration(MIGRATION_V2, { seedDependencies: [FLOW_ON_FORM, FORM_R2] }),
      ],
    };

    // 流程引用的表單根本不在閉包裡
    const missing = problemsOf(() =>
      buildUpdatePlan({
        ...base,
        snapshots: [snapshot(FLOW_ON_FORM, check)],
        migrations: [
          migration(MIGRATION_V2, { seedDependencies: [FLOW_ON_FORM] }),
        ],
      }),
    );
    expect(missing).toHaveLength(1);
    expect(missing[0]).toContain("workflow-definition:plan_check@r1");
    expect(missing[0]).toContain("plan_form");

    // 兩份都在,但流程沒有把表單列為前置,安裝順序會是流程在前
    const snapshots = [
      snapshot(MODULE, formModule),
      snapshot(FORM_R2, form("plan_form", "r2"), [MODULE]),
    ];
    const misordered = problemsOf(() =>
      buildUpdatePlan({
        ...base,
        snapshots: [...snapshots, snapshot(FLOW_ON_FORM, check)],
      }),
    );
    expect(misordered).toEqual([
      `project:${MIGRATION_V2} 的依賴閉包:workflow-definition:plan_check@r1 引用的 form-definition:plan_form@r2 排在它後面;請在快照的 requiresSeeds 列出前置(安裝順序照 requiresSeeds,不自動重排)`,
    ]);

    const plan = buildUpdatePlan({
      ...base,
      snapshots: [...snapshots, snapshot(FLOW_ON_FORM, check, [FORM_R2])],
    });
    expect(plan.pending[0]?.dependencies.map(({ path }) => path)).toEqual([
      MODULE,
      FORM_R2,
      FLOW_ON_FORM,
    ]);
  });
});
