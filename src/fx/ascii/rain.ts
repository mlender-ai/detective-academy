/**
 * 비 내리는 유리.
 * ascii-magic-art 의 pieces/rainy-window.js 를 고쳐 옮겼다 (MIT, © 2026 ASCII Magic. LICENSE.ascii-magic-art.txt).
 * 가져온 것: 유리에 맺힌 물방울, 붙었다 미끄러지는 물줄기(머리와 젖은 자국)와 그 박자, 창 너머의 불빛이라는 구성.
 * 바꾼 것: 글자와 색을 버리고 점으로 그린다. 물방울과 물줄기는 흰 점, 젖은 자국의 먼 쪽은 점선이다.
 *          창틀과 창살은 그리지 않는다(장면의 창이 따로 있다). 크기를 받는다. 칸이 정사각형 점이라 세로 속도를 두 배로 잡았다.
 *          물줄기는 곧게만 내린다(원본의 옆으로 꺾이는 머리는 이 크기에서 글자 조각처럼 읽혔다). 물줄기끼리는 적어도 한 칸을 띄우고,
 *          물줄기 옆 칸은 비워 물방울이 줄기에 붙지 않게 한다. 물방울끼리도 붙지 않는다.
 *          창 너머의 불빛은 원본의 겹겹이 번지는 원 대신, 한 가지 밝기의 네모난 덩어리다(작은 원은 점묘가 되면 글자나 사람처럼 읽혔다).
 */
import type { DotGrid } from "../dots";
import { rng } from "./kit";

export interface RainOptions {
  seed?: number;
  /** 창 너머의 흐린 불빛 수 */
  lights?: number;
  /** 유리에 맺힌 물방울 수 */
  beads?: number;
  /** 흘러내리는 물줄기 수 */
  runners?: number;
}

export function createRain(w: number, h: number, { seed = 5, lights = 2, beads = Math.round((w * h) / 30), runners = Math.max(4, Math.round(w / 3.5)) }: RainOptions = {}) {
  const r = rng(seed);
  // 창 너머의 불빛: 모서리를 깎은 네모 한 덩어리. 밝기는 한 가지(→ 바둑판 점묘)라 번지는 테가 없다.
  const glow = Array.from({ length: lights }, () => ({ x: Math.round(2 + r() * (w - 5)), y: Math.round(4 + r() * (h - 9)), hw: 1 + Math.round(r() * 1.4), hh: 2 + Math.round(r() * 1.4) }));
  // 물줄기: 폭을 줄기 수만큼 나눈 칸마다 하나씩 세운다(이웃한 줄기와 적어도 한 칸은 비어 있다)
  const slot = Math.max(3, (w - 2) / Math.max(1, runners));
  const lines = Array.from({ length: runners }, (_, i) => ({ x: Math.min(w - 2, 1 + Math.floor(i * slot + r() * Math.max(1, slot - 2.5))), off: r() * 50, sp: 8 + r() * 12, len: 5 + Math.floor(r() * 9) }));
  // 물방울: 서로 붙지 않게 놓는다(붙은 점은 글자 조각으로 읽힌다). 큰 것은 세로로 두 점.
  const drops: (readonly [number, number, boolean])[] = [];
  const taken = new Uint8Array(w * h);
  const free = (x: number, y: number) => {
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (x + i >= 0 && y + j >= 0 && x + i < w && y + j < h && taken[(y + j) * w + x + i]) return false;
    return true;
  };
  for (let n = 0; n < beads * 6 && drops.length < beads; n++) {
    const x = Math.floor(r() * w);
    const y = Math.floor(r() * (h - 1));
    const big = r() > 0.85;
    if (!free(x, y) || (big && !free(x, y + 1))) continue;
    taken[y * w + x] = 1;
    if (big) taken[(y + 1) * w + x] = 1;
    drops.push([x, y, big]);
  }

  return (g: DotGrid, t: number) => {
    g.clear(0);
    for (const b of glow)
      for (let y = b.y - b.hh; y <= b.y + b.hh; y++)
        for (let x = b.x - b.hw; x <= b.x + b.hw; x++) {
          if (Math.abs(x - b.x) === b.hw && Math.abs(y - b.y) === b.hh) continue;
          g.set(x, y, 0.5);
        }
    for (const [bx, by, big] of drops) {
      g.dot(bx, by, 1);
      if (big) g.dot(bx, by + 1, 1);
    }
    // 물줄기: 붙었다 미끄러진다(고르게 내려오는 값에 느린 사인을 얹어, 멈칫했다가 주르륵 내린다).
    // 머리 두 점, 그 위로 이어진 석 점, 더 위는 점선. 양옆 칸은 검게 비운다.
    for (const d of lines) {
      const p = t * d.sp + d.off;
      const head = Math.floor(((p + Math.sin(p * 0.35) * 4) % (h + d.len + 3)) - 1);
      for (let k = -1; k <= d.len; k++) {
        const y = head - k;
        g.dot(d.x - 1, y, -1);
        g.dot(d.x + 1, y, -1);
        g.dot(d.x, y, k < 4 || k % 2 === 0 ? 1 : -1);
      }
    }
  };
}
