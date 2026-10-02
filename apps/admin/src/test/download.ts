import { afterEach, beforeEach } from "@jest/globals";

/** 測試期間被觸發的一次檔案下載。 */
export interface CapturedDownload {
  fileName: string;
  /** 存進檔案的文字(原樣) */
  text: () => Promise<string>;
}

/**
 * 攔下「存成檔案」(`URL.createObjectURL` + `<a download>` 的點擊):jsdom 不會真的下載,
 * 點擊帶 `href` 的連結還會嘗試導覽。在測試檔頂層呼叫一次,回傳的陣列依序記下每次下載的檔名與內容;
 * 每個測試前清空、測試後還原。
 */
export const captureDownloads = (): CapturedDownload[] => {
  const downloads: CapturedDownload[] = [];
  const blobs = new Map<string, Blob>();
  const original = {
    createObjectURL: URL.createObjectURL.bind(URL),
    revokeObjectURL: URL.revokeObjectURL.bind(URL),
  };

  const onClick = (event: MouseEvent): void => {
    const link = event.target;
    if (!(link instanceof HTMLAnchorElement) || link.download === "") {
      return;
    }
    // 擋掉連結的預設行為(jsdom 會嘗試導覽到 blob 網址)
    event.preventDefault();
    const blob = blobs.get(link.getAttribute("href") ?? "");
    downloads.push({
      fileName: link.download,
      text: () => blob?.text() ?? Promise.resolve(""),
    });
  };

  beforeEach(() => {
    downloads.length = 0;
    blobs.clear();
    URL.createObjectURL = (blob: Blob): string => {
      const url = `blob:test-download-${String(blobs.size)}`;
      blobs.set(url, blob);
      return url;
    };
    URL.revokeObjectURL = (): void => undefined;
    document.addEventListener("click", onClick, true);
  });

  afterEach(() => {
    document.removeEventListener("click", onClick, true);
    URL.createObjectURL = original.createObjectURL;
    URL.revokeObjectURL = original.revokeObjectURL;
  });

  return downloads;
};
