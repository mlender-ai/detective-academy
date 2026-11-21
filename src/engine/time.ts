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
