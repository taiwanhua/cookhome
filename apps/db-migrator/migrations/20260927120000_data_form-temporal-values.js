/**
 * data:表單提交的日期 / 日期時間值由字串改存 Mongo `Date`(兩者都是時點;`date` = 當地 00:00)。
 *
 * 轉的範圍(依那筆綁的版本定義 `form_versions.fields` 找出 `date` / `datetime` 欄位):
 * - `form_submissions.values.<key>`、`revisions[].values.<key>`、`summary.date`
 * - `workflow_instances.summary.date`(該修訂的摘要快照)
 * - `form_versions.fields`(含草稿):日期 / 日期時間欄的 `rules.min` / `max`、`default.value`、固定值,
 *   與所有表達式裡的 `YYYY-MM-DD` 常數 → 那一天在 `Asia/Taipei` 00:00 的 ISO(共用表單跨租戶,不依租戶時區)
 *
 * 字串怎麼換:
 * - `YYYY-MM-DD`(舊的 `date` 存法)→ 那一天在時區 00:00 的時點。時區 = 該修訂的 `ctx.timezone`;
 *   目前值與摘要用最後一個修訂的;草稿(沒有修訂)用租戶時區(租戶頂層 `settings.timezone`,根組織的資料用
 *   根組織的),都沒有 → `Asia/Taipei`
 * - 帶時區的 ISO 8601(舊的 `datetime` 存法、送出時間)→ 直接 parse
 * - 其他(已是 `Date`、空值、認不得的字串)不動 —— 冪等:重跑只會跳過
 *
 * 時區換算只用 `Intl.DateTimeFormat`(與 `@repo/domain/form` 的 `startOfLocalDay` 同一套作法);
 * 遷移檔自帶一份,不 import domain —— 之後 domain 怎麼改都不影響已經跑過的遷移。
 */

const DEFAULT_TIMEZONE = "Asia/Taipei";
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const ZONED_ISO =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:?\d{2})$/;
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

/** 一個存值 → `Date`;不用轉(已是 Date、空值、認不得)→ undefined。 */
function toDateValue(value, timezone) {
  if (typeof value !== "string") {
    return undefined;
  }
  if (DATE_ONLY.test(value)) {
    const zone = isValidTimezone(timezone) ? timezone : DEFAULT_TIMEZONE;
    const instant = startOfLocalDay(value, zone);
    return Number.isNaN(instant) ? undefined : new Date(instant);
  }
  if (ZONED_ISO.test(value)) {
    const instant = Date.parse(value);
    return Number.isNaN(instant) ? undefined : new Date(instant);
  }
  return undefined;
}

/** 一組值裡的日期 / 日期時間欄轉 `Date`;回 { values, changed }。 */
function convertValues(values, temporalKeys, timezone) {
  if (!values || typeof values !== "object") {
    return { values, changed: false };
  }
  const next = { ...values };
  let changed = false;
  for (const key of temporalKeys) {
    const converted = toDateValue(values[key], timezone);
    if (converted !== undefined) {
      next[key] = converted;
      changed = true;
    }
  }
  return { values: next, changed };
}

/** 版本定義的日期 / 日期時間欄 key(依 `formKey:version` 快取)。 */
function temporalKeysLoader(db) {
  const cache = new Map();
  return async (formKey, version) => {
    const cacheKey = `${formKey}:${String(version)}`;
    if (!cache.has(cacheKey)) {
      const doc = await db
        .collection("form_versions")
        .findOne({ formKey, version }, { projection: { fields: 1 } });
      cache.set(
        cacheKey,
        (doc?.fields ?? [])
          .filter((field) => field.type === "date" || field.type === "datetime")
          .map((field) => field.key),
      );
    }
    return cache.get(cacheKey);
  };
}

/** 租戶時區:租戶頂層(`tenantId`;null = 根組織)的 `settings.timezone`,沒設 → 預設。 */
function tenantTimezoneLoader(db) {
  const cache = new Map();
  return async (tenantId) => {
    const cacheKey = tenantId ? String(tenantId) : "root";
    if (!cache.has(cacheKey)) {
      const org = await db
        .collection("orgs")
        .findOne(tenantId ? { _id: tenantId } : { parentId: null }, {
          projection: { settings: 1 },
        });
      const timezone = org?.settings?.timezone;
      cache.set(
        cacheKey,
        isValidTimezone(timezone) ? timezone : DEFAULT_TIMEZONE,
      );
    }
    return cache.get(cacheKey);
  };
}

/** 版本定義裡的日期字串換算用的時區:共用表單跨租戶,一律用預設時區。 */
const DEFINITION_TIMEZONE = DEFAULT_TIMEZONE;

/** `YYYY-MM-DD` → 那一天在 `DEFINITION_TIMEZONE` 00:00 的 ISO;其他照舊。 */
function isoDayOf(value) {
  return typeof value === "string" && DATE_ONLY.test(value)
    ? new Date(startOfLocalDay(value, DEFINITION_TIMEZONE)).toISOString()
    : value;
}

/**
 * 表達式裡的日期常數:字串葉節點剛好是 `YYYY-MM-DD` 的換成 ISO(舊設計器的日期常數就是這個形;
 * `var` 的參數是欄位 key、`dateDiff` 的單位都不會長這樣)。回 { expr, changed }。
 */
function convertExpression(expr) {
  if (typeof expr === "string") {
    const next = isoDayOf(expr);
    return { expr: next, changed: next !== expr };
  }
  if (Array.isArray(expr)) {
    let changed = false;
    const next = expr.map((item) => {
      const converted = convertExpression(item);
      changed ||= converted.changed;
      return converted.expr;
    });
    return { expr: next, changed };
  }
  if (expr && typeof expr === "object") {
    let changed = false;
    const next = {};
    for (const [key, value] of Object.entries(expr)) {
      const converted = convertExpression(value);
      changed ||= converted.changed;
      next[key] = converted.expr;
    }
    return { expr: next, changed };
  }
  return { expr, changed: false };
}

/** `holder[key]` 是表達式時換日期常數;沒變回原物件。 */
function withConvertedExpression(holder, key, onChange) {
  if (!holder || holder[key] === undefined || holder[key] === null) {
    return holder;
  }
  const converted = convertExpression(holder[key]);
  if (!converted.changed) {
    return holder;
  }
  onChange();
  return { ...holder, [key]: converted.expr };
}

/**
 * 一個欄位定義:日期 / 日期時間欄的 `rules.min` / `max`、`default.value`(固定值)、`valueSource.value`
 * (固定值欄位);所有欄位的表達式(`valueSource.expr`、`default.expr`、`visibleWhen`、`readonlyWhen`、
 * `rules.custom`)裡的日期常數。回 { field, changed }。
 */
function convertField(field) {
  let next = { ...field };
  let changed = false;
  const markChanged = () => {
    changed = true;
  };
  const isTemporal = field.type === "date" || field.type === "datetime";
  if (isTemporal && field.rules) {
    const rules = { ...field.rules };
    for (const key of ["min", "max"]) {
      const converted = isoDayOf(rules[key]);
      if (converted !== rules[key]) {
        rules[key] = converted;
        changed = true;
      }
    }
    next.rules = rules;
  }
  if (isTemporal && field.default?.kind === "constant") {
    const converted = isoDayOf(field.default.value);
    if (converted !== field.default.value) {
      next.default = { ...field.default, value: converted };
      changed = true;
    }
  }
  if (isTemporal && field.valueSource?.kind === "constant") {
    const converted = isoDayOf(field.valueSource.value);
    if (converted !== field.valueSource.value) {
      next.valueSource = { ...field.valueSource, value: converted };
      changed = true;
    }
  }
  if (next.valueSource?.kind === "computed") {
    next.valueSource = withConvertedExpression(
      next.valueSource,
      "expr",
      markChanged,
    );
  }
  if (next.default?.kind === "expression") {
    next.default = withConvertedExpression(next.default, "expr", markChanged);
  }
  if (next.rules) {
    next.rules = withConvertedExpression(next.rules, "custom", markChanged);
  }
  next = withConvertedExpression(next, "visibleWhen", markChanged);
  next = withConvertedExpression(next, "readonlyWhen", markChanged);
  return { field: next, changed };
}

/** `form_versions`(含草稿)的定義:日期字串換成 ISO(時區 `DEFINITION_TIMEZONE`);冪等。 */
async function convertDefinitions(db) {
  const versions = db.collection("form_versions");
  for await (const doc of versions.find({}, { projection: { fields: 1 } })) {
    if (!Array.isArray(doc.fields)) {
      continue;
    }
    let changed = false;
    const fields = doc.fields.map((field) => {
      const converted = convertField(field);
      changed ||= converted.changed;
      return converted.field;
    });
    if (changed) {
      await versions.updateOne({ _id: doc._id }, { $set: { fields } });
    }
  }
}

/** 修訂的時區:`ctx.timezone`,沒有就退回租戶時區。 */
function revisionTimezone(revision, fallback) {
  const timezone = revision?.ctx?.timezone;
  return isValidTimezone(timezone) ? timezone : fallback;
}

/**
 * @param db {import('mongodb').Db}
 * @returns {Promise<void>}
 */
export const up = async (db) => {
  await convertDefinitions(db);
  const temporalKeysOf = temporalKeysLoader(db);
  const tenantTimezoneOf = tenantTimezoneLoader(db);
  const submissions = db.collection("form_submissions");
  const cursor = submissions.find(
    {},
    {
      projection: {
        formKey: 1,
        version: 1,
        tenantId: 1,
        values: 1,
        summary: 1,
        revisions: 1,
      },
    },
  );
  for await (const submission of cursor) {
    const tenantTimezone = await tenantTimezoneOf(submission.tenantId ?? null);
    const revisions = Array.isArray(submission.revisions)
      ? submission.revisions
      : [];
    const latestTimezone = revisionTimezone(revisions.at(-1), tenantTimezone);
    const keys = await temporalKeysOf(submission.formKey, submission.version);
    const $set = {};

    const current = convertValues(submission.values, keys, latestTimezone);
    if (current.changed) {
      $set.values = current.values;
    }
    let revisionsChanged = false;
    const nextRevisions = revisions.map((revision) => {
      const converted = convertValues(
        revision.values,
        keys,
        revisionTimezone(revision, tenantTimezone),
      );
      revisionsChanged ||= converted.changed;
      return converted.changed
        ? { ...revision, values: converted.values }
        : revision;
    });
    if (revisionsChanged) {
      $set.revisions = nextRevisions;
    }
    const summaryDate = toDateValue(submission.summary?.date, latestTimezone);
    if (summaryDate !== undefined) {
      $set["summary.date"] = summaryDate;
    }
    if (Object.keys($set).length > 0) {
      await submissions.updateOne({ _id: submission._id }, { $set });
    }
  }

  const instances = db.collection("workflow_instances");
  const instanceCursor = instances.find(
    { "summary.date": { $type: "string" } },
    { projection: { submissionId: 1, revision: 1, summary: 1 } },
  );
  for await (const instance of instanceCursor) {
    const submission = await submissions.findOne(
      { _id: instance.submissionId },
      { projection: { tenantId: 1, revisions: 1 } },
    );
    const tenantTimezone = await tenantTimezoneOf(submission?.tenantId ?? null);
    const revision = (submission?.revisions ?? []).find(
      (entry) => entry.revision === instance.revision,
    );
    const date = toDateValue(
      instance.summary.date,
      revisionTimezone(revision, tenantTimezone),
    );
    if (date !== undefined) {
      await instances.updateOne(
        { _id: instance._id },
        { $set: { "summary.date": date } },
      );
    }
  }
};

/**
 * 還原成字串(改存 `Date` 之前的形狀,依版本定義的欄位型別):
 * - `date` 欄 → 該修訂時區的 `YYYY-MM-DD`;`datetime` 欄 → 秒級 ISO(`YYYY-MM-DDTHH:mm:ssZ`)
 * - 摘要槽 `date`:對到日期欄 → `YYYY-MM-DD`、對到日期時間欄 → 秒級 ISO、沒對(= 送出時間)→ `toISOString()`
 * - 版本定義的 ISO 上下限 / 常數不還原(分不出哪些是這支遷移轉的;ISO 在舊程式裡也是合法的日期時間)
 *
 * @param db {import('mongodb').Db}
 * @returns {Promise<void>}
 */
export const down = async (db) => {
  const tenantTimezoneOf = tenantTimezoneLoader(db);
  const versionCache = new Map();
  /** 版本的欄位型別與摘要槽 `date` 對到的欄位。 */
  const versionOf = async (formKey, version) => {
    const cacheKey = `${formKey}:${String(version)}`;
    if (!versionCache.has(cacheKey)) {
      const doc = await db
        .collection("form_versions")
        .findOne(
          { formKey, version },
          { projection: { fields: 1, summaryMap: 1 } },
        );
      versionCache.set(cacheKey, {
        types: new Map(
          (doc?.fields ?? []).map((field) => [field.key, field.type]),
        ),
        summaryDateKey: doc?.summaryMap?.date ?? null,
      });
    }
    return versionCache.get(cacheKey);
  };
  const isoOf = (date) => `${date.toISOString().slice(0, 19)}Z`;
  const dayOf = (date, timezone) =>
    new Date(localDayMs(date.getTime(), timezone)).toISOString().slice(0, 10);
  const revert = (values, types, timezone) => {
    if (!values || typeof values !== "object") {
      return values;
    }
    const next = { ...values };
    for (const [key, value] of Object.entries(values)) {
      if (value instanceof Date) {
        next[key] =
          types.get(key) === "date" ? dayOf(value, timezone) : isoOf(value);
      }
    }
    return next;
  };
  const summaryDateOf = (date, version, timezone) => {
    const type = version.summaryDateKey
      ? version.types.get(version.summaryDateKey)
      : undefined;
    if (type === "date") {
      return dayOf(date, timezone);
    }
    return type === "datetime" ? isoOf(date) : date.toISOString();
  };

  const submissions = db.collection("form_submissions");
  for await (const submission of submissions.find({})) {
    const tenantTimezone = await tenantTimezoneOf(submission.tenantId ?? null);
    const revisions = Array.isArray(submission.revisions)
      ? submission.revisions
      : [];
    const latestTimezone = revisionTimezone(revisions.at(-1), tenantTimezone);
    const version = await versionOf(submission.formKey, submission.version);
    const $set = {
      values: revert(submission.values, version.types, latestTimezone),
      revisions: revisions.map((revision) => ({
        ...revision,
        values: revert(
          revision.values,
          version.types,
          revisionTimezone(revision, tenantTimezone),
        ),
      })),
    };
    if (submission.summary?.date instanceof Date) {
      $set["summary.date"] = summaryDateOf(
        submission.summary.date,
        version,
        latestTimezone,
      );
    }
    await submissions.updateOne({ _id: submission._id }, { $set });
  }
  const instances = db.collection("workflow_instances");
  for await (const instance of instances.find({
    "summary.date": { $type: "date" },
  })) {
    const submission = await submissions.findOne(
      { _id: instance.submissionId },
      { projection: { formKey: 1, version: 1, tenantId: 1, revisions: 1 } },
    );
    const tenantTimezone = await tenantTimezoneOf(submission?.tenantId ?? null);
    const revision = (submission?.revisions ?? []).find(
      (entry) => entry.revision === instance.revision,
    );
    const version = submission
      ? await versionOf(submission.formKey, submission.version)
      : { types: new Map(), summaryDateKey: null };
    await instances.updateOne(
      { _id: instance._id },
      {
        $set: {
          "summary.date": summaryDateOf(
            instance.summary.date,
            version,
            revisionTimezone(revision, tenantTimezone),
          ),
        },
      },
    );
  }
};
