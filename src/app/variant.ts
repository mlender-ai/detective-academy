/**
 * 암호 풀이 화면의 갈래 (V3 GATE 03).
 * 사용자가 B안 · 장면 전개를 골랐다(2026-11-22, "B안이 좋아"). 암호 해독 문제의 기본 화면은 자료실 장면이다.
 * - (없음)  : 장면 전개 — 자료실에서 책상(기록)과 금고(자물쇠) 사이를 걸어 다니며 푼다
 * - ?play=c : 혼합형(수사 수첩) — 짧은 도입 장면 뒤, 자물쇠를 크게 두고 조건은 수사 수첩에 담는다.
 *             사용자가 "아이디어 차원에서 남겨놔 다른 문제에 쓰일수있는 UI로"라고 했다. 다른 유형에 쓸 후보로 남긴 것이고, 제품의 기본 화면에는 쓰이지 않는다.
 * 예전 풀이 화면(시험지 한 장)과 A안(접기·펼치기), 그리고 홈의 예전 화면과 A안은 걷어냈다(2026-11-22, 사용자: "보관하고 걷어내기").
 * 다시 보려면 docs/archive/v3-gate03-all-app/ 을 정적 서버로 연다.
 * 옆에서 본 화면들(복도 홈 · 자료실 장면 · 연습실 책상 · 시험실의 큰 봉투. 주소의 ?view=side 로 열리던 것)도 걷어냈다
 * (V3 RELEASE 지시서 13절 · 레거시 화면 정리). 홈 · 자료실 · 연습실 · 시험실은 쿼터뷰 방 하나뿐이고, ?view= 값은 더는 듣지 않는다.
 */
export type PlayVariant = "scene" | "notebook";

const play = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("play") : null;

export const PLAY_VARIANT: PlayVariant = play === "c" ? "notebook" : "scene";

/**
 * 보상·시간 애니메이션 실험 (V3 추가 지시 · ASCII Magic, 2026-11-22).
 * ASCII Magic 의 조각을 1비트 점으로 고쳐 옮긴 것(src/fx/ascii)을 화면에 얹는다:
 * 채점 결과의 회전하는 크레딧, 제한 시간 시험의 모래시계.
 * (복도의 비 내리는 창과 촛불은 예전 홈과 함께 걷어냈다. 학원 홀의 창에 내리는 비는 이 값과 상관없이 늘 그려진다.)
 * - (없음)    : 지금의 화면 그대로 (사용자가 고르기 전의 기본값)
 * - ?fx=ascii : 효과를 켠다
 */
const fx = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("fx") : null;

export const FX_ASCII: boolean = fx === "ascii";
