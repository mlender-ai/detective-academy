/**
 * 암호 풀이 화면의 갈래 (V3 GATE 03).
 * 사용자가 B안 · 장면 전개를 골랐다(2026-11-22, "B안이 좋아"). 암호 해독 문제의 기본 화면은 자료실 장면이다.
 * - (없음)  : 장면 전개 — 자료실에서 책상(기록)과 금고(자물쇠) 사이를 걸어 다니며 푼다
 * - ?play=c : 혼합형(수사 수첩) — 짧은 도입 장면 뒤, 자물쇠를 크게 두고 조건은 수사 수첩에 담는다.
 *             사용자가 "아이디어 차원에서 남겨놔 다른 문제에 쓰일수있는 UI로"라고 했다. 다른 유형에 쓸 후보로 남긴 것이고, 제품의 기본 화면에는 쓰이지 않는다.
 * 예전 풀이 화면(시험지 한 장)과 A안(접기·펼치기), 그리고 홈의 예전 화면과 A안은 걷어냈다(2026-11-22, 사용자: "보관하고 걷어내기").
 * 다시 보려면 docs/archive/v3-gate03-all-app/ 을 정적 서버로 연다.
 */
export type PlayVariant = "scene" | "notebook";

const play = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("play") : null;

export const PLAY_VARIANT: PlayVariant = play === "c" ? "notebook" : "scene";
