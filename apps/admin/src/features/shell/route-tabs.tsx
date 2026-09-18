import {
  type Announcements,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  type ScreenReaderInstructions,
  type UniqueIdentifier,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { type KeyboardEvent, type PointerEvent, useRef } from "react";
import { useTranslations } from "use-intl";

import { Box } from "@repo/ui/box";
import { IconButton } from "@repo/ui/icon-button";
import { CloseIcon } from "@repo/ui/icons";
import { Typography } from "@repo/ui/typography";

import type { RouteTab } from "./route-tabs-store";

/** 頁籤列高 / 頁籤高 / 關閉圖示(theme.spacing 單位;Figma AdminRouteTabs 46 高、RouteTab 30 高、close 12)。 */
const BAR_HEIGHT = 5.75;
const TAB_HEIGHT = 3.75;
const CLOSE_ICON_SIZE = 1.5;
/** 指標移動超過這個距離才算拖曳(px;之內是點擊 → 切換頁籤) */
const DRAG_START_DISTANCE = 6;

interface RouteTabsProps {
  tabs: RouteTab[];
  /** 目前選中的 tab 路由;null = 沒有 tab 選中(網址不是模組路由) */
  activeRoute: string | null;
  onSelect: (route: string) => void;
  onClose: (route: string) => void;
  /** 把 `fromRoute` 的 tab 移到 `toRoute` 的位置 */
  onMove: (fromRoute: string, toRoute: string) => void;
}

interface SortableTabProps {
  tab: RouteTab;
  isActive: boolean;
  /** 單一 tab stop(WAI-ARIA tabs):選中者 0、其餘 -1;沒有選中者時第一個 0 */
  tabIndex: 0 | -1;
  closeLabel: string;
  onSelect: () => void;
  onClose: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
}

function stopPointerPropagation(event: PointerEvent<HTMLButtonElement>) {
  // 關閉鈕上按下不啟動拖曳
  event.stopPropagation();
}

/**
 * 單一頁籤(Figma Draft/RouteTab 26:48:State=Active 品牌淺色底 + 深色字、Default 底色 + 次要字;Closable 開關 = 關閉鈕)。
 * 整顆 tab 是 dnd-kit 的可拖曳節點(指標);鍵盤排序不走 dnd-kit,由 `RouteTabs` 的 keydown 直接搬(見 keyboardHint)。
 */
function SortableTab({
  tab,
  isActive,
  tabIndex,
  closeLabel,
  onSelect,
  onClose,
  onKeyDown,
}: Readonly<SortableTabProps>) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tab.route });

  return (
    <Box
      ref={setNodeRef}
      role="tab"
      aria-selected={isActive}
      aria-describedby={attributes["aria-describedby"]}
      tabIndex={tabIndex}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      {...listeners}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.75,
        height: (theme) => theme.spacing(TAB_HEIGHT),
        pl: 1.5,
        pr: 1,
        borderRadius: 1,
        flexShrink: 0,
        cursor: isDragging ? "grabbing" : "pointer",
        userSelect: "none",
        touchAction: "none",
        bgcolor: isActive ? "primary.lighter" : "background.default",
        color: isActive ? "primary.dark" : "text.secondary",
        boxShadow: isDragging ? 2 : 0,
        zIndex: isDragging ? 1 : "auto",
        position: "relative",
        // 拖曳中的位移是執行期幾何值,不是設計 token(STYLE-01 例外);走 sx 而非 style={}(STYLE-02)
        transform: transform
          ? `translate3d(${String(Math.round(transform.x))}px, ${String(Math.round(transform.y))}px, 0)`
          : undefined,
        transition,
        "&:hover": { bgcolor: isActive ? "primary.lighter" : "action.hover" },
        "&:focus-visible": {
          outline: "2px solid",
          outlineColor: "primary.main",
          outlineOffset: "1px",
        },
      }}
    >
      <Typography variant="subtitle2" component="span" noWrap>
        {tab.label}
      </Typography>
      <IconButton
        size="small"
        tabIndex={-1}
        aria-label={closeLabel}
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
        onPointerDown={stopPointerPropagation}
        sx={{ p: 0.25, color: "inherit" }}
      >
        <CloseIcon
          sx={{
            width: (theme) => theme.spacing(CLOSE_ICON_SIZE),
            height: (theme) => theme.spacing(CLOSE_ICON_SIZE),
          }}
        />
      </IconButton>
    </Box>
  );
}

/**
 * 路由頁籤列(#67;Figma Draft/AdminRouteTabs 34:33):開過的模組路由各一個 tab(狀態在 `useRouteTabs`),
 * 點 tab 切換路由、可關閉、可拖曳排序(dnd-kit sortable,指標)。
 * 鍵盤:左右方向鍵移動焦點(單一 tab stop)、Enter / Space 開啟、Shift+方向鍵調整順序、Delete / Backspace 關閉;
 * 說明文字經 dnd-kit 的隱藏說明節點(`aria-describedby`)提供給輔助科技,拖曳過程以 `announcements` 播報。
 */
export function RouteTabs({
  tabs,
  activeRoute,
  onSelect,
  onClose,
  onMove,
}: Readonly<RouteTabsProps>) {
  const t = useTranslations("admin.shell.tabs");
  const listRef = useRef<HTMLDivElement>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: DRAG_START_DISTANCE },
    }),
  );

  const labelOf = (id: UniqueIdentifier) =>
    tabs.find((tab) => tab.route === id)?.label ?? String(id);

  const announcements: Announcements = {
    onDragStart: ({ active }) => t("dragStart", { label: labelOf(active.id) }),
    onDragOver: ({ active, over }) =>
      over
        ? t("dragOver", { label: labelOf(active.id), over: labelOf(over.id) })
        : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? t("dragEnd", { label: labelOf(active.id), over: labelOf(over.id) })
        : t("dragEndNoTarget", { label: labelOf(active.id) }),
    onDragCancel: ({ active }) =>
      t("dragCancel", { label: labelOf(active.id) }),
  };
  const screenReaderInstructions: ScreenReaderInstructions = {
    draggable: t("keyboardHint"),
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) {
      onMove(String(active.id), String(over.id));
    }
  };

  const focusTab = (index: number) => {
    const items =
      listRef.current?.querySelectorAll<HTMLElement>('[role="tab"]');
    items?.[index]?.focus();
  };

  const handleKeyDown = (
    event: KeyboardEvent<HTMLDivElement>,
    index: number,
  ) => {
    const tab = tabs.at(index);
    if (tab === undefined) {
      return;
    }
    const last = tabs.length - 1;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowLeft": {
        event.preventDefault();
        const step = event.key === "ArrowRight" ? 1 : -1;
        const targetIndex = index + step;
        const target = targetIndex < 0 ? undefined : tabs.at(targetIndex);
        if (target === undefined) {
          return;
        }
        if (event.shiftKey) {
          onMove(tab.route, target.route);
        } else {
          focusTab(targetIndex);
        }
        return;
      }
      case "Home": {
        event.preventDefault();
        focusTab(0);
        return;
      }
      case "End": {
        event.preventDefault();
        focusTab(last);
        return;
      }
      case "Enter":
      case " ": {
        event.preventDefault();
        onSelect(tab.route);
        return;
      }
      case "Delete":
      case "Backspace": {
        event.preventDefault();
        onClose(tab.route);
        // 被關掉的節點會消失,焦點留在頁籤列(右邊優先,沒有就左邊);等 React 提交後再移
        const nextIndex = Math.min(index, last - 1);
        setTimeout(() => {
          focusTab(nextIndex);
        }, 0);
        return;
      }
      default:
      // 其他按鍵交給瀏覽器
    }
  };

  const hasActive = tabs.some((tab) => tab.route === activeRoute);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      accessibility={{ announcements, screenReaderInstructions }}
    >
      <SortableContext
        items={tabs.map((tab) => tab.route)}
        strategy={horizontalListSortingStrategy}
      >
        <Box
          ref={listRef}
          role="tablist"
          aria-label={t("label")}
          aria-orientation="horizontal"
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            minHeight: (theme) => theme.spacing(BAR_HEIGHT),
            px: 3,
            py: 1,
            bgcolor: "background.paper",
            borderBottom: 1,
            borderColor: "divider",
            overflowX: "auto",
          }}
        >
          {tabs.map((tab, index) => {
            const isActive = tab.route === activeRoute;
            const isTabStop = hasActive ? isActive : index === 0;
            return (
              <SortableTab
                key={tab.route}
                tab={tab}
                isActive={isActive}
                tabIndex={isTabStop ? 0 : -1}
                closeLabel={t("close", { label: tab.label })}
                onSelect={() => {
                  onSelect(tab.route);
                }}
                onClose={() => {
                  onClose(tab.route);
                }}
                onKeyDown={(event) => {
                  handleKeyDown(event, index);
                }}
              />
            );
          })}
        </Box>
      </SortableContext>
    </DndContext>
  );
}
