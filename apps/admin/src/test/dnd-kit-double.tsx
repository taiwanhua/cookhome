/* eslint-disable react-refresh/only-export-components -- 測試替身:同一檔同時匯出替身元件與「取代整個模組」的物件,只在 jest 內載入、不走 Vite HMR;dnd-kit 換掉時整檔一起刪 */
import { act } from "@testing-library/react";
import { type ReactNode, useEffect } from "react";

/**
 * dnd-kit 的測試替身(#67):jsdom 沒有版面幾何,真的指標拖曳測不出「放到哪」;
 * 這裡把 `DndContext` 換成只記住 `onDragEnd` 的空殼,測試以 `dragEnd(active, over)` 直接送出「拖曳結束」事件,
 * 其餘(排序策略、`useSortable`)都退化成不動作。用法見 `features/shell/route-tabs-drag.test.tsx`
 * (`jest.unstable_mockModule` 必須在動態 import 受測模組之前)。
 */

interface DragEndEventLike {
  active: { id: string };
  over: { id: string } | null;
}

type DragEndHandler = (event: DragEndEventLike) => void;

let latestOnDragEnd: DragEndHandler | null = null;

interface DndContextDoubleProps {
  children?: ReactNode;
  onDragEnd?: DragEndHandler;
}

function DndContext({ children, onDragEnd }: Readonly<DndContextDoubleProps>) {
  useEffect(() => {
    latestOnDragEnd = onDragEnd ?? null;
  });
  return <>{children}</>;
}

function SortableContext({ children }: Readonly<{ children?: ReactNode }>) {
  return <>{children}</>;
}

function useSortable() {
  return {
    attributes: {},
    listeners: {},
    setNodeRef: () => {
      // 替身不量測節點
    },
    transform: null,
    transition: undefined,
    isDragging: false,
  };
}

/** 模擬使用者把 `activeId` 拖到 `overId` 的位置放下。 */
export function dragEnd(activeId: string, overId: string | null): void {
  act(() => {
    latestOnDragEnd?.({
      active: { id: activeId },
      over: overId === null ? null : { id: overId },
    });
  });
}

/** 取代 `@dnd-kit/core` 的模組物件 */
export const dndKitCoreDouble = {
  DndContext,
  PointerSensor: () => null,
  closestCenter: () => [],
  useSensor: () => ({}),
  useSensors: () => [],
};

/** 取代 `@dnd-kit/sortable` 的模組物件 */
export const dndKitSortableDouble = {
  SortableContext,
  horizontalListSortingStrategy: () => null,
  useSortable,
};
