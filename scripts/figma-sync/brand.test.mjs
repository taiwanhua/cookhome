import assert from "node:assert/strict";
import { test } from "node:test";

import { projectPublic } from "@repo/project-config/public";
import {
  contrastRatio,
  createBrandFromPrimary,
  createCustomShadows,
} from "@repo/ui/theme";

import { createFigmaBrandProjection } from "./brand.mjs";
import { ROLES, brandFixture } from "./test-support.mjs";

const toHex = ({ r, g, b }) =>
  `#${[r, g, b]
    .map((channel) =>
      Math.round(channel * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`.toUpperCase();

const FIXTURES = [
  ["Blue", "#1C4AD9"],
  ["Green", "#086B38"],
  ["Yellow", "#FFD400"],
];

for (const [name, primary] of FIXTURES) {
  test(`品牌 ${name}:六色與 @repo/ui 的真推導相同,contrast 對應 contrastText`, () => {
    const projection = createFigmaBrandProjection(brandFixture(name, primary));
    const palette = createBrandFromPrimary(name, primary).primary;
    assert.equal(projection.name, name);
    assert.deepEqual(Object.keys(projection.primary), ROLES);
    for (const role of ["lighter", "light", "main", "dark", "darker"]) {
      assert.equal(toHex(projection.primary[role]), palette[role]);
      assert.equal(projection.primary[role].a, 1);
    }
    assert.equal(toHex(projection.primary.contrast), palette.contrastText);
    // 對比文字是推導結果:與主色的對比必須達 WCAG AA
    assert.ok(contrastRatio(palette.main, palette.contrastText) >= 4.5);
  });

  test(`品牌 ${name}:primary effect 的色、alpha、幾何都取 createCustomShadows`, () => {
    const projection = createFigmaBrandProjection(brandFixture(name, primary));
    const css = createCustomShadows(primary).primary;
    const [, y, blur, spread, r, g, b, alpha] =
      /^0 (\d+)px (\d+)px (\d+) rgba\((\d+), (\d+), (\d+), ([\d.]+)\)$/.exec(
        css,
      );
    const effect = projection.primaryEffect;
    assert.deepEqual(
      { ...effect, color: undefined },
      {
        type: "DROP_SHADOW",
        color: undefined,
        offset: { x: 0, y: Number(y) },
        radius: Number(blur),
        spread: Number(spread),
        visible: true,
        blendMode: "NORMAL",
      },
    );
    assert.deepEqual(
      [effect.color.r, effect.color.g, effect.color.b].map((channel) =>
        Math.round(channel * 255),
      ),
      [Number(r), Number(g), Number(b)],
    );
    // 陰影自己的 alpha,不是主色綁定的 1
    assert.equal(effect.color.a, Number(alpha));
    assert.notEqual(effect.color.a, 1);
    assert.equal(toHex(effect.color), toHex(projection.primary.main));
  });
}

test("aliases:六個 Color 角色各指向同角色的 Brand 變數", () => {
  const { aliases } = createFigmaBrandProjection(brandFixture());
  assert.deepEqual(
    aliases.map((alias) => alias.role),
    ROLES,
  );
  for (const alias of aliases) {
    assert.deepEqual(alias, {
      role: alias.role,
      collectionRole: "Color",
      name: `primary/${alias.role}`,
      target: { collectionRole: "Brand", name: `primary/${alias.role}` },
    });
  }
});

test("不同主色得到不同投影;同一輸入結果穩定", () => {
  const [blue, green] = FIXTURES.map(([name, primary]) =>
    createFigmaBrandProjection(brandFixture(name, primary)),
  );
  assert.notDeepEqual(blue.primary, green.primary);
  assert.notDeepEqual(blue.primaryEffect.color, green.primaryEffect.color);
  assert.deepEqual(
    createFigmaBrandProjection(brandFixture("Blue", "#1C4AD9")),
    blue,
  );
});

test("輸入只接受既有的 name 與 #RRGGBB primary;其餘拒絕,不以預設值備援", () => {
  for (const brand of [
    { name: "", primary: "#1C4AD9" },
    { name: "X", primary: "1C4AD9" },
    { name: "X", primary: "#1C4" },
    { name: "X", primary: "rgb(1,2,3)" },
    { name: "X" },
  ]) {
    assert.throws(() => createFigmaBrandProjection({ brand }));
  }
});

test("正式專案設定可直接投影(只驗形狀,不鎖專案名稱或顏色)", () => {
  const projection = createFigmaBrandProjection(projectPublic);
  assert.equal(projection.name, projectPublic.brand.name);
  assert.equal(
    toHex(projection.primary.main),
    projectPublic.brand.primary.toUpperCase(),
  );
  assert.equal(projection.aliases.length, 6);
  assert.equal(projection.primaryEffect.type, "DROP_SHADOW");
});
