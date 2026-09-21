import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * 側欄收合狀態的 localStorage key(登記於 `docs/branding.md`)。
 * 收合是**這台瀏覽器的偏好**,不分使用者也不分組織 —— 換人登入照樣維持,
 * 所以不像路由頁籤那樣以 `:<userId>` 分把鑰匙(#289)。
 */
export const SIDE_NAV_STORAGE_KEY = "cookhome.admin.sidenav";

interface SideNavPersisted {
  /** 側欄是不是收成 64px 的圖示列 */
  isCollapsed: boolean;
}

export interface SideNavState extends SideNavPersisted {
  toggle: () => void;
}

/**
 * 側欄收合狀態(#289;REACT-02 第 4 點:跨元件、跨重新整理的用戶端狀態放 zustand + `persist`)。
 *
 * 這是**新的** key,沒有既存格式要遷就,所以直接用 `persist` 預設的
 * `{ state, version }` JSON 封包與預設的 localStorage —— 語言與路由頁籤那兩支
 * 是為了保住重構前的既存值才自訂 `PersistStorage`(REACT-02 的注意①)。
 */
export const useSideNavStore = create<SideNavState>()(
  persist(
    (set) => ({
      isCollapsed: false,
      toggle: () => {
        set((state) => ({ isCollapsed: !state.isCollapsed }));
      },
    }),
    {
      name: SIDE_NAV_STORAGE_KEY,
      partialize: (state) => ({ isCollapsed: state.isCollapsed }),
    },
  ),
);
