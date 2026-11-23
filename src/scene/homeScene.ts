// 장면의 공통 약속: 옆에서 본 장면(LiveScene 이 굴리는 것. 지금은 수사 수첩의 도입에 쓰는 자료실 장면뿐이다)의 모양과,
// 쿼터뷰 방들도 함께 쓰는 걷기의 작은 도구(돌아서기, 가감속).
import type { StageFrame } from "./stage";

/** 장면 하나가 지키는 약속. Id 는 갈 수 있는 곳의 이름, S 는 장면에 비치는 상태다. */
export interface Scene<Id extends string, S> {
  /** 점 화면의 크기 */
  readonly w: number;
  readonly h: number;
  state: S;
  /** 걷는 중인가 */
  readonly busy: boolean;
  /** 지금 서 있는 곳 */
  readonly at: Id | null;
  /** 도착하면 불린다 */
  onArrive: (id: Id) => void;
  update(dt: number): void;
  frame(): StageFrame;
  /** 그곳으로 걸어간다. 걷는 중이면 지금 선 자리에서 방향을 바꾼다. 이미 그곳에 서 있으면 곧바로 onArrive 가 불린다. */
  go(id: Id): void;
  /** 걷는 중이면 곧바로 도착시킨다 */
  skip(): void;
  /** 점 좌표를 눌렀을 때 그 자리의 물건 */
  hit(x: number, y: number): Id | null;
  /** 보이는 영역(점)이 바뀌었을 때: 탐정이 화면 안에 서도록 자리를 잡는다 */
  setView(view: { x0: number; y0: number; x1: number; y1: number }): void;
}

const TAU = Math.PI * 2;

/** from 에서 to 로 max 만큼만 돈다 (가까운 쪽으로) */
export function turnToward(from: number, to: number, max: number): number {
  let d = (((to - from + Math.PI) % TAU) + TAU) % TAU - Math.PI;
  if (Math.abs(d) <= max) return to;
  if (d === -Math.PI) d = Math.PI;
  return from + Math.sign(d) * max;
}

export const easeInOut = (p: number) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
