/**
 * 測試場景夾具:底座 Library、consumer 檔與 instance 的建立方式(含巢狀來源覆寫、swap、隱藏槽、圖片與私有變數)。
 */
import { createFigmaBrandProjection } from "./brand.mjs";

export const ROLES = ["lighter", "light", "main", "dark", "darker", "contrast"];
export const BASE_FILE = "BASEfile01";
export const BRAND_FILE = "BRANDfile01";
export const CONSUMER_FILE = "CONSUMERfile01";

/** 多品牌夾具:不鎖正式專案的名稱或顏色。 */
export const brandFixture = (name = "Acme", primary = "#1C4AD9") => ({
  slug: "acme-widgets",
  brand: { name, primary },
});
const BASE_PROJECTION = createFigmaBrandProjection(
  brandFixture("Base", "#D9541C"),
);
const solid = (color, extra = {}) => ({
  type: "SOLID",
  visible: true,
  opacity: 1,
  blendMode: "NORMAL",
  color: { r: color.r, g: color.g, b: color.b },
  ...extra,
});
const GREY = { r: 0.2, g: 0.2, b: 0.2, a: 1 };

export const bound = (variable, extra) =>
  solid(GREY, {
    boundVariables: { color: { type: "VARIABLE_ALIAS", id: variable.id } },
    ...extra,
  });
export const fixed = (color = GREY, extra) => solid(color, extra);
const alias = (variable) => ({ type: "VARIABLE_ALIAS", id: variable.id });

/** 以元件樹建立 instance:後代沿用來源子樹的現值(含來源 instance 自己施加的覆寫)。 */
export function instantiate(world, fileKey, component, id) {
  const clone = (source, nodeId, isRoot) => {
    const node = world.node(fileKey, {
      ...source,
      id: nodeId,
      type: isRoot ? "INSTANCE" : source.type,
      mainComponent: isRoot ? component : source.mainComponent,
      fills: source.fills?.map((paint) => ({ ...paint })),
      strokes: source.strokes?.map((paint) => ({ ...paint })),
      effectStyleId: source.effectStyleId,
      children: source.children ? [] : undefined,
    });
    delete node.key;
    for (const child of source.children ?? []) {
      node.append(clone(child, `I${id};${child.id}`, false));
    }
    return node;
  };
  return clone(component, id, true);
}

/** 使用者 swap:instance 改指另一個 main,後代換成新來源的子樹。 */
export function swapInstance(world, instance, component) {
  const fresh = instantiate(
    world,
    instance.fileKey,
    component,
    `${instance.id}~swap`,
  );
  instance.mainComponent = component;
  instance.children = [];
  for (const child of fresh.children) instance.append(child);
  return instance;
}

/** 底座 Library:Brand → Color 兩集合、非品牌 token、Shadow/Primary 與代表元件。 */
export function buildBaseLibrary(world, fileKey = BASE_FILE) {
  const [page] = world.addFile(fileKey, ["Components"]);
  const brandCollection = world.addCollection(fileKey, "Brand", ["Light"]);
  const colorCollection = world.addCollection(fileKey, "Color", ["Light"]);
  const brand = {};
  const color = {};
  for (const role of ROLES) {
    brand[role] = world.addVariable(
      fileKey,
      `primary/${role}`,
      brandCollection,
      {
        [brandCollection.defaultModeId]: BASE_PROJECTION.primary[role],
      },
    );
    color[role] = world.addVariable(
      fileKey,
      `primary/${role}`,
      colorCollection,
      {
        [colorCollection.defaultModeId]: alias(brand[role]),
      },
    );
  }
  const neutral = world.addVariable(fileKey, "text/primary", colorCollection, {
    [colorCollection.defaultModeId]: GREY,
  });
  const error = world.addVariable(fileKey, "error/main", colorCollection, {
    [colorCollection.defaultModeId]: { r: 1, g: 0.3, b: 0.2, a: 1 },
  });
  const shadow = world.addStyle(fileKey, "Shadow/Primary", [
    BASE_PROJECTION.primaryEffect,
  ]);
  const cardShadow = world.addStyle(fileKey, "Shadow/Card", [
    { ...BASE_PROJECTION.primaryEffect, color: { ...GREY, a: 0.1 } },
  ]);
  const component = (id, name, spec) =>
    page.append(
      world.node(fileKey, {
        id,
        type: "COMPONENT",
        name,
        key: world.nextKey("comp"),
        ...spec,
      }),
    );
  const node = (id, type, spec) => world.node(fileKey, { id, type, ...spec });
  const text = (id, characters, fills) =>
    node(id, "TEXT", {
      characters,
      fills,
      fontName: { family: "Public Sans", style: "Regular" },
    });

  const button = component("1:10", "Button", {
    fills: [bound(color.main)],
    strokes: [bound(color.dark)],
    effectStyleId: shadow.id,
    cornerRadius: 8,
    children: [text("1:11", "Label", [bound(color.contrast)])],
  });
  const errorButton = component("1:15", "Button/Error", {
    fills: [bound(error)],
    effectStyleId: cardShadow.id,
    children: [text("1:16", "Delete", [fixed({ r: 1, g: 1, b: 1 })])],
  });
  const iconA = component("1:20", "Icon/A", {
    children: [node("1:21", "VECTOR", { fills: [bound(color.main)] })],
  });
  const iconB = component("1:25", "Icon/B", {
    children: [node("1:26", "VECTOR", { fills: [bound(color.dark)] })],
  });
  // NavItem 的孤立 master 沒有 fill;SideNav 內的來源 instance 自己覆寫成 primary/lighter
  const navItem = component("1:30", "NavItem", {
    fills: [fixed()],
    children: [text("1:31", "Item", [bound(neutral)])],
  });
  const activeItem = instantiate(world, fileKey, navItem, "1:41");
  activeItem.fills = [bound(color.lighter)];
  const spareItem = instantiate(world, fileKey, navItem, "1:42");
  spareItem.visible = false;
  spareItem.fills = [bound(color.light)];
  const sideNav = component("1:40", "SideNav", {
    fills: [fixed({ r: 1, g: 1, b: 1 })],
    children: [
      text("1:43", "Org", [bound(neutral)]),
      activeItem,
      spareItem,
      instantiate(world, fileKey, iconA, "1:44"),
    ],
  });
  // Dialog dot 位於 child-index 路徑 [1,0,1]
  const dialog = component("1:50", "Dialog", {
    fills: [fixed({ r: 1, g: 1, b: 1 })],
    children: [
      text("1:51", "Title", [bound(neutral)]),
      node("1:52", "FRAME", {
        children: [
          node("1:53", "FRAME", {
            children: [
              text("1:54", "Body", [bound(neutral)]),
              node("1:55", "ELLIPSE", { fills: [bound(color.light)] }),
            ],
          }),
        ],
      }),
    ],
  });
  world.resetLog();
  return {
    fileKey,
    page,
    brand,
    color,
    neutral,
    error,
    shadow,
    cardShadow,
    components: { button, errorButton, iconA, iconB, navItem, sideNav, dialog },
  };
}

/** consumer:範圍內的實例與各種客製,另有一個 scope 外的控制 frame。 */
export function buildConsumer(world, base, fileKey = CONSUMER_FILE) {
  const [page] = world.addFile(fileKey, ["Screens"]);
  const { components, color } = base;
  const privateCollection = world.addCollection(fileKey, "Project", ["Light"]);
  // 專案私有變數:HEX 與底座主色相同,仍不是受管品牌
  const privateColor = world.addVariable(fileKey, "accent", privateCollection, {
    [privateCollection.defaultModeId]: BASE_PROJECTION.primary.main,
  });
  const make = (component, id) => instantiate(world, fileKey, component, id);
  const button = make(components.button, "10:2");
  const customButton = make(components.button, "10:3");
  customButton.fills = [fixed({ r: 0.5, g: 0, b: 0.5 })];
  customButton.children[0].characters = "自訂文字";
  const privateButton = make(components.button, "10:4");
  privateButton.fills = [bound(privateColor)];
  const sideNav = make(components.sideNav, "10:5");
  swapInstance(world, sideNav.children[3], components.iconB);
  const dialog = make(components.dialog, "10:6");
  const image = world.node(fileKey, {
    id: "10:7",
    type: "RECTANGLE",
    fills: [
      { type: "IMAGE", imageHash: "hash-logo", visible: true, opacity: 1 },
      bound(color.main, { opacity: 0.5 }),
    ],
  });
  const errorButton = make(components.errorButton, "10:8");
  const root = page.append(
    world.node(fileKey, {
      id: "10:1",
      type: "FRAME",
      name: "Screen",
      fills: [fixed({ r: 1, g: 1, b: 1 })],
      children: [
        button,
        customButton,
        privateButton,
        sideNav,
        dialog,
        image,
        errorButton,
      ],
    }),
  );
  const control = page.append(
    world.node(fileKey, {
      id: "20:1",
      type: "FRAME",
      name: "Other screen",
      fills: [fixed()],
      children: [make(components.button, "20:2")],
    }),
  );
  world.resetLog();
  return {
    fileKey,
    page,
    root,
    control,
    privateColor,
    nodes: {
      button,
      customButton,
      privateButton,
      sideNav,
      dialog,
      image,
      errorButton,
    },
  };
}
