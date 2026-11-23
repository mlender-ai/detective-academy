/**
 * 회전하는 수사 크레딧 한 닢.
 * 그림은 탐정학원의 팔각 주화(위 막대의 크레딧, src/art/pixel.tsx 의 monoCoin: 흰 면에 검은 "I", 검은 윤곽과 흰 테)를 크게 다시 찍은 것이다.
 * ascii-magic-art 의 pieces/spinning-coin.js 에서는 회전의 박자만 가져왔다 (MIT, © 2026 ASCII Magic. LICENSE.ascii-magic-art.txt):
 * 한 바퀴를 고른 각도의 장면으로 끊고, 면의 폭이 cos 로 줄었다 늘며, 옆면이 sin 만큼 드러난다.
 * 원본의 3차원 점 흩뿌리기 · 빛과 반짝임의 계산 · 돋을새김 · 별 무늬는 쓰지 않는다(장면마다 바뀌는 점묘 음영은 평면 + 흰 테인 스프라이트들과 결이 달랐다).
 * 원본은 끝없이 돌지만 여기서는 도는 횟수를 부르는 쪽이 정한다(FxCoin: 한 바퀴 돌고 정면에서 멈춘다).
 */
import type { DotGrid } from "../dots";

/** size: 격자의 한 변(점). turn: 한 바퀴의 장면 수(15도씩). rate: 초당 장면 수 */
export const COIN = { size: 27, turn: 24, rate: 18 };

/** 면의 지름, 반지름, 모서리를 깎는 깊이, 옆면의 두께(점) */
const FACE = 21;
const HALF = 10;
const CUT = 6;
const THICK = 3;

/** 팔각형의 j 번째 줄(0~20)의 반폭. inset 은 안으로 들인 깊이(면 안쪽의 테는 2). 그 줄이 팔각형 밖이면 -1 */
function half(j: number, inset = 0) {
  const lo = inset;
  const hi = FACE - 1 - inset;
  if (j < lo || j > hi) return -1;
  const cut = CUT - (inset ? 1 : 0);
  return HALF - inset - Math.max(0, cut - (j - lo), cut - (hi - j));
}

/**
 * step 번째 장면을 그린다(0 이 정면. 15도씩 돈다. 앞뒤 면의 그림이 같아 12장면마다 되풀이된다).
 * 정면 · 30 · 45 · 60 · 75도 · 옆면(곧은 막대)의 여섯 그림과, 그 좌우를 뒤집은 것으로 이뤄진다(15도는 정면과 같은 그림이다).
 * 45도까지는 안쪽의 테가 한쪽으로 밀려 두께를 보이고, 60도부터는 테 대신 면과 옆면 사이에 금을 긋는다.
 */
export function drawCoin(g: DotGrid, step: number) {
  const { w, h, ink } = g;
  g.clear(0);
  const th = (step / (COIN.turn / 2)) * Math.PI;
  const ac = Math.abs(Math.cos(th));
  const as = Math.abs(Math.sin(th));
  // 옆면은 한 점 반 넘게 보일 때부터 그린다. 면이 오른쪽으로 물러나면 옆면은 왼쪽에 드러난다.
  const band = THICK * as >= 1.5 ? THICK * as : 0;
  const side = Math.cos(th) * Math.sin(th) >= 0 ? 1 : -1;
  const mid = (w - 1) / 2;
  const top = Math.floor((h - FACE) / 2);
  const fc = mid + (side * band) / 2;
  const bc = mid - (side * band) / 2;
  const from = (c: number, hw: number) => Math.round(c - hw + 0.001);
  const to = (c: number, hw: number) => Math.round(c + hw - 0.001);
  const put = (x: number, y: number, v: 1 | -1) => {
    if (x >= 0 && y >= 0 && x < w && y < h) ink[y * w + x] = v;
  };

  // 몸: 앞면과 뒷면 사이를 쓸어 채운다(옆에서 보면 두께만 남아 곧은 막대가 된다)
  const wide = FACE * ac;
  const rim = wide >= 13;
  for (let j = 0; j < FACE; j++) {
    const hw = (half(j) + 0.5) * ac;
    const f0 = from(fc, hw);
    const f1 = to(fc, hw);
    for (let x = Math.min(f0, from(bc, hw)); x <= Math.max(f1, to(bc, hw)); x++) put(x, top + j, 1);
    // 면과 옆면이 만나는 금: 면이 좁아져 안쪽의 테를 그리지 않을 때만 긋는다(둘을 함께 그으면 줄이 겹쳐 번잡하다)
    if (band && !rim && f1 >= f0) put(side > 0 ? f0 : f1, top + j, -1);
  }

  // 면 안쪽의 테: 가장자리에서 두 점 들인 팔각의 둘레
  if (rim) {
    const span = (j: number): [number, number] | null => {
      const hw = half(j, 2);
      return hw < 0 ? null : [from(fc, (hw + 0.5) * ac), to(fc, (hw + 0.5) * ac)];
    };
    for (let j = 2; j <= FACE - 3; j++) {
      const now = span(j)!;
      const up = span(j - 1);
      const down = span(j + 1);
      for (let x = now[0]; x <= now[1]; x++) {
        const edge = x === now[0] || x === now[1] || !up || !down || x < up[0] || x > up[1] || x < down[0] || x > down[1];
        if (edge) put(x, top + j, -1);
      }
    }
  }

  // 글자 I: 굵은 기둥과 위아래 받침. 면이 좁아지면 받침을 떼고 기둥만 남긴다.
  if (wide >= 5) {
    const bar = (hw: number, j0: number, j1: number) => {
      for (let j = j0; j <= j1; j++) for (let x = from(fc, hw); x <= to(fc, hw); x++) put(x, top + j, -1);
    };
    bar(Math.max(0.5, 1.5 * ac), 6, 14);
    if (wide >= 9) {
      bar(3.5 * ac, 6, 7);
      bar(3.5 * ac, 13, 14);
    }
  }

  // 검은 윤곽을 두르고, 그 바깥에 흰 테를 한 줄 더 두른다(어두운 바탕에서도 윤곽이 남는다: 다른 스프라이트와 같은 약속)
  for (const v of [-1, 1] as const) {
    const body = Int8Array.from(ink);
    const filled = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && body[y * w + x] !== 0;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) if (!filled(x, y) && (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1))) ink[y * w + x] = v;
  }
}
