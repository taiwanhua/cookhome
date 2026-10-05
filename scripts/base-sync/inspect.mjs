/**
 * `inspect`:唯讀。核對專案身分與採用版本,逐檔列出 from..to 的完整差異與維護歸屬,
 * 包含 Git 不會報衝突、合併時會被自動套入的變更。不 fetch、不寫任何 ref;缺少的 commit 由呼叫端先依 SOP 取得。
 */
import { classifyFiles } from "./classify.mjs";
import { fail } from "./errors.mjs";
import {
  FULL_SHA,
  commitExists,
  diffFiles,
  git,
  isAncestor,
  requireRepositoryRoot,
} from "./git.mjs";
import { loadProject } from "./identity.mjs";

export function inspect(options) {
  const root = requireRepositoryRoot(options.project, "--project");
  // 身分與採用版本取自已提交的 HEAD,不讀工作樹裡未提交的值
  const head = git(root, ["rev-parse", "--verify", "HEAD^{commit}"]);
  const project = loadProject(root, { ref: head, requireUpstream: false });
  for (const [name, sha] of [
    ["--from", options.from],
    ["--to", options.to],
  ]) {
    if (!FULL_SHA.test(sha)) fail(`${name} 必須是完整 40 位 commit SHA`);
    if (!commitExists(root, sha)) {
      fail(
        `${name} 的 commit 不在 ${project.label} 的本機歷史;先依 deployment 取得底座版本`,
      );
    }
  }
  const { adopted } = project;
  if (
    !commitExists(root, adopted.commit) ||
    !isAncestor(root, adopted.commit, head)
  ) {
    fail(
      `${project.label} 的 wowgoBase.commit 不是目前 HEAD 的祖先;採用記錄與實際 ancestry 不符`,
    );
  }
  return {
    schemaVersion: 1,
    command: "inspect",
    project: { repository: project.repository, root, commit: head },
    adopted,
    from: options.from,
    to: options.to,
    files: classifyFiles(diffFiles(root, options.from, options.to)),
  };
}
