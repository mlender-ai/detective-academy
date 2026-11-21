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

/**
 * 암호 풀이 화면의 갈래 (V3 GATE 03 비교안). 지금의 풀이 화면이 기본이고, 주소에 ?play= 를 붙이면 비교안으로 열린다.
 * 암호 해독 문제에만 적용된다(진술 추리·순서 추론은 그대로다).
 * - ?play=a : 접기·펼치기 — 한 화면에서 사건·시도 기록·숫자 메모를 접고 펴며 자물쇠를 크게 쓴다
 * - ?play=b : 장면 전개 — 자료실에서 책상(기록)과 금고(자물쇠) 사이를 걸어 다니며 푼다
 * - ?play=c : 혼합형 — 짧은 도입 장면 뒤, 자물쇠를 크게 두고 조건은 수사 수첩에 담는다
 * 사용자가 고르면 고른 안을 기본으로 올리고 이 전환을 걷어낸다.
 */
export type PlayVariant = "current" | "a" | "b" | "c";

const play = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("play") : null;

export const PLAY_VARIANT: PlayVariant = play === "a" || play === "b" || play === "c" ? play : "current";
