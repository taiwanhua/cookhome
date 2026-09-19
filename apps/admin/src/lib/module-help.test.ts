import { describe, expect, it } from "@jest/globals";

import {
  buildHelpRegistry,
  moduleKeyFromHelpPath,
  stripLeadingTitle,
} from "./module-help";

describe("moduleKeyFromHelpPath(檔名 → 模組 key)", () => {
  it("取檔名去掉 .help.md,點號是 key 的一部分", () => {
    expect(
      moduleKeyFromHelpPath("/src/md/module-help/system.org-manager.help.md"),
    ).toBe("system.org-manager");
    expect(
      moduleKeyFromHelpPath("/src/md/module-help/demo.sub.sample-one.help.md"),
    ).toBe("demo.sub.sample-one");
    expect(moduleKeyFromHelpPath("/src/md/module-help/overview.help.md")).toBe(
      "overview",
    );
  });

  it("不是 help.md 的路徑回 null", () => {
    expect(moduleKeyFromHelpPath("/src/md/module-help/README.md")).toBeNull();
    expect(moduleKeyFromHelpPath("/src/md/module-help/.help.md")).toBeNull();
  });
});

describe("stripLeadingTitle(彈窗標題已有模組名,內文不再重複一次)", () => {
  it("拔掉開頭的 `# 模組名`,從第一個小節開始", () => {
    const markdown =
      "# 角色管理\n\n## 這個模組做什麼\n\n角色是一組權限的集合。";

    expect(stripLeadingTitle(markdown)).toBe(
      "## 這個模組做什麼\n\n角色是一組權限的集合。",
    );
  });

  it("開頭不是 h1 就原樣保留(含內文中間的 h1)", () => {
    const markdown = "## 這個模組做什麼\n\n內文\n\n# 中間的大標";

    expect(stripLeadingTitle(markdown)).toBe(markdown);
  });
});

describe("buildHelpRegistry(glob 產物 → 模組 key 對照表)", () => {
  it("每個檔案一筆,內容已去掉開頭標題", () => {
    const registry = buildHelpRegistry({
      "/src/md/module-help/overview.help.md":
        "# 總覽\n\n## 這個模組做什麼\n\n看重點。",
      "/src/md/module-help/system.org-manager.help.md":
        "## 這個模組做什麼\n\n管組織。",
    });

    expect([...registry.keys()].toSorted((a, b) => a.localeCompare(b))).toEqual(
      ["overview", "system.org-manager"],
    );
    expect(registry.get("overview")).toBe("## 這個模組做什麼\n\n看重點。");
  });

  it("空白的、或只有標題的 help.md 當作沒有說明,不收進表裡", () => {
    const registry = buildHelpRegistry({
      "/src/md/module-help/blank.help.md": "   \n\n",
      "/src/md/module-help/title-only.help.md": "# 只有標題\n",
      "/src/md/module-help/ok.help.md": "## 有內容\n\n嗨。",
    });

    expect([...registry.keys()]).toEqual(["ok"]);
  });
});
