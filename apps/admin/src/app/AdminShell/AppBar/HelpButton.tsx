import { useState } from "react";
import { useTranslations } from "use-intl";

import { Box } from "@repo/ui/box";
import { Button } from "@repo/ui/button";
import { Dialog } from "@repo/ui/dialog";
import { IconButton } from "@repo/ui/icon-button";
import { HelpIcon } from "@repo/ui/icons";
import { Markdown } from "@repo/ui/markdown";

import { moduleHelpMarkdown } from "@/lib/help-registry";

export interface HelpButtonProps {
  /** 目前模組的 key(`me.modules` 的 key);決定顯示哪一份 help.md */
  moduleKey: string;
  /** 目前模組的名稱;彈窗標題用 */
  moduleName: string;
}

/**
 * AppBar 的「?」模組說明(#197;Figma Draft/AdminAppBar 的 help-button I44:119;81:51
 * + Overlay / 模組說明 81:241 的 Draft/HelpDialog 95:235)。
 * 內容是 build 時打包進來的 `src/md/module-help/<模組 key>.help.md`(`lib/help-registry`),
 * 沒有對應檔案時按鈕 disabled 並在 hover 提示。
 */
export const HelpButton = ({ moduleKey, moduleName }: HelpButtonProps) => {
  const t = useTranslations("admin.shell.help");
  const [isOpen, setIsOpen] = useState(false);
  const markdown = moduleHelpMarkdown(moduleKey);

  return (
    <>
      {/* disabled 的按鈕不發 hover 事件,提示掛在外層 span(同使用者管理的列操作) */}
      <Box
        component="span"
        title={markdown === undefined ? t("unavailable") : undefined}
      >
        <IconButton
          aria-label={t("open")}
          size="small"
          disabled={markdown === undefined}
          onClick={() => {
            setIsOpen(true);
          }}
          sx={{ color: "text.secondary" }}
        >
          {/* Figma 的 18×18;MUI 的 small 是 20px,差 2px 視覺可接受(STYLE-06) */}
          <HelpIcon fontSize="small" />
        </IconButton>
      </Box>
      {markdown !== undefined && (
        <Dialog
          open={isOpen}
          onClose={() => {
            setIsOpen(false);
          }}
          fullWidth
          maxWidth="sm"
          title={t("title", { name: moduleName })}
          actions={
            <Button
              variant="text"
              onClick={() => {
                setIsOpen(false);
              }}
            >
              {t("close")}
            </Button>
          }
        >
          {/* help.md 本身就是繁中,不進訊息檔、不翻譯(#197) */}
          <Markdown>{markdown}</Markdown>
        </Dialog>
      )}
    </>
  );
};
