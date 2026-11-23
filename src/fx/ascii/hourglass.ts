/**
 * 모래시계(제한 시간).
 * ascii-magic-art 의 pieces/hourglass.js 에서 구성을 옮겼다 (MIT, © 2026 ASCII Magic. LICENSE.ascii-magic-art.txt).
 * 가져온 것: 위 칸이 줄어드는 만큼 아래 칸에 둔덕이 쌓이고, 목에서 모래 줄기가 점선으로 흘러 떨어지는 구성.
 * 바꾼 것: 스스로 도는 시간이 아니라 **남은 시간의 비율**을 받아 그린다(뒤집히는 연출은 뺐다).
 *          유리의 곡선식과 알갱이 잡음은 쓰지 않는다: 위 막대에 놓이는 작은 크기(11×14점)에서는 뭉개져, 직접 찍은 점 그림으로 바꿨다.
 *          나무 틀의 기둥을 없애고 위아래 받침만 남겼다(테를 두른 상자는 단추로 읽혔다).
 *          모래는 흰 면이고, 위 칸은 다섯 단계(가득 · 세 줄 · 두 줄 · 마지막 한 점 · 빔)로 끊어 줄어든다.
 */
import type { DotGrid } from "../dots";

export const HOURGLASS = { w: 11, h: 14 };

/** 줄마다 유리 안쪽의 왼쪽 끝과 폭. 0·1 과 12·13 줄은 받침이다. */
const INSIDE: readonly (readonly [number, number])[] = [
  [2, 7], // 2: 위 칸의 빈 머리(모래가 받침에 붙지 않게 늘 비운다)
  [2, 7], // 3
  [3, 5], // 4
  [4, 3], // 5
  [5, 1], // 6: 위 칸의 끝
  [5, 1], // 7: 아래 칸의 목
  [4, 3], // 8
  [3, 5], // 9
  [2, 7], // 10
  [2, 7], // 11
];
const TOP = 2;

/** 위 칸에 남은 모래의 단계마다: 위 칸에서 모래가 시작하는 줄, 아래 칸에 쌓인 둔덕(줄 → 폭) */
const STAGES: readonly { from: number; pile: readonly (readonly [number, number])[] }[] = [
  { from: 7, pile: [[11, 7], [10, 7], [9, 3]] }, // 0: 다 떨어졌다
  { from: 6, pile: [[11, 7], [10, 7], [9, 1]] }, // 1: 마지막 한 점
  { from: 5, pile: [[11, 7], [10, 5]] }, // 2
  { from: 4, pile: [[11, 7]] }, // 3
  { from: 3, pile: [] }, // 4: 가득
];

/**
 * 흘러간 비율(0 가득 ~ 1 다 떨어짐)을 위 칸의 단계(4 가득 ~ 0 빔)로 옮긴다.
 * 단계마다 위 칸에 남은 칸 수는 16 · 9 · 4 · 1 · 0 이고, 남은 비율에 가장 가까운 단계를 고른다.
 * 마지막 한 점은 시간이 다할 때까지 남는다(조금이라도 남았는데 빈 것으로 보이지 않게).
 */
export function hourglassStage(spent: number): number {
  const left = 1 - Math.min(1, Math.max(0, spent));
  return left > 0.78 ? 4 : left > 0.41 ? 3 : left > 0.16 ? 2 : left > 0 ? 1 : 0;
}

/** spent: 흘러간 비율 0(가득) ~ 1(다 떨어짐). t: 모래 줄기를 움직이는 시간(초). 0 이면 줄기를 그리지 않는다(멈춘 시계). */
export function drawHourglass(g: DotGrid, spent: number, t: number) {
  g.clear(0);
  const stage = hourglassStage(spent);
  const { from, pile } = STAGES[stage];
  // 위아래 받침
  g.rect(0, 0, HOURGLASS.w, 2, 1);
  g.rect(0, HOURGLASS.h - 2, HOURGLASS.w, 2, 1);
  // 유리: 안쪽의 바로 바깥 한 점씩
  INSIDE.forEach(([x, n], i) => {
    g.dot(x - 1, TOP + i, 1);
    g.dot(x + n, TOP + i, 1);
  });
  // 위 칸의 모래: from 줄부터 끝(6줄)까지 가득 찬다
  for (let y = from; y <= 6; y++) {
    const [x, n] = INSIDE[y - TOP];
    g.rect(x, y, n, 1, 1);
  }
  // 아래 칸의 둔덕
  let peak = HOURGLASS.h - 2;
  for (const [y, n] of pile) {
    g.rect(5 - (n - 1) / 2, y, n, 1, 1);
    peak = Math.min(peak, y);
  }
  // 떨어지는 줄기: 목에서 둔덕 위까지 점선이 아래로 흐른다
  if (stage > 0 && t > 0) {
    const tick = Math.floor(t * 8);
    for (let y = 7; y < peak; y++) if (((y - tick) & 1) === 0) g.dot(5, y, 1);
  }
}
