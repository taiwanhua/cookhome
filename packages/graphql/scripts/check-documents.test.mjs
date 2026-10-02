import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  cpSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { DOCUMENT_ZONES, checkDocuments } from "./check-documents.mjs";

const { dirname, join, resolve } = path;
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = join(packageRoot, "scripts", "check-documents.mjs");
const productionRoot = join(packageRoot, "src", "documents");

/**
 * 在暫存目錄建一棵 documents 樹(鍵是相對 `documents/` 的路徑),跑完整棵刪掉;
 * 臨時文件不進 `src/documents`。
 */
function withDocuments(t, files) {
  const root = mkdtempSync(join(tmpdir(), "graphql-documents-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const documentsRoot = join(root, "documents");
  mkdirSync(documentsRoot);
  for (const [path, content] of Object.entries(files)) {
    const file = join(documentsRoot, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
  }
  return { root, documentsRoot };
}

function check(t, files) {
  const { root, documentsRoot } = withDocuments(t, files);
  return checkDocuments({ documentsRoot, relativeTo: root });
}

const RECIPES = "query Recipes {\n  recipes {\n    id\n  }\n}\n";

test("正例:兩個來源與子目錄的具名 operation / fragment 都收進來", (t) => {
  const result = check(t, {
    "base/auth.graphql":
      "query Me {\n  me {\n    id\n  }\n}\n\nfragment OrgFields on Org {\n  id\n}\n",
    "base/system/orgs.graphql": "mutation CreateOrg {\n  createOrg\n}\n",
    "project/recipes.graphql": RECIPES,
    "project/shop/orders/list.graphql": "query Orders {\n  orders\n}\n",
  });

  assert.deepEqual(result.errors, []);
  assert.deepEqual(
    result.definitions.map((definition) => ({
      kind: definition.kind,
      name: definition.name,
      zone: definition.zone,
      path: definition.path,
    })),
    [
      {
        kind: "operation",
        name: "Me",
        zone: "base",
        path: "documents/base/auth.graphql",
      },
      {
        kind: "fragment",
        name: "OrgFields",
        zone: "base",
        path: "documents/base/auth.graphql",
      },
      {
        kind: "operation",
        name: "CreateOrg",
        zone: "base",
        path: "documents/base/system/orgs.graphql",
      },
      {
        kind: "operation",
        name: "Recipes",
        zone: "project",
        path: "documents/project/recipes.graphql",
      },
      {
        kind: "operation",
        name: "Orders",
        zone: "project",
        path: "documents/project/shop/orders/list.graphql",
      },
    ],
  );
});

test("檔名不是 operation 的身分:兩來源同檔名、不同 operation 名可並存", (t) => {
  const result = check(t, {
    "base/list.graphql": "query BaseList {\n  recipes {\n    id\n  }\n}\n",
    "project/list.graphql":
      "query ProjectList {\n  recipes {\n    id\n  }\n}\n",
    "project/sub/list.graphql":
      "query ProjectSubList {\n  recipes {\n    id\n  }\n}\n",
  });

  assert.deepEqual(result.errors, []);
});

test("operation 與 fragment 各自一個命名空間,同名不算碰撞", (t) => {
  const result = check(t, {
    "base/orgs.graphql":
      "query Org {\n  org {\n    ...Org\n  }\n}\n\nfragment Org on Org {\n  id\n}\n",
  });

  assert.deepEqual(result.errors, []);
});

test("專案來源目錄不存在或是空的都可以", (t) => {
  assert.deepEqual(check(t, { "base/recipes.graphql": RECIPES }).errors, []);

  const { root, documentsRoot } = withDocuments(t, {
    "base/recipes.graphql": RECIPES,
  });
  mkdirSync(join(documentsRoot, "project"));
  assert.deepEqual(
    checkDocuments({ documentsRoot, relativeTo: root }).errors,
    [],
  );
});

test("同來源重名:不同檔的同名 operation 被拒,列出兩個路徑", (t) => {
  const result = check(t, {
    "base/recipes.graphql": RECIPES,
    "base/kitchen/recipes.graphql":
      "query Recipes {\n  recipes {\n    title\n  }\n}\n",
  });

  assert.deepEqual(result.errors, [
    "operation「Recipes」重複定義:documents/base/kitchen/recipes.graphql:1:1(base)、documents/base/recipes.graphql:1:1(base)",
  ]);
});

test("同一個檔內重名也被拒", (t) => {
  const result = check(t, {
    "project/recipes.graphql": `${RECIPES}\n${RECIPES}`,
  });

  assert.deepEqual(result.errors, [
    "operation「Recipes」重複定義:documents/project/recipes.graphql:1:1(project)、documents/project/recipes.graphql:7:1(project)",
  ]);
});

test("跨來源重名:內容完全相同也被拒,不以檔案順序決定勝者", (t) => {
  const result = check(t, {
    "base/recipes.graphql": RECIPES,
    "project/recipes.graphql": RECIPES,
  });

  assert.deepEqual(result.errors, [
    "operation「Recipes」重複定義:documents/base/recipes.graphql:1:1(base)、documents/project/recipes.graphql:1:1(project)",
  ]);
});

test("query 與 mutation 共用 operation 命名空間", (t) => {
  const result = check(t, {
    "base/recipes.graphql": RECIPES,
    "project/recipes.graphql": "mutation Recipes {\n  createRecipe\n}\n",
  });

  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /^operation「Recipes」重複定義:/);
});

test("跨來源 fragment 重名被拒,列出兩個路徑與行號", (t) => {
  const fragment = "fragment RecipeFields on Recipe {\n  id\n}\n";
  const result = check(t, {
    "base/fragments.graphql": fragment,
    "project/shop/fragments.graphql": `${RECIPES}\n${fragment}`,
  });

  assert.deepEqual(result.errors, [
    "fragment「RecipeFields」重複定義:documents/base/fragments.graphql:1:1(base)、documents/project/shop/fragments.graphql:7:1(project)",
  ]);
});

test("三個以上來源重名時全部列出,且一次回報所有問題", (t) => {
  const result = check(t, {
    "base/a.graphql": RECIPES,
    "base/b.graphql": RECIPES,
    "project/c.graphql": `${RECIPES}\nquery {\n  recipes {\n    id\n  }\n}\n`,
  });

  assert.deepEqual(result.errors, [
    "documents/project/c.graphql:7:1(project):匿名 operation 不可登記,請替它命名",
    "operation「Recipes」重複定義:documents/base/a.graphql:1:1(base)、documents/base/b.graphql:1:1(base)、documents/project/c.graphql:1:1(project)",
  ]);
});

test("匿名 operation 被拒(簡寫與 query 關鍵字兩種寫法)", (t) => {
  const result = check(t, {
    "base/shorthand.graphql": "{\n  recipes {\n    id\n  }\n}\n",
    "project/keyword.graphql": "query {\n  recipes {\n    id\n  }\n}\n",
  });

  assert.deepEqual(result.errors, [
    "documents/base/shorthand.graphql:1:1(base):匿名 operation 不可登記,請替它命名",
    "documents/project/keyword.graphql:1:1(project):匿名 operation 不可登記,請替它命名",
  ]);
});

test("來源根目錄散落的文件被拒", (t) => {
  const result = check(t, {
    "recipes.graphql": RECIPES,
    "base/auth.graphql": "query Me {\n  me {\n    id\n  }\n}\n",
  });

  assert.deepEqual(result.errors, [
    "documents/recipes.graphql:文件必須放在 base/ 或 project/ 底下,不可散落在來源根目錄",
  ]);
});

test("base / project 以外的目錄被拒", (t) => {
  const result = check(t, {
    "shared/deep/recipes.graphql": RECIPES,
  });

  assert.deepEqual(result.errors, [
    "documents/shared/deep/recipes.graphql:未知的來源區域「shared」,文件必須放在 base/ 或 project/ 底下",
  ]);
});

test("語法錯誤與非 operation / fragment 的定義附來源診斷", (t) => {
  const result = check(t, {
    "base/broken.graphql": "query Broken {\n  recipes {\n",
    "project/sub/schema.graphql": `${RECIPES}\ntype Recipe {\n  id: ID!\n}\n`,
  });

  assert.equal(result.errors.length, 2);
  assert.match(
    result.errors[0],
    /^documents\/base\/broken\.graphql:3:1\(base\):GraphQL 語法錯誤:/,
  );
  assert.equal(
    result.errors[1],
    "documents/project/sub/schema.graphql:7:1(project):只能放 operation 或 fragment,不可放 ObjectTypeDefinition",
  );
});

test("來源根目錄不存在時明確失敗", (t) => {
  const { root } = withDocuments(t, {});
  const result = checkDocuments({
    documentsRoot: join(root, "missing"),
    relativeTo: root,
  });

  assert.deepEqual(result.errors, ["missing:找不到 GraphQL 文件來源根目錄"]);
});

test("CLI:有問題時 exit 1、錯誤寫到 stderr;沒問題時 exit 0", (t) => {
  const bad = withDocuments(t, {
    "base/recipes.graphql": RECIPES,
    "project/recipes.graphql": RECIPES,
  });
  const failed = spawnSync(process.execPath, [cliPath, bad.documentsRoot], {
    cwd: bad.root,
    encoding: "utf8",
  });
  assert.equal(failed.status, 1);
  assert.match(failed.stderr, /operation「Recipes」重複定義/);
  assert.match(failed.stderr, /base\/recipes\.graphql:1:1\(base\)/);
  assert.match(failed.stderr, /project\/recipes\.graphql:1:1\(project\)/);

  const good = withDocuments(t, { "project/recipes.graphql": RECIPES });
  const passed = spawnSync(process.execPath, [cliPath, good.documentsRoot], {
    cwd: good.root,
    encoding: "utf8",
  });
  assert.equal(passed.status, 0);
  assert.equal(passed.stderr, "");
});

test("專案新增文件與子目錄不必動底座,既有定義照舊", (t) => {
  const { root, documentsRoot } = withDocuments(t, {
    "base/auth.graphql": "query Me {\n  me {\n    id\n  }\n}\n",
  });
  const before = checkDocuments({ documentsRoot, relativeTo: root });

  mkdirSync(join(documentsRoot, "project", "shop", "reports"), {
    recursive: true,
  });
  writeFileSync(
    join(documentsRoot, "project", "orders.graphql"),
    "query Orders {\n  orders\n}\n\nfragment OrderFields on Order {\n  id\n}\n",
  );
  writeFileSync(
    join(documentsRoot, "project", "shop", "reports", "monthly.graphql"),
    "mutation CloseMonth {\n  closeMonth\n}\n",
  );
  const after = checkDocuments({ documentsRoot, relativeTo: root });

  assert.deepEqual(before.errors, []);
  assert.deepEqual(after.errors, []);
  assert.deepEqual(
    after.definitions.filter(({ zone }) => zone === "base"),
    before.definitions,
  );
  assert.deepEqual(
    after.definitions
      .filter(({ zone }) => zone === "project")
      .map(({ kind, name }) => `${kind}:${name}`),
    ["operation:Orders", "fragment:OrderFields", "operation:CloseMonth"],
  );
});

/** 來源樹外放一份與底座同名的文件,供連結指過去:跟進去就會多出一個沒被擋的重名。 */
function withLinkTarget(t) {
  const { root, documentsRoot } = withDocuments(t, {
    "base/recipes.graphql": RECIPES,
    "project/orders.graphql": "query Orders {\n  orders\n}\n",
  });
  const outside = join(root, "outside");
  mkdirSync(outside);
  writeFileSync(join(outside, "recipes.graphql"), RECIPES);
  return { root, documentsRoot, outside };
}

test("來源樹裡連到目錄的連結被拒,不跟進去也不略過", (t) => {
  const { root, documentsRoot, outside } = withLinkTarget(t);
  // Windows 建 junction 不需要額外權限;其他平台忽略這個型別,建的就是 symbolic link
  symlinkSync(outside, join(documentsRoot, "project", "linked"), "junction");

  const result = checkDocuments({ documentsRoot, relativeTo: root });

  assert.deepEqual(result.errors, [
    "documents/project/linked:文件來源不可使用 symbolic link,請改放實際檔案或目錄",
  ]);
  assert.deepEqual(
    result.definitions.map(({ name }) => name),
    ["Recipes", "Orders"],
  );
});

test("來源樹裡連到檔案的 symbolic link 被拒", (t) => {
  const { root, documentsRoot, outside } = withLinkTarget(t);
  try {
    symlinkSync(
      join(outside, "recipes.graphql"),
      join(documentsRoot, "project", "linked.graphql"),
      "file",
    );
  } catch (error) {
    // Windows 沒有開發人員模式或系統管理員權限時建不了檔案的 symbolic link;其他平台不該失敗
    if (process.platform !== "win32" || error.code !== "EPERM") throw error;
    t.skip("此環境沒有建立 symbolic link 的權限");
    return;
  }

  const result = checkDocuments({ documentsRoot, relativeTo: root });

  assert.deepEqual(result.errors, [
    "documents/project/linked.graphql:文件來源不可使用 symbolic link,請改放實際檔案或目錄",
  ]);
  assert.deepEqual(
    result.definitions.map(({ name }) => name),
    ["Recipes", "Orders"],
  );
});

test("正式來源:通過檢查,每個定義都落在合法分區", () => {
  const result = checkDocuments({
    documentsRoot: productionRoot,
    relativeTo: packageRoot,
  });

  assert.deepEqual(result.errors, []);
  assert.ok(result.definitions.length > 0);
  for (const { zone, path: documentPath } of result.definitions) {
    assert.ok(DOCUMENT_ZONES.includes(zone));
    assert.ok(documentPath.startsWith(`src/documents/${zone}/`));
  }
});

const SENTINEL = "// 既有產物:generate 失敗時不可被改寫\n";

/**
 * 隔離的 generate 工作區:複製正式的 package.json、codegen.ts、scripts/ 與真 schema,
 * 目錄形狀與 repo 相同(codegen.ts 以相對路徑找 schema),文件來源與產物都只在暫存目錄。
 * `node_modules` 連回正式套件目錄,不另外安裝。
 */
function withGenerateWorkspace(t, files) {
  const root = mkdtempSync(join(tmpdir(), "graphql-generate-"));
  const workspace = join(root, "packages", "graphql");
  const modulesLink = join(workspace, "node_modules");
  t.after(() => {
    // 先拆連結並確認拆掉了才刪暫存目錄,不順著連結刪到正式的 node_modules
    if (lstatSync(modulesLink, { throwIfNoEntry: false })) {
      unlinkSync(modulesLink);
    }
    rmSync(root, { recursive: true, force: true });
  });

  mkdirSync(join(root, "apps", "api"), { recursive: true });
  copyFileSync(
    resolve(packageRoot, "..", "..", "apps", "api", "schema.gql"),
    join(root, "apps", "api", "schema.gql"),
  );
  mkdirSync(workspace, { recursive: true });
  for (const name of ["package.json", "codegen.ts"]) {
    copyFileSync(join(packageRoot, name), join(workspace, name));
  }
  cpSync(join(packageRoot, "scripts"), join(workspace, "scripts"), {
    recursive: true,
  });
  symlinkSync(join(packageRoot, "node_modules"), modulesLink, "junction");

  for (const [name, content] of Object.entries(files)) {
    const file = join(workspace, "src", "documents", name);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
  }
  const output = join(workspace, "src", "generated", "index.ts");
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, SENTINEL);

  return { workspace, output };
}

/** 照 package.json 的 `generate` 原文執行(與 `pnpm run generate` 同一串指令)。 */
function runGenerate(workspace) {
  const { scripts } = JSON.parse(
    readFileSync(join(workspace, "package.json"), "utf8"),
  );
  const pathKey =
    Object.keys(process.env).find((key) => key.toLowerCase() === "path") ??
    "PATH";
  const bin = join(packageRoot, "node_modules", ".bin");
  return spawnSync(scripts.generate, {
    cwd: workspace,
    shell: true,
    encoding: "utf8",
    env: {
      ...process.env,
      [pathKey]: `${bin}${path.delimiter}${process.env[pathKey] ?? ""}`,
    },
  });
}

// 跑真 schema 的 fixture 只用底座固定的 `me`,專案換業務時這組測試照樣成立
const BASE_FIXTURE = "query BaseFixtureViewerId {\n  me {\n    id\n  }\n}\n";

test("真 generate:兩來源重名時失敗,既有產物完全沒被動到", (t) => {
  const { workspace, output } = withGenerateWorkspace(t, {
    "base/fixture-viewer.graphql": BASE_FIXTURE,
    "project/fixture/viewer.graphql": BASE_FIXTURE,
  });

  const result = runGenerate(workspace);

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /operation「BaseFixtureViewerId」重複定義:src\/documents\/base\/fixture-viewer\.graphql:1:1\(base\)、src\/documents\/project\/fixture\/viewer\.graphql:1:1\(project\)/,
  );
  assert.equal(readFileSync(output, "utf8"), SENTINEL);
  assert.deepEqual(readdirSync(dirname(output)), ["index.ts"]);
});

test("真 generate:正式 codegen 設定與真 schema,底座與專案子目錄的文件都產出 hook", (t) => {
  const { workspace, output } = withGenerateWorkspace(t, {
    "base/fixture-viewer.graphql": BASE_FIXTURE,
    "project/fixture/shop/viewer-name.graphql":
      "query ProjectFixtureViewerName {\n  me {\n    name\n  }\n}\n",
  });

  const result = runGenerate(workspace);

  assert.equal(result.status, 0, result.stderr);
  const content = readFileSync(output, "utf8");
  assert.match(content, /export const useBaseFixtureViewerIdQuery = /);
  assert.match(content, /export const useProjectFixtureViewerNameQuery = /);
  // 管線最後一段的 fix-generated 也跑到了
  assert.doesNotMatch(content, /graphql-request\/dist\/types\.dom/);
});
