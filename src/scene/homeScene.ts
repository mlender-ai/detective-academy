// 홈 장면의 공통 약속. 깊이 복도(A안)와 옆에서 본 복도(B안)가 같은 모양으로 움직인다.
import type { StageFrame } from "./stage";

/** 홈에서 갈 수 있는 곳 */
export type SpotId = "board" | "practice" | "exam" | "archive";

/** 장면에 반영되는 게임 상태 */
export interface SceneState {
  /** 오늘의 사건을 해결했는가 (게시판의 종이가 달라진다) */
  dailySolved: boolean;
  /** 승급 시험 문 위에 붙는 다음 등급 글자. 더 오를 등급이 없으면 지금 등급 */
  examRank: string;
  /** 승급 시험을 볼 수 있는가 (문 안의 불이 켜진다) */
  examOpen: boolean;
  /** 지금 할 일이 있는 곳. 그 위에 작은 화살표가 뜬다(B안). */
  mark?: SpotId | null;
}

export interface HomeScene {
  /** 점 화면의 크기 */
  readonly w: number;
  readonly h: number;
  state: SceneState;
  /** 걷는 중인가 */
  readonly busy: boolean;
  /** 지금 서 있는 곳 */
  readonly at: SpotId | null;
  /** 도착하면 불린다 */
  onArrive: (id: SpotId) => void;
  update(dt: number): void;
  frame(): StageFrame;
  /** 그곳으로 걸어간다. 걷는 중이면 지금 선 자리에서 방향을 바꾼다. 이미 그곳에 서 있으면 곧바로 onArrive 가 불린다. */
  go(id: SpotId): void;
  /** 걷는 중이면 곧바로 도착시킨다 */
  skip(): void;
  /** 점 좌표를 눌렀을 때 그 자리의 물건 */
  hit(x: number, y: number): SpotId | null;
  /** 보이는 영역(점)이 바뀌었을 때: 탐정이 화면 안에 서도록 자리를 잡는다 */
  setView(view: { x0: number; y0: number; x1: number; y1: number }): void;
}

export const SPOT_LABEL: Record<SpotId, string> = {
  board: "시험 게시판",
  practice: "연습실",
  exam: "승급 시험실",
  archive: "기록 보관함",
};

const TAU = Math.PI * 2;

/** from 에서 to 로 max 만큼만 돈다 (가까운 쪽으로) */
export function turnToward(from: number, to: number, max: number): number {
  let d = (((to - from + Math.PI) % TAU) + TAU) % TAU - Math.PI;
  if (Math.abs(d) <= max) return to;
  if (d === -Math.PI) d = Math.PI;
  return from + Math.sign(d) * max;
}

export const easeInOut = (p: number) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
