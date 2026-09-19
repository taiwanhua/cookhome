import { describe, expect, it } from "@jest/globals";
import { render, screen } from "@testing-library/react";

import { Markdown } from "./Markdown";

describe("Markdown", () => {
  it("標題與段落照 Markdown 的層級渲染成真的 heading", () => {
    render(
      <Markdown>
        {"# 角色管理\n\n## 這個模組做什麼\n\n建立與管理角色。"}
      </Markdown>,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "角色管理" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "這個模組做什麼" }),
    ).toBeInTheDocument();
    expect(screen.getByText("建立與管理角色。")).toBeInTheDocument();
  });

  it("清單渲染成 list,粗體渲染成 strong", () => {
    render(
      <Markdown>
        {"- **建立角色**:選擇所屬組織\n- 權限設定:逐項勾選\n"}
      </Markdown>,
    );

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("建立角色:選擇所屬組織");
    expect(screen.getByText("建立角色").tagName).toBe("STRONG");
  });

  it("GFM 表格(remark-gfm)渲染成 table,含表頭與列", () => {
    render(
      <Markdown>
        {"| 權限 | 說明 |\n| --- | --- |\n| 檢視 | 看得到頁面 |\n"}
      </Markdown>,
    );

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "權限" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("cell", { name: "看得到頁面" }),
    ).toBeInTheDocument();
    // 表頭列 + 一筆資料列
    expect(screen.getAllByRole("row")).toHaveLength(2);
  });

  it("raw HTML 不渲染成 DOM:沒掛 rehype-raw,標籤一律被丟掉", () => {
    const { container } = render(
      <Markdown>
        {'<script>alert(1)</script>\n\n<b id="raw">粗體</b>\n\n安全的內文'}
      </Markdown>,
    );

    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("#raw")).toBeNull();
    expect(screen.getByText("安全的內文")).toBeInTheDocument();
  });

  it("連結的 javascript: 協定被預設的 urlTransform 清成空 href,http 連結保留", () => {
    render(
      <Markdown>
        {
          "[點我](javascript:alert(1))\n\n[說明頁](https://cookhome.online/help)"
        }
      </Markdown>,
    );

    expect(screen.getByText("點我").getAttribute("href")).toBe("");
    expect(screen.getByRole("link", { name: "說明頁" })).toHaveAttribute(
      "href",
      "https://cookhome.online/help",
    );
  });
});
