/**
 * 信件寄件識別的契約與驗證(底座維護)。只給 api 用,不進瀏覽器出口;
 * API key、收件白名單與 adapter 選擇仍由 api 的 MailConfig 管,不在這裡。
 */
export interface ProjectMailConfig {
  /** 寄件人顯示名與信件內文用的品牌名;專案值引用公開設定的 `brand.name` */
  brandName: string;
  /** 寄件信箱(單純的 `local@domain`,不含顯示名) */
  senderEmail: string;
  /** 信末署名 */
  signature: string;
}

const FORBIDDEN_EMAIL_CHARS = /[\s<>]/;

/** 單純的 `local@domain.tld`:恰好一個 `@`、兩側非空、網域含 `.`,不含空白與角括號。 */
const isPlainEmail = (value: unknown): value is string => {
  if (typeof value !== "string" || FORBIDDEN_EMAIL_CHARS.test(value)) {
    return false;
  }
  const [local, domain, ...rest] = value.split("@");
  if (!local || !domain || rest.length > 0) {
    return false;
  }
  const dot = domain.indexOf(".");
  return dot > 0 && dot < domain.length - 1;
};

const fail = (field: string, expectation: string): never => {
  throw new Error(`專案信件設定不合法:${field} ${expectation}`);
};

export const assertProjectMailConfig = <T extends ProjectMailConfig>(
  config: T,
): T => {
  if (typeof config.brandName !== "string" || config.brandName.trim() === "") {
    fail("brandName", "必須是非空字串");
  }
  if (!isPlainEmail(config.senderEmail)) {
    fail("senderEmail", "必須是單純的信箱(不含顯示名)");
  }
  if (typeof config.signature !== "string" || config.signature.trim() === "") {
    fail("signature", "必須是非空字串");
  }
  return config;
};
