/**
 * data:資料範圍規則的日期條件值由 `YYYY-MM-DD` 改存時點(帶時區的 ISO 8601),與表單引擎的日期同一種做法:
 * 值 = 選的那一天在租戶時區 00:00 的時點。
 *
 * 轉的範圍:`data_scope_rules.rules[].filter` 條件樹裡,運算子是 `between` / `before` / `after`
 * (只有日期型別有這三個)、值是靜態清單的條件列;清單裡剛好是 `YYYY-MM-DD` 的字串換成 ISO。
 *
 * 時區:規則屬於根組織(「資料範圍」是根組織專屬模組,admin 以根組織的租戶時區換算),
 * 所以用根組織的 `settings.timezone`;沒設或不合法 → `Asia/Taipei`。
 *
 * 冪等:已是 ISO 的值、不認得的值都不動,重跑只會跳過。
 *
 * 時區換算只用 `Intl.DateTimeFormat`(與 `@repo/domain/form` 的 `startOfLocalDay` 同一套作法);
 * 遷移檔自帶一份,不 import domain —— 之後 domain 怎麼改都不影響已經跑過的遷移。
 */

const DEFAULT_TIMEZONE = "Asia/Taipei";
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const ZONED_ISO =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:?\d{2})$/;
const DATE_CONDITIONS = new Set(["between", "before", "after"]);
const MS_PER_DAY = 86_400_000;

const formatters = new Map();

/** 某時點在某時區的牆上時間(當成 UTC 的 ms);時區不合法 → 丟 RangeError。 */
function wallMsAt(instant, timezone) {
  let formatter = formatters.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatters.set(timezone, formatter);
  }
  const parts = formatter.formatToParts(new Date(instant));
  const part = (type) =>
    Number(parts.find((item) => item.type === type)?.value);
  return Date.UTC(
    part("year"),
    part("month") - 1,
    part("day"),
    part("hour") % 24,
    part("minute"),
    part("second"),
  );
}

function isValidTimezone(timezone) {
  if (typeof timezone !== "string" || timezone === "") {
    return false;
  }
  try {
    wallMsAt(0, timezone);
    return true;
  } catch {
    return false;
  }
}

/** 某時點的當地日期(當成 UTC 午夜的 ms)。 */
function localDayMs(instant, timezone) {
  const wall = wallMsAt(instant, timezone);
  return wall - (((wall % MS_PER_DAY) + MS_PER_DAY) % MS_PER_DAY);
}

/**
 * `YYYY-MM-DD` 在某時區 00:00 的時點:猜一個時點 → 用 Intl 取當地時間 → 修正,再試前後一天的位移
 * (夏令時間切換日);取落在當天的最早候選(午夜不存在的時區 = 當天第一個時點)。
 */
function startOfLocalDay(text, timezone) {
  const match = DATE_ONLY.exec(text);
  const target = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );
  const offsetAt = (instant) =>
    wallMsAt(instant, timezone) - (instant - (instant % 1000));
  const candidates = new Set();
  let guess = target;
  for (let round = 0; round < 3; round += 1) {
    guess = target - offsetAt(guess);
    candidates.add(guess);
  }
  for (const probe of [target - MS_PER_DAY, target + MS_PER_DAY]) {
    candidates.add(target - offsetAt(probe));
  }
  const sorted = [...candidates].sort((a, b) => a - b);
  return (
    sorted.find((candidate) => localDayMs(candidate, timezone) === target) ??
    sorted[0]
  );
}

/** 根組織的時區(規則屬於根組織)。 */
async function rootTimezoneOf(db) {
  const root = await db
    .collection("orgs")
    .findOne({ parentId: null }, { projection: { settings: 1 } });
  const timezone = root?.settings?.timezone;
  return isValidTimezone(timezone) ? timezone : DEFAULT_TIMEZONE;
}

/**
 * 走一棵條件樹,把日期條件列的值交給 `convert`(回傳新值;`undefined` = 不動)。回 { node, changed }。
 */
function convertNode(node, convert) {
  if (!node || typeof node !== "object") {
    return { node, changed: false };
  }
  if (Array.isArray(node.children)) {
    let changed = false;
    const children = node.children.map((child) => {
      const converted = convertNode(child, convert);
      changed ||= converted.changed;
      return converted.node;
    });
    return changed
      ? { node: { ...node, children }, changed }
      : { node, changed };
  }
  const value = node.value;
  if (
    !DATE_CONDITIONS.has(node.cond) ||
    value?.kind !== "static" ||
    !Array.isArray(value.values)
  ) {
    return { node, changed: false };
  }
  let changed = false;
  const values = value.values.map((item) => {
    const next = convert(item);
    if (next === undefined) {
      return item;
    }
    changed = true;
    return next;
  });
  return changed
    ? { node: { ...node, value: { ...value, values } }, changed }
    : { node, changed };
}

/** 全部規則文件的日期條件值套 `convert`;有變才寫。 */
async function convertRules(db, convert) {
  const collection = db.collection("data_scope_rules");
  for await (const doc of collection.find({}, { projection: { rules: 1 } })) {
    if (!Array.isArray(doc.rules)) {
      continue;
    }
    let changed = false;
    const rules = doc.rules.map((rule) => {
      if (!rule || typeof rule !== "object") {
        return rule;
      }
      const converted = convertNode(rule.filter, convert);
      changed ||= converted.changed;
      return converted.changed ? { ...rule, filter: converted.node } : rule;
    });
    if (changed) {
      await collection.updateOne({ _id: doc._id }, { $set: { rules } });
    }
  }
}

/**
 * @param db {import('mongodb').Db}
 * @returns {Promise<void>}
 */
export const up = async (db) => {
  const timezone = await rootTimezoneOf(db);
  await convertRules(db, (item) =>
    typeof item === "string" && DATE_ONLY.test(item)
      ? new Date(startOfLocalDay(item, timezone)).toISOString()
      : undefined,
  );
};

/**
 * 還原成 `YYYY-MM-DD`:時點換成根組織時區的當地日期。
 *
 * @param db {import('mongodb').Db}
 * @returns {Promise<void>}
 */
export const down = async (db) => {
  const timezone = await rootTimezoneOf(db);
  await convertRules(db, (item) =>
    typeof item === "string" && ZONED_ISO.test(item)
      ? new Date(localDayMs(Date.parse(item), timezone))
          .toISOString()
          .slice(0, 10)
      : undefined,
  );
};
