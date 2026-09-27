/**
 * 日期與日期時間(Spec 6a §5「值的存法」`date` / `datetime`、表達式 `dateDiff`):
 *
 * - `date` 存 `YYYY-MM-DD`(日曆日,沒有時區)
 * - `datetime` 存 ISO 8601 UTC(`YYYY-MM-DDTHH:mm:ssZ`,秒以下捨去);以**租戶時區**輸入與顯示
 * - 兩者要換成時點比較時(`dateDiff` 的小時 / 分鐘),`date` 視為**租戶時區**當天 00:00
 *
 * 不依賴日期套件:時區換算只用 `Intl.DateTimeFormat`(前後端都有),結果一致。
 */

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 收的日期時間字串:一定要有 `T` 與時區標記(`Z` 或 `±hh:mm`),沒有時區的字串語意不明,不收。
 * 分兩段比對(時區尾碼 + 本地時間),每段的正則都保持簡單。
 */
const ZONE_SUFFIX = /(?:Z|[+-]\d{2}:?\d{2})$/;
const LOCAL_DATE_TIME =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?$/;

/** 存值的正規形:`YYYY-MM-DDTHH:mm:ssZ`。 */
const DATE_TIME_STORED = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 3_600_000;

/** 是不是帶時區的 ISO 8601 日期時間字串(且是真的時點)。 */
export function isDateTimeString(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  const zone = ZONE_SUFFIX.exec(value);
  return (
    zone !== null &&
    LOCAL_DATE_TIME.test(value.slice(0, zone.index)) &&
    !Number.isNaN(Date.parse(value))
  );
}

/** 已經是存值正規形(`YYYY-MM-DDTHH:mm:ssZ`)。 */
export function isStoredDateTime(value: unknown): value is string {
  return (
    typeof value === "string" &&
    DATE_TIME_STORED.test(value) &&
    toStoredDateTime(new Date(value)) === value
  );
}

/** 時點 → 存值正規形(UTC、秒以下捨去)。 */
export function toStoredDateTime(date: Date): string {
  return `${date.toISOString().slice(0, 19)}Z`;
}

/** 帶時區的日期時間字串 → 存值正規形;不合法回 null。 */
export function normalizeDateTime(value: unknown): string | null {
  if (!isDateTimeString(value)) {
    return null;
  }
  return toStoredDateTime(new Date(value));
}

/** 某時區的牆上時間(年月日時分秒)。 */
export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const pad = (number: number, length = 2): string =>
  String(number).padStart(length, "0");

/** 某時點在某時區的年月日時分秒;時區不合法回 null。 */
function zonedPartsOf(instant: number, timezone: string): ZonedParts | null {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(new Date(instant));
  } catch {
    return null;
  }
  const part = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((item) => item.type === type)?.value ?? Number.NaN);
  return {
    year: part("year"),
    month: part("month"),
    day: part("day"),
    // 部分執行環境在 h23 仍把午夜印成 24
    hour: part("hour") % 24,
    minute: part("minute"),
    second: part("second"),
  };
}

/** 時區在某時點相對 UTC 的位移(ms);時區不合法回 null。 */
function offsetAt(instant: number, timezone: string): number | null {
  const parts = zonedPartsOf(instant, timezone);
  if (parts === null) {
    return null;
  }
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/**
 * 某時區的「牆上時間」→ 時點(ms)。夏令時間切換時取切換後的位移再校正一次;
 * 時區不合法回 null。
 */
export function zonedTimeToInstant(
  wall: ZonedParts,
  timezone: string,
): number | null {
  const guess = Date.UTC(
    wall.year,
    wall.month - 1,
    wall.day,
    wall.hour,
    wall.minute,
    wall.second,
  );
  const first = offsetAt(guess, timezone);
  if (first === null) {
    return null;
  }
  const candidate = guess - first;
  const second = offsetAt(candidate, timezone);
  return second === null || second === first ? candidate : guess - second;
}

/** `YYYY-MM-DD` 在某時區當天 00:00 的時點(ms);不合法回 null。 */
export function zonedMidnightOf(date: string, timezone: string): number | null {
  if (!DATE_ONLY.test(date)) {
    return null;
  }
  const [year = 0, month = 0, day = 0] = date.split("-").map(Number);
  return zonedTimeToInstant(
    { year, month, day, hour: 0, minute: 0, second: 0 },
    timezone,
  );
}

/**
 * 表達式值 → 時點(ms):日期時間字串照它的時點;`YYYY-MM-DD` = 租戶時區當天 00:00;
 * `Date` 物件照它的時點;其餘(含空值)回 null。
 */
export function instantOf(value: unknown, timezone: string): number | null {
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isNaN(time) ? null : time;
  }
  if (typeof value !== "string") {
    return null;
  }
  if (DATE_ONLY.test(value)) {
    return zonedMidnightOf(value, timezone);
  }
  return isDateTimeString(value) ? Date.parse(value) : null;
}

/** 一個單位有幾毫秒(`dateDiff` 的精確差用)。 */
export const MS_PER_UNIT = {
  hours: MS_PER_HOUR,
  minutes: MS_PER_MINUTE,
} as const;

/** 迄 − 起 的毫秒差(`date` = 租戶時區當天 00:00);任一無效 → null。 */
export function instantDiffMs(
  start: unknown,
  end: unknown,
  timezone: string,
): number | null {
  const from = instantOf(start, timezone);
  const to = instantOf(end, timezone);
  return from === null || to === null ? null : to - from;
}

/**
 * 存值的日期時間 → 某時區的牆上時間 `YYYY-MM-DDTHH:mm`(給 `datetime-local` 這類輸入元件);
 * 不合法回 null。
 */
export function toZonedWallTime(
  value: unknown,
  timezone: string,
): string | null {
  const instant = instantOf(value, timezone);
  if (instant === null) {
    return null;
  }
  const parts = zonedPartsOf(instant, timezone);
  if (parts === null) {
    return null;
  }
  return `${pad(parts.year, 4)}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

/** 某時區的牆上時間 `YYYY-MM-DDTHH:mm[:ss]` → 存值正規形;不合法回 null。 */
export function fromZonedWallTime(
  wall: string,
  timezone: string,
): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(
    wall,
  );
  if (!match) {
    return null;
  }
  const [, year, month, day, hour, minute, second = "0"] = match;
  const instant = zonedTimeToInstant(
    {
      year: Number(year),
      month: Number(month),
      day: Number(day),
      hour: Number(hour),
      minute: Number(minute),
      second: Number(second),
    },
    timezone,
  );
  return instant === null ? null : toStoredDateTime(new Date(instant));
}
