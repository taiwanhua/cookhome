import { Button } from "@repo/ui/button";

import {
  type FormValueRenderContext,
  displayTextOf,
  isEmptyDisplay,
} from "@/lib/form-engine/value-text";

/**
 * 一格值(Spec 6a §8 `renderValue(ctx)` 的元件形;`render-value.ts` 的 `renderValue` 就是渲染它)。
 * 詳情頁、修訂差異、列表共用;文字規則在 `lib/form-engine/value-text.ts`。
 * 上傳欄有 `onDownload` 時檔名是按鈕(簽名網址短效,點了才去要)。
 */
export const FormValue = (ctx: FormValueRenderContext) => {
  const text = displayTextOf(ctx);
  const { onDownload, field, value } = ctx;
  if (
    field.type !== "upload" ||
    onDownload === undefined ||
    isEmptyDisplay(value)
  ) {
    return <>{text}</>;
  }
  return (
    <Button
      variant="text"
      size="small"
      onClick={() => {
        onDownload(field);
      }}
    >
      {text}
    </Button>
  );
};
