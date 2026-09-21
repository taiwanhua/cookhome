import { sampleOneModule } from "../SampleOneModule";
import { DemoListPage } from "../shared/DemoListPage";

/**
 * 示範模組1 列表(模組 key `demo.sub.sample-one`,正本 `docs/modules/demo.sub.sample-one.md`;
 * Figma「Screen / Admin 示範模組1 列表」175:3)。
 *
 * 版型與行為全在共用的 `DemoListPage`,這一頁只把**設定物件**接上去 ——
 * 換一個模組就是換一份 `SampleOneModule.tsx`(#321 的共版型抽取)。
 */
export const SampleOnePage = () => <DemoListPage config={sampleOneModule} />;
