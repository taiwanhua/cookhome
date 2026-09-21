import { sampleTwoModule } from "../SampleTwoModule";
import { DemoListPage } from "../shared/DemoListPage";

/**
 * 示範模組2 列表(模組 key `demo.sample-two`,網址 `/demo/sample-two`;
 * 正本 `docs/modules/demo.sample-two.md`)。
 *
 * 版型與示範模組1 同一份(Figma 175:3;示範模組2 同版型不畫),差別全在設定物件:
 * 四欄而不是六欄、工具列沒有分類篩選。
 */
export const SampleTwoPage = () => <DemoListPage config={sampleTwoModule} />;
