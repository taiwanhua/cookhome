import { createBrandFromPrimary } from "../brand";

/**
 * 通用預設品牌(主色 #FB7B10):給 story、測試與還沒指定品牌的呼叫端用。
 * 專案的名稱與主色由 app 讀自己的設定後呼叫 `createBrandFromPrimary`,本套件不讀專案設定。
 */
export const defaultBrand = createBrandFromPrimary("Default", "#FB7B10");
