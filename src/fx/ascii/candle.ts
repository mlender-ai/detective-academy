/**
 * 촛불.
 * ascii-magic-art 의 pieces/candle-flame.js 에서 움직임을 옮겼다 (MIT, © 2026 ASCII Magic. LICENSE.ascii-magic-art.txt).
 * 가져온 것: 불꽃의 깜빡임(느린 잡음 + 빠른 떨림)과 바람에 휘는 기울기의 식, 깜빡임을 따라 숨 쉬는 둘레의 빛이라는 구성.
 * 바꾼 것: 초와 불꽃은 원본의 식(물방울 곡선)이 아니라 직접 찍은 점 그림이다. 받침 · 몸통 · 불꽃을 검은 줄로 가르고 둘레에 검은 테를 둘러,
 *          점묘가 된 빛 위에서도 윤곽이 남는다. 불꽃은 깜빡임과 기울기를 몇 장면(높이 셋 × 기울기 셋)으로 끊어 고른다.
 *          빛은 색 대신 밝기(→ 점묘)이고, 크기를 세 단계로 끊어 숨 쉰다. 촛농은 뺐다.
 *          빛(밝기)과 초·불꽃(먹)을 따로 내어, 장면에서는 빛을 벽에 더하고 초를 그 위에 얹는다.
 */
import type { DotGrid } from "../dots";
import { noise2 } from "./kit";

/** 격자의 크기와 초가 서는 자리(격자 안): 가로 가운데 cx, 받침의 줄 base. 불꽃의 가운데는 base 에서 9점 위다. */
export const CANDLE = { w: 35, h: 34, cx: 17, base: 31, flame: 9 };

/** 지금의 깜빡임(0.7~1.1)과 휨(-0.9~0.9) */
export function candleFlicker(t: number) {
  return { flick: 0.82 + 0.18 * noise2(t * 6, 0.5, 3) + 0.06 * Math.sin(t * 23), sway: (noise2(t * 0.9, 7.1, 5) - 0.5) * 1.8 };
}

export function drawCandle(g: DotGrid, t: number, lit = true) {
  const { cx, base, flame } = CANDLE;
  const { flick, sway } = candleFlicker(t);
  g.clear(0);

  // 둘레의 빛: 불꽃에서 멀어질수록 어두워진다. 크기는 깜빡임을 따라 세 단계로 끊어 바뀐다.
  if (lit) {
    const fy = base - flame;
    const reach = flick > 0.96 ? 13 : flick > 0.86 ? 12 : 11;
    for (let y = 0; y < g.h; y++)
      for (let x = 0; x < g.w; x++) {
        const d = Math.hypot(x - cx, y - fy) / reach;
        if (d < 1) g.set(x, y, 0.78 * Math.pow(1 - d, 1.35));
      }
  }

  // 받침 접시(다섯 점), 몸통(세 점 폭, 다섯 점 높이)
  g.rect(cx - 2, base, 5, 1, 1);
  g.rect(cx - 1, base - 5, 3, 5, 1);
  if (lit) {
    // 불꽃: 몸통과 한 줄 띄우고, 밑동 한 점 · 배 두 줄 · 끝. 끝은 깜빡임에 따라 길어지고 바람 쪽으로 한 점 눕는다.
    const top = base - 7;
    const tall = flick > 0.96 ? 3 : flick > 0.86 ? 2 : 1;
    const lean = sway > 0.4 ? 1 : sway < -0.4 ? -1 : 0;
    g.dot(cx, top, 1);
    g.rect(cx - 1, top - 2, 3, 2, 1);
    g.dot(cx, top - 3, 1);
    for (let k = 1; k < tall; k++) g.dot(cx + lean, top - 3 - k, 1);
  } else {
    // 꺼진 초: 심지 한 점
    g.dot(cx, base - 7, 1);
  }

  // 검은 테: 흰 점에 닿은 빈칸(대각선 포함)을 검게 찍는다
  const { w, h, ink } = g;
  const white = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && ink[y * w + x] > 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (ink[y * w + x] !== 0) continue;
      let near = false;
      for (let j = -1; j <= 1 && !near; j++) for (let i = -1; i <= 1 && !near; i++) near = white(x + i, y + j);
      if (near) ink[y * w + x] = -1;
    }
}
