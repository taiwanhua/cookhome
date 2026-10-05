/** 可預期的拒絕或查詢失敗。訊息只用固定文字、repo 身分、路徑與 SHA,不放 URL、credential 或子行程原始輸出。 */
export class BaseSyncError extends Error {
  constructor(message) {
    super(message);
    this.name = "BaseSyncError";
  }
}

export const fail = (message) => {
  throw new BaseSyncError(message);
};
