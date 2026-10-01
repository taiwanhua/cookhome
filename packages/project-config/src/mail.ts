import { assertProjectMailConfig } from "./base/mail-config";
import { projectMail as projectMailValues } from "./project/mail";

export type { ProjectMailConfig } from "./base/mail-config";

/** 專案信件設定(api 專用出口);載入時驗證一次。 */
export const projectMail = assertProjectMailConfig(projectMailValues);
