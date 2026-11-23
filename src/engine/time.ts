/** 일일 문제 날짜 기준은 Asia/Seoul 이다. */
export const GAME_TIME_ZONE = "Asia/Seoul";

/** Asia/Seoul 기준 YYYY-MM-DD */
export function seoulDateKey(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: GAME_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** "11월 20일" */
export function seoulDateLabel(date: Date = new Date()): string {
  const [, month, day] = seoulDateKey(date).split("-");
  return `${Number(month)}월 ${Number(day)}일`;
}

/** "2026.11.20" */
export function dottedDate(iso: string | null): string {
  if (!iso) return "-";
  return seoulDateKey(new Date(iso)).replaceAll("-", ".");
}

/** 경과 시간 "02:07" */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/** 기록용 "2분 7초" */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  if (minutes === 0) return `${seconds}초`;
  return `${minutes}분 ${seconds}초`;
}

/** 남은 시간 "12:07". 올림해서 보여 준다(0:00 이 보이는 순간이 끝이다). */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

const DAY_MS = 86_400_000;

function keyToUtc(key: string): number {
  const [year, month, day] = key.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

/** 날짜 이름표인가: "2026-11-22" */
export function isDateKey(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(keyToUtc(value));
}

/** 두 날짜 사이의 날수 (to - from) */
export function daysBetween(fromKey: string, toKey: string): number {
  return Math.round((keyToUtc(toKey) - keyToUtc(fromKey)) / DAY_MS);
}

/** 날짜에 날수를 더한다: addDays("2026-11-22", 1) → "2026-11-23" */
export function addDays(key: string, days: number): string {
  return new Date(keyToUtc(key) + days * DAY_MS).toISOString().slice(0, 10);
}
