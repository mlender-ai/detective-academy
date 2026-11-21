/**
 * 메인 홈의 갈래 (V3 GATE 02).
 * 사용자가 B안 · 플레이 가능한 복도를 골랐다(2026-11-22, "B안으로"). 그래서 기본 홈은 B안이다.
 * 예전 홈과 A안은 걷어내기 전까지 주소로만 열 수 있게 남겨 두었다(나란히 견줘 볼 때 쓴다).
 * - (없음) 또는 ?home=b : 플레이 가능한 복도 — 복도가 게임 장면이고 물건을 눌러 걸어간다
 * - ?home=old : 예전 홈(D안을 확정했을 때의 홈) — 정지 그림의 복도와 공고·선반
 * - ?home=a   : A안 시네마틱 복도 — 예전 구성에 복도 장면만 살아 움직인다
 * 예전 홈과 A안을 걷어낼 때 이 파일도 함께 걷어낸다(걷어내기 전에 사용자에게 확인하고 보관한다).
 */
export type HomeVariant = "b" | "a" | "old";

const value = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("home") : null;

export const HOME_VARIANT: HomeVariant = value === "a" ? "a" : value === "old" ? "old" : "b";
