// 底座的 Figma 稽核設定範本(專案維護;底座升級不覆蓋,base-sync 判為 project)。
// 用法見 ../README.md:在 Figma MCP use_figma 裡,把本檔全文貼在稽核腳本前面一起執行。
// 欄位意思見 README「設定檔欄位」。底座沒有自己的 Screens,頁面、元件名稱與例外留空;專案初始化時換成自己的值。
const AUDIT_CONFIG = {
  // 專案名詞:底座共用腳本(scripts/figma-audit/*.js)不得出現這些字(figma-audit.test.mjs 檢查)
  projectTerms: [],

  // 底座草稿頁:名稱以這個開頭的頁只綁底座變數,不檢查「殘留底座主色」
  baseDraftPagePrefix: "Base Draft",
  // 底座草稿元件 description 的固定前綴「【底座・本輪草稿,…】」
  draftMarker: "本輪草稿",
  // 本機過渡變數集合的名稱前綴(例 Draft/tagPalettes;回收後要沒有綁定)
  draftCollectionPrefix: "Draft/",
  // 底座 Library 的變數集合 key(Color / Radius / Primitives / Brand):專案從自己訂閱的 Library 取得後填入
  baseCollections: [],
  // 上面之中放 primary/* 的集合(Color、Brand):專案頁不得殘留這兩個集合的 primary/* 綁定
  basePrimaryCollections: [],

  // audit-layout.js
  layout: {
    // 欄位元件(主元件或元件集合名稱):同列欄位上緣與高度要一致
    field: /TextField|SelectField|Autocomplete|OrgTreeSelect|DatePicker/,
    // 容器內上下堆疊的列距(rowGapInContainer);不需要時設 null
    rowGap: null,
  },

  // audit-sync.js
  sync: {
    // 一次跑完的專案頁(頁 id)
    pages: [],
    // 只檢查遮罩(overlayNoPage / overlayNotCovering)的頁:[{ id, label }]
    overlayOnlyPages: [],
    // 回報時的頁名:去掉「Screen / 」前綴
    pageLabel: (name) => name.replace(/^Screen \/ /, ""),
    // 尺寸 Section 名稱 → 代號與畫面寬度;code 為 D 的是電腦(不查篩選抽屜、不比 app bar)
    sizes: {
      "電腦 1440": { code: "D", width: 1440 },
      "平板 1024": { code: "T", width: 1024 },
      "手機 390": { code: "M", width: 390 },
    },
    // 框名後綴 → 應放的尺寸 Section
    sizeSuffix: { " · 平板": "平板 1024", " · 手機": "手機 390" },
    // 畫面編號(框名開頭)
    screenCode: /^([A-Z]{2}-\d\d)/,
    // 不算按鈕的實例(主元件名稱)
    nonButton:
      /Tag|Badge|Select|TextField|Radio|Checkbox|Alert|Stepper|Avatar|Icon|OrgTree|Switch|Tab$|SideNav|NavRail|AppBar|TableCell/,
    // 標題列:這些實例、這些名稱的框(不在實例內)
    headInstance: /PageHeader/,
    headFrame: /^(toolbar|title|doc-head)$/,
    // 平板 / 手機最上面的 app bar;kindProp 屬性等於 skipKind 的是全螢幕對話框,不算標題列
    appBar: { name: /AdminAppBar/, kindProp: "Kind", skipKind: "Dialog" },
    // 手機收進選單的按鈕:[選單按鈕, 收起來的按鈕]
    merged: [],
    // 版面本來就不同的「畫面編號|按鈕|尺寸」,值是理由(回報時照列)
    exempt: {},
    // 共用區塊要用元件實例(sharedHandDrawn):依序比對框名,第一條符合的規則生效
    sharedBlocks: [
      {
        frame: /^(Stepper|stepper|steps)$/,
        contains: [[/StepperStep/, "要用 StepperStep"]],
      },
    ],
    // 篩選:按鈕文字、抽屜畫面名稱、註解裡寫明照共用規則的字
    filterButton: /^篩選/,
    filterDrawer: /篩選/,
    filterNote: /照共用篩選/,
  },

  // audit-legend.js
  legend: {
    // 標示用顏色(變數名稱):畫面上用到就要有圖例樣本
    mark: [],
    // 標示用元件(主元件或元件集合名稱):實例內部的顏色也算標示
    markers: /^$/,
    // 圖例項目元件與它的文字屬性
    legendItem: "Draft/LegendItem",
    legendLabelProp: "Label",
  },

  // audit.js
  audit: {
    // 畫面框內不能出現的開發用文字(devTextInScreens)
    devText: [/\b[A-Z]{2}-\d{2}[a-c]?\b/, /第 ?\d+(\.\d+)* ?(節|章)|規格/],
    // 底座參考畫面(baseScreensNotFromRef):底座草稿頁上寬度符合、名稱符合的框
    baseRefScreen: /^BS-/,
    baseRefWidth: 1440,
    baseRefNote: "對應現有畫面",
    baseAppBar: /AdminAppBar/,
  },

  // audit-crossview.js:跨畫面資料比對規則(名稱 → 規則)
  crossView: {},
};
