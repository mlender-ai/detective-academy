/**
 * 게임의 "지금". 평소에는 실제 시각이다.
 * 검수할 때만 날짜를 옮길 수 있다: 주소의 ?demo=1&date=2026-11-25, 또는 QA 패널의 "다음 날로"(저장소의 DATE_KEY).
 * 날짜를 옮기면 오늘의 추리 배정과 하루 응시 횟수가 그 날짜를 따른다. 시각(시·분·초)은 실제 그대로다.
 */
import { addDays, daysBetween, isDateKey, seoulDateKey } from "../engine/time";

export const DATE_KEY = "detective-academy:date";

const DAY_MS = 86_400_000;

function fromAddress(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  if (params.get("demo") !== "1") return null;
  const date = params.get("date");
  return isDateKey(date) ? date : null;
}

const ADDRESS_DATE = fromAddress();

/** 검수용으로 옮겨 둔 날짜. 없으면 null */
export function dateOverride(): string | null {
  if (ADDRESS_DATE) return ADDRESS_DATE;
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(DATE_KEY);
    return isDateKey(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function gameNow(): Date {
  const real = new Date();
  const wanted = dateOverride();
  if (!wanted) return real;
  return new Date(real.getTime() + daysBetween(seoulDateKey(real), wanted) * DAY_MS);
}

/** 오늘의 날짜 (Asia/Seoul, YYYY-MM-DD) */
export function todayKey(): string {
  return seoulDateKey(gameNow());
}

/** 검수용: 날짜를 하루 넘기거나(days), 실제 날짜로 되돌린다(null) */
export function shiftDate(days: number | null): string | null {
  if (typeof window === "undefined") return null;
  try {
    if (days === null) {
      window.localStorage.removeItem(DATE_KEY);
      return null;
    }
    const next = addDays(todayKey(), days);
    window.localStorage.setItem(DATE_KEY, next);
    return next;
  } catch {
    return null;
  }
}
