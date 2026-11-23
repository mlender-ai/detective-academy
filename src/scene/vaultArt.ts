// 자료실을 "층"으로 나눠 그린다. 암호 풀이의 장면(B안의 무대, C안의 도입)이 쓴다.
// 왼쪽에 문, 가운데에 서가와 책상(기록이 놓인 곳), 오른쪽에 금고. 방은 화면에 다 들어와서 카메라는 움직이지 않는다.
import { fillPoly, gray, lineDots, makeSprite, putDot, rectDots, spriteCanvas, type Sprite } from "./dot";
import type { Placed } from "./placed";
import { clipTo, toneLayer, tracePath, type Pt } from "./stage";

/** 방 전체의 폭과 높이(점) */
export const VW = 216;
export const VH = 104;
/** 벽과 바닥이 만나는 줄, 탐정이 걷는 줄 */
export const V_FLOOR = 72;
export const V_WALK = 92;

export const V_LAMP = [88, 173];

/** 물건의 자리(x, y, w, h) */
export const V_BOX = {
  door: [16, 22, 20, V_FLOOR - 22],
  shelf: [44, 14, 92, V_FLOOR - 14],
  desk: [60, 56, 58, V_FLOOR - 56],
  sheet: [86, 36, 15, 20],
  safe: [152, 28, 42, V_FLOOR - 28],
} as const;

export interface VaultArt {
  tone: Record<string, HTMLCanvasElement>;
  ink: Record<string, Placed>;
}

const placed = (s: Sprite, x = 0, y = 0): Placed => ({ canvas: spriteCanvas(s), x, y });
const layer = (draw: (c: CanvasRenderingContext2D) => void, fill: string | null = "#000") => toneLayer(VW, VH, draw, fill);

const lin = (c: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, stops: [number, number][]) => {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  stops.forEach(([t, v]) => g.addColorStop(t, gray(v)));
  return g;
};

const glow = (c: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, stops: [number, number][]) => {
  c.save();
  c.globalCompositeOperation = "lighter";
  c.translate(cx, cy);
  c.scale(rx, ry);
  const g = c.createRadialGradient(0, 0, 0, 0, 0, 1);
  stops.forEach(([t, v]) => g.addColorStop(t, gray(v)));
  c.fillStyle = g;
  c.beginPath();
  c.arc(0, 0, 1, 0, Math.PI * 2);
  c.fill();
  c.restore();
};

/** 흰 테를 두른 네모(안은 그대로 둔다) */
const frame = (s: Sprite, x: number, y: number, w: number, h: number, v = 1) => {
  rectDots(s, x, y, w, 1, v);
  rectDots(s, x, y + h - 1, w, 1, v);
  rectDots(s, x, y, 1, h, v);
  rectDots(s, x + w - 1, y, 1, h, v);
};

export function paintVault(): VaultArt {
  const tone: Record<string, HTMLCanvasElement> = {};
  const ink: Record<string, Placed> = {};
  const [dx, dy, dw, dh] = V_BOX.door;
  const [hx, hy, hw, hh] = V_BOX.shelf;
  const [kx, ky, kw, kh] = V_BOX.desk;
  const [px, py, pw, ph] = V_BOX.sheet;
  const [sx, sy, sw, sh] = V_BOX.safe;

  // ── 바탕: 벽과 바닥 ──
  tone.base = layer((c) => {
    c.fillStyle = gray(0.08);
    c.fillRect(0, 0, VW, V_FLOOR);
    c.fillStyle = gray(0.02);
    c.fillRect(0, 0, VW, 6);
    c.fillStyle = gray(0.05);
    c.fillRect(0, V_FLOOR, VW, VH - V_FLOOR);
  });

  // ── 전등마다의 빛: 책상 위의 등은 밝고, 금고 위의 등은 어둑하다 ──
  V_LAMP.forEach((x, i) => {
    const k = i === 0 ? 1 : 0.7;
    tone[`lamp${i}`] = layer((c) => {
      const cone: Pt[] = [
        [x - 5, 18],
        [x + 5, 18],
        [x + 44, VH],
        [x - 44, VH],
      ];
      clipTo(c, cone, () => {
        c.globalCompositeOperation = "lighter";
        c.fillStyle = lin(c, 0, 18, 0, VH, [[0, 0.55 * k], [0.5, 0.28 * k], [1, 0.1 * k]]);
        c.fillRect(0, 0, VW, VH);
      });
      clipTo(c, [[0, V_FLOOR], [VW, V_FLOOR], [VW, VH], [0, VH]], () => glow(c, x, V_WALK + 1, 38, 8, [[0, 0.5 * k], [0.6, 0.24 * k], [1, 0]]));
      clipTo(c, [[0, 6], [VW, 6], [VW, V_FLOOR], [0, V_FLOOR]], () => glow(c, x, 34, 50, 46, [[0, 0.24 * k], [1, 0]]));
    });
  });

  // ── 서가와 문 안, 금고의 몸은 전등 빛을 받아도 어둡다 (곱해서 누른다) ──
  tone.dark = layer((c) => {
    c.fillStyle = gray(0.22);
    c.fillRect(hx, hy, hw, hh);
    c.fillStyle = "#000";
    c.fillRect(dx, dy, dw, dh);
    c.fillRect(sx, sy, sw, sh);
  }, "#fff");

  // ── 금고의 쇠: 왼쪽 위가 밝고 오른쪽 아래가 어두운 점묘 ──
  tone.steel = layer((c) => {
    c.fillStyle = lin(c, sx, sy, sx + sw, sy + sh, [[0, 0.42], [0.55, 0.2], [1, 0.08]]);
    c.fillRect(sx, sy, sw, sh);
  });

  // ── 책상 등의 빛: 기록지 둘레가 밝다 ──
  tone.deskLamp = layer((c) => {
    clipTo(c, [[kx, py - 8], [kx + kw, py - 8], [kx + kw, ky], [kx, ky]], () => glow(c, px + pw / 2 + 4, ky - 2, 26, 20, [[0, 0.7], [0.6, 0.3], [1, 0]]));
  });

  // ── 금고가 열리면: 안이 밝고, 바닥에 빛이 쏟아진다 ──
  tone.safeOpen = layer((c) => {
    c.fillStyle = gray(0.95);
    c.fillRect(sx + 4, sy + 4, sw - 8, sh - 8);
    c.fillStyle = lin(c, 0, V_FLOOR, 0, VH, [[0, 0.9], [0.6, 0.4], [1, 0.08]]);
    tracePath(c, [
      [sx + 2, V_FLOOR],
      [sx + sw - 2, V_FLOOR],
      [sx + sw + 14, VH],
      [sx - 22, VH],
    ]);
    c.fill();
  });
  // 열리기 직전: 문틈으로 빛 한 줄이 샌다
  tone.safeAjar = layer((c) => {
    c.fillStyle = gray(0.95);
    c.fillRect(sx + 4, sy + 4, 3, sh - 8);
    c.fillStyle = lin(c, 0, V_FLOOR, 0, VH, [[0, 0.7], [1, 0]]);
    tracePath(c, [
      [sx + 3, V_FLOOR],
      [sx + 8, V_FLOOR],
      [sx + 2, VH],
      [sx - 12, VH],
    ]);
    c.fill();
  });

  // ── 먹선 ──
  const m = makeSprite(VW, VH);
  rectDots(m, 0, 6, VW, 1, -1);
  rectDots(m, 0, V_FLOOR - 3, VW, 1, 1);
  rectDots(m, 0, V_FLOOR, VW, 1, -1);
  // 마룻바닥의 이음매
  for (let x = 6; x < VW; x += 22) rectDots(m, x, V_FLOOR + 9, 12, 1, -1);
  for (let x = 16; x < VW; x += 22) rectDots(m, x, V_FLOOR + 22, 12, 1, -1);

  // 문: 틀과 손잡이, 위의 작은 표찰
  {
    rectDots(m, dx - 3, dy - 3, dw + 6, dh + 3, -1);
    rectDots(m, dx, dy, dw, dh, 0);
    frame(m, dx - 2, dy - 2, dw + 4, dh + 2);
    rectDots(m, dx - 2, V_FLOOR - 1, dw + 4, 1, 0);
    // 문짝: 안으로 조금 열려 있다
    rectDots(m, dx + dw - 5, dy, 5, dh, -1);
    rectDots(m, dx + dw - 5, dy, 1, dh, 1);
    rectDots(m, dx + dw - 3, dy + 26, 2, 3, 1);
    // 표찰
    rectDots(m, dx + 2, dy - 12, 16, 8, -1);
    rectDots(m, dx + 3, dy - 11, 14, 6, 1);
    rectDots(m, dx + 5, dy - 9, 10, 1, -1);
    rectDots(m, dx + 5, dy - 7, 6, 1, -1);
  }

  // 서가: 선반 네 칸과 서류철. 서류철의 높이와 기울기는 정해진 수열로 정한다(그릴 때마다 같다).
  {
    rectDots(m, hx - 1, hy - 1, hw + 2, hh + 1, -1);
    rectDots(m, hx, hy, hw, hh, 0);
    frame(m, hx, hy, hw, hh);
    rectDots(m, hx, V_FLOOR - 1, hw, 1, 0);
    rectDots(m, hx, V_FLOOR - 3, hw, 1, 1);
    let seed = 7;
    const rnd = () => (seed = (seed * 73 + 41) % 101) / 101;
    for (let row = 0; row < 4; row++) {
      const base = hy + 13 + row * 14;
      if (row < 3) rectDots(m, hx, base, hw, 1, 1);
      const floorY = row < 3 ? base : V_FLOOR - 3;
      // 책상 위의 기록지와 등 뒤는 비워 둔다: 어두운 칸을 등지고 흰 종이가 또렷이 보인다
      const behindDesk = row === 1 || row === 2;
      let x = hx + 3;
      while (x < hx + hw - 4) {
        if (behindDesk && x > px - 12 && x < px + pw + 22) {
          x = px + pw + 22;
          continue;
        }
        const r = rnd();
        if (r < 0.14) {
          // 빈 자리
          x += 4 + Math.floor(rnd() * 5);
        } else if (r < 0.26 && x < hx + hw - 12) {
          // 상자
          const w = 8 + Math.floor(rnd() * 3);
          frame(m, x, floorY - 7, w, 7);
          rectDots(m, x + 2, floorY - 5, w - 4, 1, 1);
          x += w + 2;
        } else if (r < 0.34 && x < hx + hw - 8) {
          // 기울어 기댄 서류철
          const h = 8 + Math.floor(rnd() * 3);
          lineDots(m, x, floorY - 1, x + 3, floorY - h, 1);
          lineDots(m, x + 2, floorY - 1, x + 5, floorY - h, 1);
          x += 7;
        } else {
          const h = 7 + Math.floor(rnd() * 5);
          const w = rnd() < 0.3 ? 3 : 2;
          rectDots(m, x, floorY - h, w, h, 1);
          if (w === 3) rectDots(m, x + 1, floorY - h + 2, 1, h - 4, -1);
          x += w + 1;
        }
      }
    }
  }

  // 책상: 상판과 서랍, 그 위의 기록지와 등
  {
    rectDots(m, kx - 1, ky - 1, kw + 2, kh + 1, -1);
    rectDots(m, kx - 2, ky, kw + 4, 2, 1);
    rectDots(m, kx, ky + 2, 1, kh - 2, 1);
    rectDots(m, kx + kw - 1, ky + 2, 1, kh - 2, 1);
    // 서랍
    frame(m, kx + 5, ky + 5, 20, 8);
    rectDots(m, kx + 13, ky + 8, 4, 1, 1);
    frame(m, kx + kw - 25, ky + 5, 20, 8);
    rectDots(m, kx + kw - 17, ky + 8, 4, 1, 1);
    // 기록지: 받침에 세워 둔 종이 한 장
    rectDots(m, px - 1, py - 1, pw + 2, ph + 1, -1);
    rectDots(m, px, py, pw, ph, 1);
    rectDots(m, px + 2, py + 3, 8, 2, -1);
    for (let j = 0; j < 5; j++) rectDots(m, px + 2, py + 7 + j * 2, j % 2 ? 11 : 9, 1, -1);
    putDot(m, px + 7, py, -1);
    // 책상 등: 받침, 대, 갓
    rectDots(m, px + pw + 6, ky - 2, 8, 2, 1);
    rectDots(m, px + pw + 9, ky - 9, 1, 7, 1);
    rectDots(m, px + pw + 2, ky - 13, 13, 5, -1);
    rectDots(m, px + pw + 3, ky - 12, 11, 3, 1);
  }

  // 천장 등: 줄과 갓
  for (const x of V_LAMP) {
    rectDots(m, x, 7, 1, 6, 1);
    fillPoly(
      m,
      [
        [x - 3, 12],
        [x + 4, 12],
        [x + 8, 18],
        [x - 7, 18],
      ],
      -1,
    );
    lineDots(m, x - 3, 12, x + 3, 12, 1);
    lineDots(m, x - 3, 12, x - 7, 17, 1);
    lineDots(m, x + 3, 12, x + 7, 17, 1);
    rectDots(m, x - 7, 18, 15, 1, 1);
  }
  ink.mid = placed(m);

  V_LAMP.forEach((x, i) => {
    const s = makeSprite(5, 2);
    rectDots(s, 0, 0, 5, 2, 1);
    ink[`bulb${i}`] = placed(s, x - 2, 19);
  });

  // 금고의 테두리와 발 (닫혔을 때도 열렸을 때도 같다)
  {
    const s = makeSprite(sw + 4, sh + 6);
    const ox = 2;
    const oy = 2;
    rectDots(s, 0, 0, sw + 4, sh + 3, -1);
    rectDots(s, ox, oy, sw, sh, 0);
    frame(s, ox, oy, sw, sh);
    frame(s, ox + 1, oy + 1, sw - 2, sh - 2);
    // 발
    rectDots(s, ox + 3, oy + sh, 6, 3, -1);
    rectDots(s, ox + 4, oy + sh, 4, 2, 1);
    rectDots(s, ox + sw - 9, oy + sh, 6, 3, -1);
    rectDots(s, ox + sw - 8, oy + sh, 4, 2, 1);
    ink.safeBody = placed(s, sx - ox, sy - oy);
  }

  // 닫힌 금고의 문: 안쪽 테, 둥근 다이얼, 손잡이, 경첩, 리벳
  {
    const s = makeSprite(sw, sh);
    frame(s, 4, 4, sw - 8, sh - 8);
    const cx = Math.floor(sw / 2);
    const cy = 18;
    for (let y = -7; y <= 7; y++)
      for (let x = -7; x <= 7; x++) {
        const d = Math.hypot(x, y);
        if (d <= 7.3) putDot(s, cx + x, cy + y, d > 5.9 ? 1 : d > 4.9 ? -1 : d < 1.6 ? 1 : -1);
      }
    // 다이얼의 눈금과 가리키는 줄
    for (const [x, y] of [
      [0, -4],
      [4, 0],
      [0, 4],
      [-4, 0],
    ])
      putDot(s, cx + x, cy + y, 1);
    lineDots(s, cx, cy, cx + 2, cy - 3, 1);
    // 손잡이
    rectDots(s, cx - 8, cy + 12, 17, 4, -1);
    rectDots(s, cx - 7, cy + 13, 15, 2, 1);
    rectDots(s, cx - 1, cy + 9, 3, 4, 1);
    // 경첩
    rectDots(s, sw - 5, 8, 3, 6, 1);
    rectDots(s, sw - 5, sh - 14, 3, 6, 1);
    // 리벳
    for (const [x, y] of [
      [7, 7],
      [sw - 10, 7],
      [7, sh - 8],
      [sw - 10, sh - 8],
    ])
      rectDots(s, x, y, 2, 2, 1);
    ink.safeDoor = placed(s, sx, sy);
  }

  // 열린 금고: 안의 선반과 그 위의 장부, 오른쪽으로 젖혀진 문짝
  {
    const s = makeSprite(sw + 12, sh + 4);
    const oy = 2;
    frame(s, 4, oy + 4, sw - 8, sh - 8, -1);
    // 선반
    rectDots(s, 5, oy + 24, sw - 10, 2, -1);
    // 장부 두 권과 작은 상자 (밝은 안쪽을 등진 검은 실루엣)
    rectDots(s, 10, oy + 10, 5, 14, -1);
    rectDots(s, 16, oy + 12, 4, 12, -1);
    lineDots(s, 22, oy + 23, 26, oy + 11, -1);
    lineDots(s, 23, oy + 23, 27, oy + 11, -1);
    lineDots(s, 24, oy + 23, 28, oy + 11, -1);
    rectDots(s, 9, oy + 30, 22, 9, -1);
    rectDots(s, 11, oy + 32, 18, 1, 1);
    rectDots(s, 18, oy + 34, 4, 2, 1);
    // 젖혀진 문짝
    fillPoly(
      s,
      [
        [sw, 0],
        [sw + 9, 3],
        [sw + 9, sh + 3],
        [sw, sh + 1],
      ],
      -1,
    );
    lineDots(s, sw, 0, sw + 9, 3, 1);
    lineDots(s, sw + 9, 3, sw + 9, sh + 2, 1);
    lineDots(s, sw, sh + 1, sw + 9, sh + 3, 1);
    rectDots(s, sw + 4, 18, 3, 6, 1);
    ink.safeOpen = placed(s, sx, sy - oy);
  }

  return { tone, ink };
}
