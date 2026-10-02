/**
 * 測試用的假受管定義 CLI:讀完 stdin 後回報一筆失敗並以非零結束,模擬 api 的 runtime 啟動不起來
 * (索引建不回來)。只給 reset 的失敗路徑測試以 `cli:<路徑>` 換上。
 */
import process from "node:process";

process.stdin.resume();
process.stdin.on("end", () => {
  process.exitCode = 1;
  process.stdout.write(
    `${JSON.stringify({
      results: [],
      errors: [{ code: "CLI_FAILED", message: "模擬 runtime 啟動失敗" }],
    })}\n`,
  );
});
