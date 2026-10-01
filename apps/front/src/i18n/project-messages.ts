import { composeProjectMessages } from "@repo/i18n";
import { projectPublic } from "@repo/project-config/public";

/**
 * 前台的完整字典:專案的品牌名與 metadata 在這裡注入基礎字典(I18N-06)。
 * 頁面與 layout 仍用原來的翻譯 key 取文字,不直接讀專案設定。
 */
export const projectMessages = composeProjectMessages({
  brandName: projectPublic.brand.name,
  frontMetadata: projectPublic.front.metadata,
});
