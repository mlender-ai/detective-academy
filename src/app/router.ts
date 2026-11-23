/**
 * 해시 기반 화면 라우터. 정적 호스팅·웹뷰(Capacitor)에서 서버 설정 없이 동작한다.
 * 화면 전환은 View Transitions 를 쓰고, 지원하지 않거나 모션 줄이기 설정이면 즉시 바꾼다.
 */
import { useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { prefersReducedMotion } from "./motion";

export type Route =
  | { name: "home" }
  | { name: "daily" }
  /** 지난 사건: 달력에서 오늘까지 붙었던 오늘의 추리의 목록 */
  | { name: "daily-past" }
  /** 지난 사건 하나의 풀이(또는 기록). id 는 문제의 이름표 */
  | { name: "daily-past-play"; id: string }
  | { name: "practice" }
  | { name: "practice-play"; id: string }
  | { name: "exam" }
  | { name: "profile" }
  /** 사건 수사(스토리). id 는 사건의 이름표 */
  | { name: "story"; id: string };

export function toHash(route: Route): string {
  switch (route.name) {
    case "home":
      return "#/";
    case "daily":
      return "#/daily";
    case "daily-past":
      return "#/daily/past";
    case "daily-past-play":
      return `#/daily/past/${encodeURIComponent(route.id)}`;
    case "practice":
      return "#/practice";
    case "practice-play":
      return `#/practice/${encodeURIComponent(route.id)}`;
    case "exam":
      return "#/exam";
    case "profile":
      return "#/profile";
    case "story":
      return `#/story/${encodeURIComponent(route.id)}`;
  }
}

/** 주소의 조각을 푼다. 깨진 값(%만 있는 주소 등)이면 그대로 돌려준다: 없는 이름표가 되어 화면이 안전하게 돌려보낸다. */
function safeDecode(part: string): string {
  try {
    return decodeURIComponent(part);
  } catch {
    return part;
  }
}

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#\/?/, "");
  const [head, tail, leaf] = path.split("/");
  switch (head) {
    case "daily":
      if (tail === "past") return leaf ? { name: "daily-past-play", id: safeDecode(leaf) } : { name: "daily-past" };
      return { name: "daily" };
    case "practice":
      return tail ? { name: "practice-play", id: safeDecode(tail) } : { name: "practice" };
    case "exam":
      return { name: "exam" };
    case "profile":
      return { name: "profile" };
    case "story":
      return tail ? { name: "story", id: safeDecode(tail) } : { name: "home" };
    default:
      return { name: "home" };
  }
}

let current: Route = typeof window === "undefined" ? { name: "home" } : parseHash(window.location.hash);
/** 앱 안에서 쌓인 이동 횟수. 0이면 뒤로 갈 앱 화면이 없다. */
let depth = 0;
/** 같은 주소의 화면을 처음부터 다시 연 횟수 (navigate 의 fresh) */
let visit = 0;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

type TransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => unknown;
};

/**
 * 화면을 바꾸는 동안 같은 물건(시험지, 자물쇠)이 이어지도록 전환한다.
 * direction 은 CSS 가 들어가는 장면과 돌아오는 장면을 다르게 그리는 데 쓴다.
 */
export function withTransition(update: () => void, direction: "forward" | "back" = "forward") {
  const doc = document as TransitionDocument;
  if (typeof doc.startViewTransition === "function" && !prefersReducedMotion()) {
    doc.documentElement.dataset.nav = direction;
    doc.startViewTransition(() => flushSync(update));
  } else {
    update();
  }
}

/**
 * 화면을 옮긴다. 지금 화면과 같은 주소면 아무 일도 하지 않는다(단추를 두 번 눌러도 화면이 다시 열리지 않는다).
 * fresh 를 주면 같은 주소여도 그 화면을 처음부터 다시 연다: 오늘의 추리를 풀다 자정을 넘긴 뒤,
 * 결과 화면에서 "오늘의 추리 풀기"를 누르면 같은 주소(#/daily)에 새 날의 문제가 열려야 한다.
 */
export function navigate(route: Route, options: { replace?: boolean; fresh?: boolean } = {}) {
  const hash = toHash(route);
  if (hash === toHash(current)) {
    if (options.fresh) {
      withTransition(() => {
        visit += 1;
        emit();
      });
    }
    return;
  }
  withTransition(() => {
    if (options.replace) {
      window.history.replaceState({ depth }, "", hash);
    } else {
      depth += 1;
      window.history.pushState({ depth }, "", hash);
    }
    current = route;
    emit();
  });
}

/** 뒤로 가기. 앱 안에서 온 길이 없으면 fallback 화면으로 바꾼다. */
export function goBack(fallback: Route = { name: "home" }) {
  if (depth > 0) {
    window.history.back();
  } else {
    navigate(fallback, { replace: true });
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("popstate", (event) => {
    const state = event.state as { depth?: number } | null;
    depth = typeof state?.depth === "number" ? state.depth : 0;
    withTransition(() => {
      current = parseHash(window.location.hash);
      emit();
    }, "back");
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useRoute(): Route {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => current,
  );
}

/** 같은 주소의 화면을 다시 연 횟수. 화면의 key 에 붙여, 바뀌면 그 화면을 처음부터 다시 그린다. */
export function useVisit(): number {
  return useSyncExternalStore(
    subscribe,
    () => visit,
    () => visit,
  );
}
