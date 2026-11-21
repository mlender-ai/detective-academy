// 깊이 방향으로 본 학원 복도(한 점 투시)를 "층"으로 나눠 그린다. A안(시네마틱 복도)이 쓴다.
// scripts/mono-art.mjs 의 복도를 실행 중에 그리도록 옮기고 나눈 것이다 (V3 GATE 01 → lab/gate01 에서 옮겨 옴).
// 한 장의 그림에 다 넣지 않는다: 바탕 밝기, 전등마다의 빛, 문에서 새는 빛, 융단 줄무늬, 먹선, 움직이는 물건, 전경.
// 빛을 따로 두었으므로 전등이 꺼지거나 문이 열리면 그 빛만 더하고 빼서 점묘가 실제로 바뀐다.

import { gray, lineDots, makeSprite, putDot, rectDots, fillPoly, spriteCanvas, type Sprite } from "./dot";

export const W = 240;
export const H = 160;
export const VX = 120;
export const VY = 72;
const HW = 18;
const UP = 17;
const DN = 22;
const KM = 7;

/** 깊이 k(1 = 복도 끝, 클수록 가깝다)에서 벽·천장·바닥이 놓이는 자리 */
export const wallX = (k: number, side: number) => VX + side * HW * k;
export const ceilY = (k: number) => VY - UP * k;
export const floorY = (k: number) => VY + DN * k;
/** 바닥 위의 한 점: u 는 복도 폭에 대한 좌우 위치(-1 왼벽 ~ 1 오른벽) */
export const place = (k: number, u: number) => ({ x: VX + u * HW * k, y: floorY(k) });
/** 그 깊이에 선 사람의 키(점) */
export const heightAt = (k: number) => Math.max(14, Math.round(k * 25.5));

export const LAMPS = [1.36, 2.05, 3.05];
/** 양쪽 벽의 문: [먼 쪽 k, 가까운 쪽 k] */
export const DOORS: [number, number][] = [
  [1.16, 1.36],
  [1.62, 2.02],
  [2.5, 3.3],
];
const doorTop = (k: number) => VY - UP * k * 0.56;

const SS = 3;

function toneCanvas(draw: (c: CanvasRenderingContext2D) => void, fill = "#000"): HTMLCanvasElement {
  const big = document.createElement("canvas");
  big.width = W * SS;
  big.height = H * SS;
  const c = big.getContext("2d")!;
  c.scale(SS, SS);
  if (fill) {
    c.fillStyle = fill;
    c.fillRect(0, 0, W, H);
  }
  draw(c);
  const out = document.createElement("canvas");
  out.width = W;
  out.height = H;
  const oc = out.getContext("2d")!;
  oc.imageSmoothingQuality = "high";
  oc.drawImage(big, 0, 0, W, H);
  return out;
}

type Pt = [number, number];
const path = (c: CanvasRenderingContext2D, pts: Pt[]) => {
  c.beginPath();
  pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.closePath();
};
const clip = (c: CanvasRenderingContext2D, pts: Pt[], fn: () => void) => {
  c.save();
  path(c, pts);
  c.clip();
  fn();
  c.restore();
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
const lin = (c: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, stops: [number, number][]) => {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  stops.forEach(([t, v]) => g.addColorStop(t, gray(v)));
  return g;
};

const wall = (s: number): Pt[] => [
  [wallX(1, s), ceilY(1)],
  [wallX(KM, s), ceilY(KM)],
  [wallX(KM, s), floorY(KM)],
  [wallX(1, s), floorY(1)],
];
const CEIL: Pt[] = [
  [wallX(1, -1), ceilY(1)],
  [wallX(1, 1), ceilY(1)],
  [wallX(KM, 1), ceilY(KM)],
  [wallX(KM, -1), ceilY(KM)],
];
const FLOOR: Pt[] = [
  [wallX(1, -1), floorY(1)],
  [wallX(1, 1), floorY(1)],
  [wallX(KM, 1), floorY(KM)],
  [wallX(KM, -1), floorY(KM)],
];

export interface Placed {
  canvas: HTMLCanvasElement;
  x: number;
  y: number;
}

export interface CorridorArt {
  /** 밝기 층 (240×160 회색) */
  tone: Record<string, HTMLCanvasElement>;
  /** 먹 층: 그림과 놓일 자리(왼쪽 위) */
  ink: Record<string, Placed>;
}

const placed = (s: Sprite, x = 0, y = 0): Placed => ({ canvas: spriteCanvas(s), x, y });

/** 물건 위에 내건 작은 표지(정면을 본다). 벽의 물건은 원근 때문에 얇게 보이므로 표지로 알아보게 한다. */
function sign(kind: "paper" | "key" | "seal" | "file"): Sprite {
  const s = makeSprite(11, 11);
  rectDots(s, 0, 0, 11, 11, -1);
  rectDots(s, 1, 1, 9, 9, 1);
  if (kind === "paper") {
    rectDots(s, 3, 2, 5, 7, -1);
    rectDots(s, 4, 3, 3, 1, 1);
    rectDots(s, 4, 5, 3, 1, 1);
    rectDots(s, 4, 7, 2, 1, 1);
  } else if (kind === "key") {
    rectDots(s, 2, 3, 4, 4, -1);
    rectDots(s, 3, 4, 2, 2, 1);
    rectDots(s, 6, 4, 3, 2, -1);
    rectDots(s, 8, 6, 1, 2, -1);
    rectDots(s, 6, 6, 1, 1, -1);
  } else if (kind === "seal") {
    rectDots(s, 2, 3, 7, 5, -1);
    lineDots(s, 2, 3, 5, 6, 1);
    lineDots(s, 8, 3, 5, 6, 1);
    rectDots(s, 5, 6, 1, 1, 1);
  } else {
    rectDots(s, 2, 2, 7, 3, -1);
    rectDots(s, 2, 6, 7, 3, -1);
    rectDots(s, 5, 3, 1, 1, 1);
    rectDots(s, 5, 7, 1, 1, 1);
  }
  return s;
}

export function paintCorridor(): CorridorArt {
  const tone: Record<string, HTMLCanvasElement> = {};
  const ink: Record<string, Placed> = {};

  // ── 바탕: 어둠 속에서도 면이 구분되는 만큼만 ──
  tone.base = toneCanvas((c) => {
    c.fillStyle = gray(0.07);
    path(c, wall(-1));
    c.fill();
    path(c, wall(1));
    c.fill();
    c.fillStyle = gray(0.02);
    path(c, CEIL);
    c.fill();
    c.fillStyle = gray(0.05);
    path(c, FLOOR);
    c.fill();
    // 허리 몰딩
    c.save();
    c.globalCompositeOperation = "lighter";
    c.strokeStyle = gray(0.3);
    c.lineWidth = 0.9;
    for (const s of [-1, 1]) {
      c.beginPath();
      c.moveTo(wallX(1, s), VY + 6.5);
      c.lineTo(wallX(KM, s), VY + 6.5 * KM);
      c.stroke();
    }
    c.restore();
    // 문은 벽보다 어둡다
    c.fillStyle = "#000";
    for (const s of [-1, 1])
      DOORS.forEach(([k1, k2], i) => {
        if (s < 0 && i === 1) return; // 왼쪽 가운데는 게시판 자리
        path(c, [
          [wallX(k1, s), doorTop(k1)],
          [wallX(k2, s), doorTop(k2)],
          [wallX(k2, s), floorY(k2)],
          [wallX(k1, s), floorY(k1)],
        ]);
        c.globalAlpha = 0.8;
        c.fill();
        c.globalAlpha = 1;
      });
    // 끝 벽
    c.fillRect(wallX(1, -1), ceilY(1), HW * 2, UP + DN);
  });

  // ── 전등마다의 빛 ──
  LAMPS.forEach((k, i) => {
    tone[`lamp${i}`] = toneCanvas((c) => {
      clip(c, FLOOR, () => glow(c, VX, floorY(k) + 1.2 * k, HW * k * 1.05, DN * k * 0.3, [[0, 0.95], [0.45, 0.6], [1, 0]]));
      clip(c, CEIL, () => glow(c, VX, ceilY(k), HW * k * 0.8, UP * k * 0.24, [[0, 0.7], [0.5, 0.3], [1, 0]]));
      for (const s of [-1, 1])
        clip(c, wall(s), () => {
          const x0 = wallX(k * 0.72, s);
          const x1 = wallX(k * 1.34, s);
          const tmp = document.createElement("canvas");
          tmp.width = W * SS;
          tmp.height = H * SS;
          const t = tmp.getContext("2d")!;
          t.scale(SS, SS);
          t.fillStyle = lin(t, x0, 0, x1, 0, [[0, 0], [0.42, 0.62], [0.6, 0.5], [1, 0]]);
          t.fillRect(0, 0, W, H);
          t.globalCompositeOperation = "multiply";
          t.fillStyle = lin(t, 0, ceilY(k), 0, floorY(k), [[0, 1], [0.55, 0.8], [1, 0.42]]);
          t.fillRect(0, 0, W, H);
          c.save();
          c.globalCompositeOperation = "lighter";
          c.setTransform(1, 0, 0, 1, 0, 0);
          c.drawImage(tmp, 0, 0);
          c.restore();
        });
    });
  });

  // ── 끝 방에서 새는 빛 ──
  const dw = 7;
  const dt = VY - 11;
  tone.far = toneCanvas((c) => {
    c.fillStyle = "#fff";
    c.fillRect(VX - dw, dt, dw * 2, floorY(1) - dt);
    clip(c, FLOOR, () => {
      c.save();
      c.globalCompositeOperation = "lighter";
      c.fillStyle = lin(c, 0, floorY(1), 0, floorY(1.9), [[0, 0.95], [0.5, 0.5], [1, 0]]);
      path(c, [
        [VX - dw, floorY(1)],
        [VX + dw, floorY(1)],
        [VX + dw * 2.6, floorY(1.9)],
        [VX - dw * 2.6, floorY(1.9)],
      ]);
      c.fill();
      c.restore();
    });
  });

  // ── 옆문이 열리면 새는 빛: 문 안이 밝아지고, 바닥에 쐐기 모양으로 떨어진다 ──
  const doorLight = (s: number, [k1, k2]: [number, number]) =>
    toneCanvas((c) => {
      c.fillStyle = gray(0.92);
      path(c, [
        [wallX(k1, s), doorTop(k1)],
        [wallX(k2, s), doorTop(k2)],
        [wallX(k2, s), floorY(k2)],
        [wallX(k1, s), floorY(k1)],
      ]);
      c.fill();
      clip(c, FLOOR, () => {
        c.save();
        c.globalCompositeOperation = "lighter";
        const xa = wallX(k1, s);
        const xb = wallX(k2, s);
        c.fillStyle = lin(c, (xa + xb) / 2, 0, VX - s * HW * k2 * 0.7, 0, [[0, 0.85], [0.6, 0.35], [1, 0]]);
        path(c, [
          [xa, floorY(k1)],
          [xb, floorY(k2)],
          [VX - s * HW * k2 * 0.75, floorY(k2 * 1.04)],
          [VX - s * HW * k1 * 0.5, floorY(k1 * 0.98)],
        ]);
        c.fill();
        c.restore();
      });
    });
  tone.doorR0 = doorLight(1, DOORS[0]);
  tone.doorR2 = doorLight(1, DOORS[2]);

  // ── 융단: 멀어질수록 촘촘해지는 줄무늬 (곱해서 어둡게) ──
  const rw = 7.6;
  tone.runner = toneCanvas((c) => {
    clip(
      c,
      [
        [VX - rw, floorY(1)],
        [VX + rw, floorY(1)],
        [VX + rw * KM, floorY(KM)],
        [VX - rw * KM, floorY(KM)],
      ],
      () => {
        let k = 1;
        let odd = false;
        while (k < KM) {
          const k2 = k * 1.085;
          if (odd) {
            c.fillStyle = gray(0.3);
            c.fillRect(0, floorY(k), W, floorY(k2) - floorY(k));
          }
          odd = !odd;
          k = k2;
        }
      },
    );
  }, "#fff");

  // ── 먹선: 구조의 모서리, 문틀, 게시판, 보관함 ──
  const m = makeSprite(W, H);
  for (const s of [-1, 1]) {
    lineDots(m, VX + s * rw, floorY(1), VX + s * rw * 4.6, floorY(4.6), -1);
    lineDots(m, wallX(1, s), floorY(1), wallX(4.8, s), floorY(4.8), -1);
    lineDots(m, wallX(1, s), ceilY(1), wallX(4.8, s), ceilY(4.8), -1);
  }
  rectDots(m, wallX(1, -1), ceilY(1), HW * 2, UP + DN, -1);
  // 끝 방의 문 안은 먹으로 덮지 않는다: 방 안의 불빛(tone.far)이 비쳐, 그 앞에 선 사람이 검은 실루엣으로 보인다
  rectDots(m, VX - dw, dt, dw * 2, Math.round(floorY(1)) - dt, 0);
  // 끝 문의 틀
  for (let i = 0; i < 2; i++) {
    const x = VX - dw - 2 - i * 2;
    const y = dt - 2 - i * 2;
    const w = dw * 2 + 4 + i * 4;
    const h = floorY(1) - dt + 2 + i * 2;
    rectDots(m, x, y, w, 1, -1);
    rectDots(m, x, y, 1, h, -1);
    rectDots(m, x + w - 1, y, 1, h, -1);
  }
  const doorFrame = (s: number, [k1, k2]: [number, number], panels: boolean) => {
    lineDots(m, wallX(k1, s), doorTop(k1), wallX(k2, s), doorTop(k2), 1);
    lineDots(m, wallX(k1, s), doorTop(k1), wallX(k1, s), floorY(k1) - 1, 1);
    lineDots(m, wallX(k2, s), doorTop(k2), wallX(k2, s), floorY(k2) - 1, 1);
    if (panels) {
      const a = k1 + (k2 - k1) * 0.22;
      const b = k1 + (k2 - k1) * 0.8;
      lineDots(m, wallX(a, s), VY - UP * a * 0.42, wallX(b, s), VY - UP * b * 0.42, 1, 1);
      lineDots(m, wallX(a, s), VY + DN * a * 0.2, wallX(b, s), VY + DN * b * 0.2, 1, 1);
    }
    const kk = k1 + (k2 - k1) * 0.82;
    putDot(m, wallX(kk, s), VY + 3.2 * kk, 1);
  };
  doorFrame(-1, DOORS[0], false);
  doorFrame(-1, DOORS[2], true);
  doorFrame(1, DOORS[0], false);
  doorFrame(1, DOORS[1], true);
  // 오른쪽 가까운 문(연습실)은 닫힌 문짝을 따로 둔다: 열리면 문짝 선을 걷어낸다
  lineDots(m, wallX(DOORS[2][0], 1), doorTop(DOORS[2][0]), wallX(DOORS[2][1], 1), doorTop(DOORS[2][1]), 1);
  lineDots(m, wallX(DOORS[2][0], 1), doorTop(DOORS[2][0]), wallX(DOORS[2][0], 1), floorY(DOORS[2][0]) - 1, 1);
  lineDots(m, wallX(DOORS[2][1], 1), doorTop(DOORS[2][1]), wallX(DOORS[2][1], 1), floorY(DOORS[2][1]) - 1, 1);

  // 게시판: 왼쪽 벽 가운데. 틀과, 틀 안의 검은 판.
  const [b1, b2] = [1.66, 2.1];
  const bTop = (k: number) => VY - UP * k * 0.5;
  const bBot = (k: number) => VY + DN * k * 0.12;
  fillPoly(
    m,
    [
      [wallX(b2, -1), bTop(b2)],
      [wallX(b1, -1) + 1, bTop(b1)],
      [wallX(b1, -1) + 1, bBot(b1)],
      [wallX(b2, -1), bBot(b2)],
    ],
    -1,
  );
  lineDots(m, wallX(b2, -1), bTop(b2), wallX(b1, -1), bTop(b1), 1);
  lineDots(m, wallX(b2, -1), bBot(b2), wallX(b1, -1), bBot(b1), 1);
  lineDots(m, wallX(b2, -1), bTop(b2), wallX(b2, -1), bBot(b2), 1);
  lineDots(m, wallX(b1, -1), bTop(b1), wallX(b1, -1), bBot(b1), 1);

  // 기록 보관함: 왼쪽 가까운 벽 앞의 낮은 서랍장
  const [c1, c2] = [2.55, 3.05];
  const cTop = (k: number) => VY + DN * k * 0.36;
  const depth = 0.2;
  const front: Pt[] = [
    [wallX(c2, -1) + HW * c2 * depth, cTop(c2)],
    [wallX(c1, -1) + HW * c1 * depth, cTop(c1)],
    [wallX(c1, -1) + HW * c1 * depth, floorY(c1)],
    [wallX(c2, -1) + HW * c2 * depth, floorY(c2)],
  ];
  fillPoly(m, [[wallX(c2, -1), cTop(c2)], front[0], front[3], [wallX(c2, -1), floorY(c2)]], -1);
  fillPoly(m, front, -1);
  lineDots(m, front[0][0], front[0][1], front[1][0], front[1][1], 1);
  lineDots(m, front[0][0], front[0][1], front[3][0], front[3][1] - 1, 1);
  lineDots(m, front[1][0], front[1][1], front[2][0], front[2][1] - 1, 1);
  lineDots(m, wallX(c2, -1), cTop(c2), front[0][0], front[0][1], 1);
  for (const f of [0.34, 0.67]) {
    const y0 = front[0][1] + (front[3][1] - front[0][1]) * f;
    const y1 = front[1][1] + (front[2][1] - front[1][1]) * f;
    lineDots(m, front[0][0], y0, front[1][0], y1, 1, 1);
  }
  ink.mid = placed(m);

  // 닫힌 연습실 문짝의 판 무늬 (열리면 숨긴다)
  const d = makeSprite(W, H);
  {
    const [k1, k2] = DOORS[2];
    const a = k1 + (k2 - k1) * 0.22;
    const b = k1 + (k2 - k1) * 0.8;
    lineDots(d, wallX(a, 1), VY - UP * a * 0.42, wallX(b, 1), VY - UP * b * 0.42, 1, 1);
    lineDots(d, wallX(a, 1), VY + DN * a * 0.2, wallX(b, 1), VY + DN * b * 0.2, 1, 1);
    const kk = k1 + (k2 - k1) * 0.82;
    putDot(d, wallX(kk, 1), VY + 3.2 * kk, 1);
    putDot(d, wallX(kk, 1), VY + 3.2 * kk + 1, 1);
  }
  ink.doorR2closed = placed(d);

  // 게시판의 종이: 바람에 한 귀퉁이가 들린다 (세 장면)
  for (let f = 0; f < 3; f++) {
    const p = makeSprite(W, H);
    const papers: [number, number, number][] = [
      [1.74, -0.36, 0.2],
      [1.9, -0.3, 0.26],
      [2.02, -0.4, 0.18],
    ];
    papers.forEach(([k, top, hgt], i) => {
      const x = Math.round(wallX(k, -1)) + 1;
      const y = Math.round(VY + UP * k * top);
      const hh = Math.max(3, Math.round(UP * k * hgt));
      rectDots(p, x, y, 2, hh, 1);
      // 들린 귀퉁이
      if (f > 0 && i === f - 1) {
        putDot(p, x + 2, y + hh - 1, 1);
        putDot(p, x + 1, y + hh - 1, -1);
      }
    });
    ink[`papers${f}`] = placed(p);
  }

  // 전등 기구: 켜진 것과 꺼진 것
  LAMPS.forEach((k, i) => {
    const rx = Math.max(1.5, 2.3 * k);
    const ry = Math.max(0.8, 0.62 * k);
    const w = Math.ceil(rx * 2 + 4);
    const h = Math.ceil(ry * 2 + 4);
    const cx = w / 2;
    const cy = h / 2;
    const disc = (s: Sprite, ax: number, ay: number, v: number) => {
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const dx = (x + 0.5 - cx) / ax;
          const dy = (y + 0.5 - cy) / ay;
          if (dx * dx + dy * dy <= 1) putDot(s, x, y, v);
        }
    };
    const on = makeSprite(w, h);
    disc(on, rx + 1, ry + 0.8, -1);
    disc(on, rx, ry, 1);
    const off = makeSprite(w, h);
    disc(off, rx + 1, ry + 0.8, -1);
    disc(off, rx, ry, 1);
    disc(off, rx - 1, Math.max(0.3, ry - 0.7), -1);
    const x = Math.round(VX - cx);
    const y = Math.round(ceilY(k) + ry + 0.6 - cy);
    ink[`lampOn${i}`] = placed(on, x, y);
    ink[`lampOff${i}`] = placed(off, x, y);
  });

  // 표지
  const signAt = (kind: Parameters<typeof sign>[0], x: number, y: number) => placed(sign(kind), Math.round(x - 5), Math.round(y - 5));
  ink.signBoard = signAt("paper", wallX(1.88, -1) + 9, VY - UP * 1.88 * 0.74);
  ink.signPractice = signAt("key", wallX(2.9, 1) - 9, VY - UP * 2.9 * 0.72);
  ink.signExam = signAt("seal", VX, dt - 11);
  ink.signArchive = signAt("file", wallX(2.8, -1) + HW * 2.8 * 0.2 + 3, cTop(2.8) - 9);

  // 전경: 화면 양옆의 문틀 기둥. 캐릭터와 복도보다 앞에 있다.
  const fg = makeSprite(W + 40, H);
  for (const s of [-1, 1]) {
    const x = s < 0 ? 20 + 18 : 20 + W - 18 - 13;
    rectDots(fg, x, 0, 13, H, -1);
    rectDots(fg, s < 0 ? x + 12 : x, 0, 1, H, 1);
    rectDots(fg, s < 0 ? x + 9 : x + 3, 0, 1, H, 1);
    for (let y = 6; y < H; y += 4) putDot(fg, s < 0 ? x + 6 : x + 6, y, 1);
  }
  ink.fg = placed(fg, -20, 0);

  return { tone, ink };
}
