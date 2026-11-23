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
  | { name: "practice" }
  | { name: "practice-play"; id: string }
  | { name: "exam" }
  | { name: "profile" }
  /** 사건 수사(스토리). id 는 사건의 이름표, chapter 는 열 장의 이름표나 "record"(사건 기록). 비우면 풀 차례의 곳을 연다 */
  | { name: "story"; id: string; chapter?: string };

export function toHash(route: Route): string {
  switch (route.name) {
    case "home":
      return "#/";
    case "daily":
      return "#/daily";
    case "practice":
      return "#/practice";
    case "practice-play":
      return `#/practice/${encodeURIComponent(route.id)}`;
    case "exam":
      return "#/exam";
    case "profile":
      return "#/profile";
    case "story":
      return `#/story/${encodeURIComponent(route.id)}${route.chapter ? `/${encodeURIComponent(route.chapter)}` : ""}`;
  }
}

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#\/?/, "");
  const [head, tail, sub] = path.split("/");
  switch (head) {
    case "daily":
      return { name: "daily" };
    case "practice":
      return tail ? { name: "practice-play", id: decodeURIComponent(tail) } : { name: "practice" };
    case "exam":
      return { name: "exam" };
    case "profile":
      return { name: "profile" };
    case "story":
      if (!tail) return { name: "home" };
      return sub ? { name: "story", id: decodeURIComponent(tail), chapter: decodeURIComponent(sub) } : { name: "story", id: decodeURIComponent(tail) };
    default:
      return { name: "home" };
  }
}

let current: Route = typeof window === "undefined" ? { name: "home" } : parseHash(window.location.hash);
/** 앱 안에서 쌓인 이동 횟수. 0이면 뒤로 갈 앱 화면이 없다. */
let depth = 0;
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

export function navigate(route: Route, options: { replace?: boolean } = {}) {
  const hash = toHash(route);
  if (hash === toHash(current)) return;
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
