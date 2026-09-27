import { describe, expect, it } from "@jest/globals";
import { render, screen } from "@testing-library/react";

import { Grid } from "./Grid";

describe("Grid", () => {
  it("容器與格子都畫出來,子元素依序在格子裡", () => {
    render(
      <Grid container spacing={2} data-testid="container">
        <Grid size={6} data-testid="cell-a">
          <span>甲</span>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }} data-testid="cell-b">
          <span>乙</span>
        </Grid>
      </Grid>,
    );

    const container = screen.getByTestId("container");
    expect(container).toHaveClass("MuiGrid-container");
    expect(screen.getByTestId("cell-a")).toContainElement(
      screen.getByText("甲"),
    );
    expect(screen.getByTestId("cell-b")).toContainElement(
      screen.getByText("乙"),
    );
    expect(container.children).toHaveLength(2);
  });

  it("格子依斷點掛上尺寸 class(手機 / 平板 / 桌機各一段)", () => {
    render(
      <Grid container>
        <Grid size={{ xs: 12, sm: 8, md: 4 }} data-testid="cell">
          <span>欄</span>
        </Grid>
      </Grid>,
    );

    const { className } = screen.getByTestId("cell");
    expect(className).toMatch(/grid-xs-12/);
    expect(className).toMatch(/grid-sm-8/);
    expect(className).toMatch(/grid-md-4/);
  });

  it("可以換成語意元素(component)", () => {
    render(
      <Grid container component="section" aria-label="版面">
        <Grid size={12}>
          <span>內容</span>
        </Grid>
      </Grid>,
    );

    expect(screen.getByRole("region", { name: "版面" })).toBeInTheDocument();
  });
});
