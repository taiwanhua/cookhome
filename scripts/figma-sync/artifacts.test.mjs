import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

import {
  assertPathSegment,
  hashArtifact,
  readArtifact,
  readReceipt,
  receiptPath,
  writeArtifact,
  writeExecutionSource,
  writeVerifiedReceipt,
} from "./artifacts.mjs";
import { CONSUMER_FILE, contract, createScenario } from "./test-support.mjs";

const code = (expected) => (error) => {
  assert.equal(error.name, "FigmaSyncError");
  assert.equal(error.code, expected, error.message);
  return true;
};
const tmp = () => mkdtempSync(path.join(tmpdir(), "figma-sync-artifacts-"));
const scenario = await createScenario();
const first = await scenario.sync("art-1");
const second = await scenario.sync("art-2", {
  previousReceipt: first.verdict.receipt,
});
const inventory = first.inventory;
const receipt1 = first.verdict.receipt;
const receipt2 = second.verdict.receipt;

test("hashArtifact:canonical JSON 的 SHA-256,與檔案排版無關", () => {
  const runDir = tmp();
  const written = writeArtifact({
    runDir,
    name: "inventory-consumer.json",
    artifact: inventory,
  });
  assert.equal(written.kind, "inventory");
  assert.equal(written.digest, hashArtifact(inventory));
  assert.equal(written.digest, contract.digest(inventory));
  const compact = path.join(runDir, "compact.json");
  writeFileSync(compact, JSON.stringify(inventory));
  assert.equal(hashArtifact(readArtifact(compact)), written.digest);
  assert.match(
    readFileSync(written.path, "utf8"),
    /^\{\n  "schemaVersion": 1,/,
  );
});

test("run 內首次新增固定檔名;相同內容重寫冪等,不同內容拒絕覆蓋", () => {
  const runDir = tmp();
  const name = "inventory-consumer.json";
  const written = writeArtifact({ runDir, name, artifact: inventory });
  const bytes = readFileSync(written.path);
  assert.deepEqual(
    writeArtifact({ runDir, name, artifact: inventory }),
    written,
  );
  const other = { ...inventory, generatedAt: "2030-01-01T00:00:00Z" };
  assert.throws(
    () => writeArtifact({ runDir, name, artifact: other }),
    code("ARTIFACT_EXISTS"),
  );
  assert.deepEqual(readFileSync(written.path), bytes);
  // 輸入 snapshot 放 inputs/,原樣保存
  const input = writeArtifact({
    runDir,
    name: `inputs/${name}`,
    artifact: inventory,
  });
  assert.equal(input.digest, written.digest);
  // 不留暫存檔
  assert.deepEqual(readdirSync(runDir).sort(), ["inputs", name]);
});

test("檔名只接受固定清單,kind 只允許三個 targetKind;不接任意路徑", () => {
  const runDir = tmp();
  for (const name of [
    "inventory.json",
    "inventory-other.json",
    "../inventory-consumer.json",
    "inputs/../plan.json",
    "inputs/plan.json",
    "plan.json.bak",
    "scan-consumer.js",
    "anything.json",
  ]) {
    assert.throws(
      () => writeArtifact({ runDir, name, artifact: inventory }),
      code("ARTIFACT_NAME_INVALID"),
    );
  }
  assert.throws(
    () =>
      writeArtifact({ runDir, name: "plan.json", artifact: { kind: "plan" } }),
    code("ARTIFACT_INVALID"),
  );
  assert.deepEqual(readdirSync(runDir), []);
});

test("生成 JS:digest 取完整 UTF-8 bytes;同名不同內容拒絕", () => {
  const runDir = tmp();
  const source = "// 中文註解\nreturn 1;\n";
  const written = writeExecutionSource({ runDir, name: "execute.js", source });
  assert.equal(written.kind, "execution-source");
  assert.equal(
    written.digest,
    createHash("sha256").update(Buffer.from(source, "utf8")).digest("hex"),
  );
  assert.deepEqual(readFileSync(written.path), Buffer.from(source, "utf8"));
  assert.deepEqual(
    writeExecutionSource({ runDir, name: "execute.js", source }),
    written,
  );
  assert.throws(
    () =>
      writeExecutionSource({
        runDir,
        name: "execute.js",
        source: `${source} `,
      }),
    code("ARTIFACT_EXISTS"),
  );
  assert.throws(
    () => writeExecutionSource({ runDir, name: "run.js", source }),
    code("ARTIFACT_NAME_INVALID"),
  );
  assert.notEqual(
    writeExecutionSource({
      runDir,
      name: "scan-consumer.js",
      source: `${source} `,
    }).digest,
    written.digest,
  );
});

test("readArtifact:壞 JSON 與不合協定的內容都拒絕", () => {
  const dir = tmp();
  const broken = path.join(dir, "broken.json");
  writeFileSync(broken, "{ not json");
  assert.throws(() => readArtifact(broken), code("ARTIFACT_UNREADABLE"));
  assert.throws(
    () => readArtifact(path.join(dir, "missing.json")),
    code("ARTIFACT_UNREADABLE"),
  );
  const wrong = path.join(dir, "wrong.json");
  writeFileSync(wrong, JSON.stringify({ ...inventory, kind: "snapshot" }));
  assert.throws(() => readArtifact(wrong), code("ARTIFACT_INVALID"));
});

test("路徑片段:拒絕 slash、dot segment、控制字元", () => {
  for (const value of [
    "",
    ".",
    "..",
    "a/b",
    "a\\b",
    ".hidden",
    "a b",
    "a\nb",
    "a\u0000b",
    7,
  ]) {
    assert.throws(
      () => assertPathSegment(value, "FILE_KEY_INVALID"),
      code("FILE_KEY_INVALID"),
    );
  }
  assert.equal(
    assertPathSegment("3iVrNZst71aih3och6yW66", "X"),
    "3iVrNZst71aih3och6yW66",
  );
  assert.throws(
    () => receiptPath(tmp(), "../escape"),
    code("FILE_KEY_INVALID"),
  );
});

test("receipt CAS:無 previous 時檔案必須不存在;同目錄暫存後原子落地", () => {
  const rootDir = tmp();
  const written = writeVerifiedReceipt({
    rootDir,
    receipt: receipt1,
    expectedPreviousDigest: null,
  });
  assert.equal(written.written, true);
  assert.equal(
    written.path,
    path.join(
      rootDir,
      "deploy/project/figma/receipts",
      `${CONSUMER_FILE}.json`,
    ),
  );
  assert.equal(written.digest, hashArtifact(receipt1));
  assert.deepEqual(readdirSync(path.dirname(written.path)), [
    `${CONSUMER_FILE}.json`,
  ]);
  assert.equal(hashArtifact(readArtifact(written.path)), written.digest);
  // 相同結果重送:不再 CAS
  const again = writeVerifiedReceipt({
    rootDir,
    receipt: receipt1,
    expectedPreviousDigest: null,
  });
  assert.equal(again.written, false);
  // 另一份「也是第一份」的結果:磁碟已有其他內容 → 不覆蓋
  const rival = { ...receipt1, runId: "rival" };
  assert.throws(
    () =>
      writeVerifiedReceipt({
        rootDir,
        receipt: rival,
        expectedPreviousDigest: null,
      }),
    code("RECEIPT_CHANGED"),
  );
  assert.equal(hashArtifact(readArtifact(written.path)), written.digest);
});

test("receipt CAS:expectedPreviousDigest 必須等於磁碟現值;不以舊結果回退", () => {
  const rootDir = tmp();
  const previous = hashArtifact(receipt1);
  // previous 不存在卻聲稱有
  assert.throws(
    () =>
      writeVerifiedReceipt({
        rootDir,
        receipt: receipt2,
        expectedPreviousDigest: previous,
      }),
    code("RECEIPT_CHANGED"),
  );
  assert.equal(existsSync(receiptPath(rootDir, CONSUMER_FILE)), false);
  writeVerifiedReceipt({
    rootDir,
    receipt: receipt1,
    expectedPreviousDigest: null,
  });
  const updated = writeVerifiedReceipt({
    rootDir,
    receipt: receipt2,
    expectedPreviousDigest: previous,
  });
  assert.equal(updated.written, true);
  assert.equal(
    hashArtifact(readArtifact(updated.path)),
    hashArtifact(receipt2),
  );
  assert.equal(
    writeVerifiedReceipt({
      rootDir,
      receipt: receipt2,
      expectedPreviousDigest: previous,
    }).written,
    false,
  );
  // 重送舊結果:磁碟已是後續結果 → RECEIPT_CHANGED,不回退
  assert.throws(
    () =>
      writeVerifiedReceipt({
        rootDir,
        receipt: receipt1,
        expectedPreviousDigest: null,
      }),
    code("RECEIPT_CHANGED"),
  );
  // receipt 自己記的 previous 與 CAS 預期不一致
  assert.throws(
    () =>
      writeVerifiedReceipt({
        rootDir,
        receipt: receipt2,
        expectedPreviousDigest: null,
      }),
    code("RECEIPT_CHANGED"),
  );
  assert.equal(
    hashArtifact(readArtifact(updated.path)),
    hashArtifact(receipt2),
  );
});

test("跨 repo 拒絕:repository / slug / targetFileKey 不符的 receipt 不讀、不覆蓋", () => {
  const rootDir = tmp();
  writeVerifiedReceipt({
    rootDir,
    receipt: receipt1,
    expectedPreviousDigest: null,
  });
  const project = receipt1.project;
  assert.equal(
    hashArtifact(readReceipt({ rootDir, fileKey: CONSUMER_FILE, project })),
    hashArtifact(receipt1),
  );
  assert.equal(readReceipt({ rootDir, fileKey: "OTHERfile01", project }), null);
  for (const foreign of [
    { ...project, repository: "other/repo" },
    { ...project, slug: "other-project" },
  ]) {
    assert.throws(
      () => readReceipt({ rootDir, fileKey: CONSUMER_FILE, project: foreign }),
      code("RECEIPT_FOREIGN"),
    );
    const theirs = { ...receipt2, project: foreign };
    assert.throws(
      () =>
        writeVerifiedReceipt({
          rootDir,
          receipt: theirs,
          expectedPreviousDigest: hashArtifact(receipt1),
        }),
      code("RECEIPT_FOREIGN"),
    );
  }
  // 檔名與內容的 targetFileKey 不一致(被改名或複製過來)
  const copied = receiptPath(rootDir, "COPIEDfile01");
  writeFileSync(copied, JSON.stringify(receipt1));
  assert.throws(
    () => readReceipt({ rootDir, fileKey: "COPIEDfile01", project }),
    code("RECEIPT_FOREIGN"),
  );
});

test("committed receipt 以 repo 的 Prettier 排版落地,內容與 digest 不變", () => {
  const rootDir = tmp();
  const first = writeVerifiedReceipt({
    rootDir,
    receipt: receipt1,
    expectedPreviousDigest: null,
  });
  const updated = writeVerifiedReceipt({
    rootDir,
    receipt: receipt2,
    expectedPreviousDigest: hashArtifact(receipt1),
  });
  assert.equal(updated.path, first.path);
  const bin = createRequire(import.meta.url).resolve(
    "prettier/bin/prettier.cjs",
  );
  const check = spawnSync(process.execPath, [bin, "--check", updated.path], {
    cwd: rootDir,
    encoding: "utf8",
  });
  assert.equal(check.status, 0, check.stdout + check.stderr);
  // 排版只動空白:讀回後仍是同一份 canonical 內容
  assert.equal(
    hashArtifact(readArtifact(updated.path)),
    hashArtifact(receipt2),
  );
  assert.notEqual(
    readFileSync(updated.path, "utf8"),
    `${JSON.stringify(receipt2, null, 2)}\n`,
  );
});

test("receipt CAS 由跨程序鎖保護:鎖存在回 RECEIPT_BUSY、不自行清鎖;結束後只釋放自己的鎖", () => {
  const rootDir = tmp();
  writeVerifiedReceipt({
    rootDir,
    receipt: receipt1,
    expectedPreviousDigest: null,
  });
  const target = receiptPath(rootDir, CONSUMER_FILE);
  const lock = `${target}.lock`;
  const before = readFileSync(target);
  // 正常完成後沒有留下鎖
  assert.equal(existsSync(lock), false);
  // 另一個 writer 持有鎖(或中斷後留下):不靠時間或 PID 猜測清除
  writeFileSync(lock, "held-by-someone-else");
  const update = () =>
    writeVerifiedReceipt({
      rootDir,
      receipt: receipt2,
      expectedPreviousDigest: hashArtifact(receipt1),
    });
  assert.throws(update, code("RECEIPT_BUSY"));
  assert.throws(update, code("RECEIPT_BUSY"));
  assert.equal(readFileSync(lock, "utf8"), "held-by-someone-else");
  assert.deepEqual(readFileSync(target), before);
  // 連相同結果的冪等重送也要先取得鎖
  assert.throws(
    () =>
      writeVerifiedReceipt({
        rootDir,
        receipt: receipt1,
        expectedPreviousDigest: null,
      }),
    code("RECEIPT_BUSY"),
  );
  // 操作者確認沒有 writer 後移除,再冪等 record
  rmSync(lock);
  assert.equal(update().written, true);
  assert.equal(existsSync(lock), false);
  // 失敗(RECEIPT_CHANGED)也會釋放自己的鎖
  assert.throws(
    () =>
      writeVerifiedReceipt({
        rootDir,
        receipt: receipt1,
        expectedPreviousDigest: null,
      }),
    code("RECEIPT_CHANGED"),
  );
  assert.equal(existsSync(lock), false);
  // 首次建立同樣受鎖保護
  const fresh = tmp();
  const freshTarget = receiptPath(fresh, CONSUMER_FILE);
  mkdirSync(path.dirname(freshTarget), { recursive: true });
  writeFileSync(`${freshTarget}.lock`, "x");
  assert.throws(
    () =>
      writeVerifiedReceipt({
        rootDir: fresh,
        receipt: receipt1,
        expectedPreviousDigest: null,
      }),
    code("RECEIPT_BUSY"),
  );
  assert.equal(existsSync(freshTarget), false);
});

test("兩個 process 以同一個 previous 同時更新:恰有一個成功,先完成的結果不會被後者覆蓋", async () => {
  const work = tmp();
  const script = path.join(work, "writer.mjs");
  writeFileSync(
    script,
    `import { readFileSync } from "node:fs";
import { writeVerifiedReceipt } from ${JSON.stringify(
      pathToFileURL(path.resolve("scripts/figma-sync/artifacts.mjs")).href,
    )};
const [rootDir, file, previous] = process.argv.slice(2);
try {
  const result = writeVerifiedReceipt({
    rootDir,
    receipt: JSON.parse(readFileSync(file, "utf8")),
    expectedPreviousDigest: previous,
  });
  process.stdout.write(result.written ? "written" : "same");
} catch (error) {
  process.stdout.write(String(error.code));
}
`,
  );
  const rival = { ...receipt2, runId: "rival-run" };
  const candidates = [receipt2, rival].map((receipt, index) => {
    const target = path.join(work, `candidate-${index}.json`);
    writeFileSync(target, JSON.stringify(receipt));
    return { receipt, target };
  });
  const run = (rootDir, candidate) =>
    new Promise((resolve) => {
      const child = spawn(process.execPath, [
        script,
        rootDir,
        candidate.target,
        hashArtifact(receipt1),
      ]);
      let output = "";
      child.stdout.on("data", (chunk) => (output += chunk));
      child.on("close", () => resolve(output));
    });
  for (let round = 0; round < 4; round += 1) {
    const rootDir = tmp();
    writeVerifiedReceipt({
      rootDir,
      receipt: receipt1,
      expectedPreviousDigest: null,
    });
    const results = await Promise.all(
      candidates.map((candidate) => run(rootDir, candidate)),
    );
    const winners = results.filter((result) => result === "written");
    assert.equal(winners.length, 1, results.join(","));
    const loser = results.find((result) => result !== "written");
    assert.ok(["RECEIPT_CHANGED", "RECEIPT_BUSY"].includes(loser), loser);
    const winner = candidates[results.indexOf("written")].receipt;
    const target = receiptPath(rootDir, CONSUMER_FILE);
    assert.equal(hashArtifact(readArtifact(target)), hashArtifact(winner));
    assert.equal(existsSync(`${target}.lock`), false);
  }
});
