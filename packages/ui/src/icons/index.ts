"use client";

/**
 * 殼用的線性圖示,path 取自 Figma Admin Shell 匯出的 SVG(chevron 16×16、icon-slot 16×16),
 * 顏色一律 `currentColor`(由父層文字色決定,STYLE-04 深色模式自動正確)。
 * 本檔是 `@repo/ui/icons` 的出口;每個圖示一檔(REACT-07)。
 *
 * 另有 `module-icon-registry`:模組圖示的 MUI Outlined 白名單(#287)—— 那些圖示是**資料選出來的**
 * (值存在資料庫),所以不手畫,改以單檔路徑 import 的登錄表限制打包範圍。
 */
export * from "./icon-props";
export * from "./ChevronDownIcon";
export * from "./ChevronRightIcon";
export * from "./DotIcon";
export * from "./CloseIcon";
export * from "./CheckIcon";
export * from "./HelpIcon";
export * from "./module-icon-registry";
