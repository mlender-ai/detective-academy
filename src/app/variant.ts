/**
 * 메인 홈의 비교안 (V3 GATE 02, 2026-11-22).
 * 확정된 홈은 그대로 두고, 주소에 ?home=a 또는 ?home=b 를 붙이면 개선안으로 열린다.
 * - a: 시네마틱 복도 — 지금의 구성을 유지하고 복도 장면이 살아 움직인다
 * - b: 플레이 가능한 복도 — 복도가 게임 장면이 되고 물건을 눌러 걸어간다
 * 사용자가 고르면 고른 안을 기본으로 올리고 이 전환을 걷어낸다.
 */
export type HomeVariant = "current" | "a" | "b";

const value = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("home") : null;

export const HOME_VARIANT: HomeVariant = value === "a" ? "a" : value === "b" ? "b" : "current";
