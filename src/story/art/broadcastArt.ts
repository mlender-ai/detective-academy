// CASE D-001 · BJ 토끼의 방송실. 방송 화면(카메라가 본 방)을 "층"으로 나눠 그린다.
// 가운데에 의자와 방송인, 왼쪽에 선반과 마이크, 오른쪽에 링 라이트와 달 포스터, 앞에는 책상.
// 시점마다 사람만 달라진다: 앉아 있다 → 일어나 나간다 → 빈 의자에 가면만 걸려 있다 → 화면이 꺼진다.
// 그리는 방식은 학원의 장면과 같다(밝기 층을 점묘로 바꾸고 먹 층을 얹는다).
import { BAYER4, fillPoly, getDot, gray, haloDots, lineDots, makeSprite, putDot, rectDots, spriteCanvas, type Sprite } from "../../scene/dot";
import type { Placed } from "../../scene/sideArt";
import { toneLayer, type InkOp, type StageFrame, type ToneOp } from "../../scene/stage";

/** 방송 화면의 폭과 높이(점). 화면에는 두 배(328×184px)로 놓인다. */
export const SW = 164;
export const SH = 92;

/** 책상 윗면의 줄, 의자의 가운데 */
const DESK = 70;
const CX = 82;

/** 방송의 네 시점, 그리고 사건의 끝 장면("mask": 책상 위에 놓인 가면을 가까이에서) */
export type StreamFrameId = "t0015" | "t0310" | "t0640" | "t0700" | "mask";

export interface StreamArt {
  tone: Record<string, HTMLCanvasElement>;
  ink: Record<string, Placed>;
  noise: HTMLCanvasElement[];
}

const placed = (s: Sprite, x = 0, y = 0): Placed => ({ canvas: spriteCanvas(s), x, y });
const layer = (draw: (c: CanvasRenderingContext2D) => void, fill: string | null = "#000") => toneLayer(SW, SH, draw, fill);

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

const box = (s: Sprite, x: number, y: number, w: number, h: number, v = 1) => {
  rectDots(s, x, y, w, 1, v);
  rectDots(s, x, y + h - 1, w, 1, v);
  rectDots(s, x, y, 1, h, v);
  rectDots(s, x + w - 1, y, 1, h, v);
};

/** 테를 두른 검은 덩어리: 어두운 방에서도 윤곽이 읽힌다 */
const slab = (s: Sprite, x: number, y: number, w: number, h: number) => {
  rectDots(s, x, y, w, h, -1);
  box(s, x, y, w, h, 1);
};

const ring = (s: Sprite, cx: number, cy: number, r: number, v: number, thick = 1) => {
  for (let y = -r - 1; y <= r + 1; y++)
    for (let x = -r - 1; x <= r + 1; x++) {
      const d = Math.hypot(x, y);
      if (d <= r + 0.5 && d > r - thick + 0.5) putDot(s, cx + x, cy + y, v);
    }
};

const disc = (s: Sprite, cx: number, cy: number, rx: number, ry: number, v: number) => {
  for (let y = Math.floor(-ry); y <= Math.ceil(ry); y++)
    for (let x = Math.floor(-rx); x <= Math.ceil(rx); x++) if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) putDot(s, cx + x, cy + y, v);
};

/**
 * 다각형 안을 점묘로 채운다(천의 결). level 은 흰 점의 비율(0~1)이고, 나머지는 검은 점이다.
 * 먹 층은 두 값뿐이라 중간 밝기는 이렇게 직접 찍는다.
 */
const shade = (s: Sprite, pts: [number, number][], level: number) => {
  const mask = makeSprite(s.w, s.h);
  fillPoly(mask, pts, 1);
  for (let y = 0; y < s.h; y++)
    for (let x = 0; x < s.w; x++) {
      if (!getDot(mask, x, y)) continue;
      putDot(s, x, y, (BAYER4[(y & 3) * 4 + (x & 3)] + 0.5) / 16 < level ? 1 : -1);
    }
};

/** 작은 글자(3×5점): 방 안의 표지에 쓴다 */
const TINY: Record<string, string[]> = {
  O: ["###", "#.#", "#.#", "#.#", "###"],
  N: ["#.#", "###", "###", "###", "#.#"],
  A: [".#.", "#.#", "###", "#.#", "#.#"],
  I: ["###", ".#.", ".#.", ".#.", "###"],
  R: ["##.", "#.#", "##.", "#.#", "#.#"],
};

const tiny = (s: Sprite, text: string, x: number, y: number, v: number) => {
  let at = x;
  for (const ch of text) {
    const g = TINY[ch];
    if (g) g.forEach((row, j) => [...row].forEach((bit, i) => bit === "#" && putDot(s, at + i, y + j, v)));
    at += ch === " " ? 2 : 4;
  }
};

/* ───────── 토끼 가면 ───────── */

/**
 * 가면 한 장(귀 포함). 흰 얼굴에 검은 눈 둘과 작은 입, 긴 귀 둘(한쪽은 끝이 접혔다).
 * droop: 벗어서 걸어 둔 가면(귀가 옆으로 늘어진다).
 */
function maskSprite(droop = false): Sprite {
  const s = makeSprite(23, 30, 11, 29);
  const top = 15;
  if (!droop) {
    // 왼쪽 귀: 곧게
    rectDots(s, 5, 2, 4, 14, 1);
    rectDots(s, 6, 1, 2, 1, 1);
    rectDots(s, 6, 4, 2, 10, -1);
    rectDots(s, 6, 4, 1, 10, 1);
    // 오른쪽 귀: 끝이 바깥으로 접혔다
    rectDots(s, 14, 6, 4, 10, 1);
    fillPoly(s, [[14, 6], [18, 6], [22, 2], [20, 0], [15, 3]], 1);
    rectDots(s, 15, 8, 2, 7, -1);
    rectDots(s, 16, 8, 1, 7, 1);
  } else {
    // 걸어 둔 가면: 두 귀가 아래로 처진다
    fillPoly(s, [[4, 16], [8, 16], [5, 6], [1, 4], [0, 8]], 1);
    fillPoly(s, [[15, 16], [19, 16], [22, 9], [21, 5], [17, 7]], 1);
    lineDots(s, 4, 13, 2, 7, -1);
    lineDots(s, 18, 13, 20, 8, -1);
  }
  // 얼굴: 둥근 네모
  rectDots(s, 4, top + 1, 15, 12, 1);
  rectDots(s, 5, top, 13, 14, 1);
  rectDots(s, 6, top + 14, 11, 1, 1);
  // 눈: 단추처럼 둥글고 검다. 가운데에 실 구멍 둘.
  for (const ex of [8, 14]) {
    rectDots(s, ex - 1, top + 4, 4, 4, -1);
    rectDots(s, ex, top + 3, 2, 6, -1);
    putDot(s, ex, top + 5, 1);
    putDot(s, ex + 1, top + 6, 1);
  }
  // 입: 꿰맨 자국. 살짝 비뚤다.
  for (const [x, y] of [[7, 11], [9, 12], [11, 12], [13, 12], [15, 11]] as const) putDot(s, x, top + y, -1);
  for (const x of [9, 13]) putDot(s, x, top + 11, -1);
  return haloDots(s, -1);
}

/**
 * 가까이에서 본 가면(사건의 끝 장면). 작은 가면을 늘린 것이 아니라 같은 생김새를 큰 치수로 다시 찍는다(점은 그대로 한 점이다).
 * 곧은 왼쪽 귀, 끝이 바깥으로 접힌 오른쪽 귀, 단추 눈 둘, 꿰맨 입.
 */
function bigMaskSprite(): Sprite {
  const s = makeSprite(42, 52, 20, 51);
  // 왼쪽 귀: 곧게
  rectDots(s, 7, 2, 7, 24, 1);
  rectDots(s, 8, 1, 5, 1, 1);
  rectDots(s, 9, 0, 3, 1, 1);
  rectDots(s, 9, 6, 3, 17, -1);
  rectDots(s, 9, 6, 1, 17, 1);
  // 오른쪽 귀: 끝이 바깥으로 접혔다
  rectDots(s, 26, 10, 7, 16, 1);
  fillPoly(s, [[26, 10], [33, 10], [41, 4], [37, 0], [28, 5]], 1);
  rectDots(s, 28, 13, 3, 10, -1);
  rectDots(s, 30, 13, 1, 10, 1);
  lineDots(s, 28, 9, 33, 9, -1);
  // 얼굴: 둥근 네모
  rectDots(s, 6, 24, 29, 1, 1);
  rectDots(s, 4, 25, 33, 23, 1);
  rectDots(s, 5, 48, 31, 1, 1);
  rectDots(s, 7, 49, 27, 1, 1);
  putDot(s, 4, 25, 0);
  putDot(s, 36, 25, 0);
  putDot(s, 4, 47, 0);
  putDot(s, 36, 47, 0);
  // 눈: 검은 단추. 실 구멍 둘.
  for (const ex of [13, 27]) {
    disc(s, ex, 34, 3.4, 3.4, -1);
    putDot(s, ex - 1, 33, 1);
    putDot(s, ex + 1, 35, 1);
  }
  // 코와 입: 꿰맨 자국. 살짝 비뚤다.
  rectDots(s, 19, 39, 2, 1, -1);
  for (let x = 13; x <= 27; x += 2) putDot(s, x, x < 17 ? 43 : x > 23 ? 43 : 44, -1);
  for (const x of [15, 20, 25]) {
    putDot(s, x, x === 20 ? 43 : 42, -1);
    putDot(s, x, x === 20 ? 45 : 44, -1);
  }
  return haloDots(s, -1);
}

/* ───────── 방송인 ───────── */

interface Pose {
  /** 머리가 기운 정도(점): -1 왼쪽 · 0 · 1 오른쪽 */
  tilt: number;
  /** 일어선 자세인가 (몸이 길어지고 팔을 내린다) */
  standing: boolean;
}

/**
 * 가면을 쓴 방송인. 긴 검은 머리, 후드 집업, 책상 위에 올린 두 손.
 * 검은 덩어리에 흰 테를 두르고, 가면만 흰 면이다: 얼굴은 한 번도 보이지 않는다.
 */
function tokkiSprite({ tilt, standing }: Pose): Sprite {
  const w = 58;
  const h = standing ? 84 : 64;
  const s = makeSprite(w, h, 29, h - 1);
  const cx = 29;
  const neck = 34;

  // 후드 집업의 몸통: 어깨가 넓고 아래로 조금 좁아진다
  const hem = h - 1;
  const torso: [number, number][] = [
    [cx - 9, neck - 2],
    [cx + 9, neck - 2],
    [cx + 20, neck + 6],
    [cx + 23, hem],
    [cx - 23, hem],
    [cx - 20, neck + 6],
  ];
  fillPoly(s, torso, -1);
  for (let i = 0; i < torso.length; i++) {
    const [x0, y0] = torso[i];
    const [x1, y1] = torso[(i + 1) % torso.length];
    if (y0 === hem && y1 === hem) continue;
    lineDots(s, x0, y0, x1, y1, 1);
  }
  // 등 뒤로 넘긴 모자
  fillPoly(s, [[cx - 13, neck - 1], [cx + 13, neck - 1], [cx + 10, neck + 5], [cx - 10, neck + 5]], -1);
  lineDots(s, cx - 13, neck - 1, cx - 10, neck + 5, 1);
  lineDots(s, cx + 13, neck - 1, cx + 10, neck + 5, 1);
  // 지퍼와 끈, 옷의 주름
  lineDots(s, cx, neck + 4, cx, hem, 1, 1);
  lineDots(s, cx - 14, neck + 12, cx - 12, neck + 20, 1, 1);
  lineDots(s, cx + 15, neck + 16, cx + 13, neck + 23, 1, 1);
  lineDots(s, cx - 4, neck + 5, cx - 5, neck + 14, 1);
  lineDots(s, cx + 4, neck + 5, cx + 5, neck + 14, 1);
  putDot(s, cx - 5, neck + 15, 1);
  putDot(s, cx + 5, neck + 15, 1);
  // 가슴의 작은 표식: 초승달
  disc(s, cx + 11, neck + 13, 3.2, 3.2, 1);
  disc(s, cx + 13, neck + 12, 2.6, 2.6, -1);

  if (!standing) {
    // 책상 위에 올린 두 팔과 손
    lineDots(s, cx - 20, neck + 8, cx - 15, hem - 5, 1);
    lineDots(s, cx + 20, neck + 8, cx + 15, hem - 5, 1);
    rectDots(s, cx - 15, hem - 5, 9, 5, 1);
    rectDots(s, cx + 7, hem - 5, 9, 5, 1);
    rectDots(s, cx - 13, hem - 4, 1, 3, -1);
    rectDots(s, cx - 10, hem - 4, 1, 3, -1);
    rectDots(s, cx + 9, hem - 4, 1, 3, -1);
    rectDots(s, cx + 12, hem - 4, 1, 3, -1);
  } else {
    // 내린 팔: 소매의 선
    lineDots(s, cx - 17, neck + 10, cx - 18, neck + 36, 1);
    lineDots(s, cx + 17, neck + 10, cx + 18, neck + 36, 1);
    rectDots(s, cx - 22, neck + 37, 5, 4, 1);
    rectDots(s, cx + 18, neck + 37, 5, 4, 1);
  }

  // 긴 머리: 가면 뒤에서 어깨 아래까지. 검은 덩어리에 흰 테.
  const hx = cx + tilt;
  const hair: [number, number][] = [
    [hx - 10, 15],
    [hx - 7, 11],
    [hx + 7, 11],
    [hx + 10, 15],
    [hx + 13, neck + 12],
    [hx + 8, neck + 16],
    [hx + 7, neck],
    [hx - 7, neck],
    [hx - 8, neck + 16],
    [hx - 13, neck + 12],
  ];
  fillPoly(s, hair, -1);
  for (let i = 0; i < hair.length; i++) {
    const [x0, y0] = hair[i];
    const [x1, y1] = hair[(i + 1) % hair.length];
    lineDots(s, x0, y0, x1, y1, 1);
  }
  // 머리카락의 결
  lineDots(s, hx - 10, 20, hx - 11, neck + 9, 1, 2);
  lineDots(s, hx + 10, 20, hx + 11, neck + 9, 1, 2);
  // 목
  rectDots(s, cx - 3, neck - 4, 6, 4, -1);

  // 가면
  const mask = maskSprite(false);
  const mx = hx - mask.ax;
  const my = neck - 2 - mask.ay;
  for (let y = 0; y < mask.h; y++)
    for (let x = 0; x < mask.w; x++) {
      const v = mask.px[y * mask.w + x];
      if (v !== 0) putDot(s, mx + x, my + y, v);
    }
  return s;
}

/* ───────── 방 ───────── */

export function paintStream(): StreamArt {
  const tone: Record<string, HTMLCanvasElement> = {};
  const ink: Record<string, Placed> = {};

  // ── 바탕: 어두운 벽, 더 어두운 책상 ──
  tone.base = layer((c) => {
    // 벽은 거의 검고, 아래쪽으로 갈수록 아주 조금 밝다(책상에서 되비치는 빛)
    const g = c.createLinearGradient(0, 0, 0, DESK);
    g.addColorStop(0, gray(0));
    g.addColorStop(0.55, gray(0.02));
    g.addColorStop(1, gray(0.1));
    c.fillStyle = g;
    c.fillRect(0, 0, SW, DESK);
    c.fillStyle = gray(0.02);
    c.fillRect(0, DESK, SW, SH - DESK);
  });

  // ── 링 라이트: 방송인의 얼굴 쪽을 비춘다 ──
  tone.ring = layer((c) => {
    glow(c, 112, 20, 22, 20, [
      [0, 0.8],
      [0.45, 0.32],
      [1, 0],
    ]);
    // 방송인의 뒤 벽에 떨어지는 둥근 빛
    glow(c, CX + 4, 38, 40, 34, [
      [0, 0.42],
      [0.55, 0.2],
      [1, 0],
    ]);
  });

  // ── 책상 아래의 모니터 빛: 화면 밖의 모니터가 아래에서 위로 비춘다 ──
  tone.screen = layer((c) => {
    glow(c, CX, DESK + 2, 50, 12, [
      [0, 0.34],
      [0.6, 0.12],
      [1, 0],
    ]);
  });

  // ── ON AIR 표지의 빛 ──
  tone.onair = layer((c) => {
    glow(c, 25, 78, 22, 11, [
      [0, 0.5],
      [0.55, 0.16],
      [1, 0],
    ]);
  });

  // ── 포스터의 달: 벽에서 혼자 밝다 ──
  tone.moon = layer((c) => {
    glow(c, 139, 24, 13, 13, [
      [0, 0.5],
      [0.7, 0.2],
      [1, 0],
    ]);
  });

  // ── 가장자리를 누른다: 방송 화면의 네 귀가 어둡다 ──
  tone.vignette = layer((c) => {
    const g = c.createRadialGradient(SW / 2, SH / 2, 20, SW / 2, SH / 2, 104);
    g.addColorStop(0, gray(1));
    g.addColorStop(0.7, gray(0.82));
    g.addColorStop(1, gray(0.3));
    c.fillStyle = g;
    c.fillRect(0, 0, SW, SH);
  }, null);

  // ── 꺼진 화면: 가운데만 희미하게 남는다 ──
  tone.off = layer((c) => {
    glow(c, SW / 2, SH / 2, 70, 30, [
      [0, 0.1],
      [1, 0],
    ]);
  });

  // ── 먹: 벽에 붙은 것들 ──
  {
    const s = makeSprite(SW, SH);
    // 선반: 칸마다 물건이 다르다
    slab(s, 7, 10, 36, 53);
    for (const y of [23, 36, 49]) rectDots(s, 8, y, 34, 1, 1);
    // 1칸: 책등
    for (const [x, hgt] of [[10, 9], [13, 11], [16, 8], [19, 10], [23, 11], [26, 7]] as const) box(s, x, 23 - hgt, 3, hgt, 1);
    lineDots(s, 31, 22, 37, 14, 1);
    lineDots(s, 32, 22, 38, 14, 1);
    // 2칸: 작은 토끼 인형 둘과 상자
    for (const x of [12, 20]) {
      rectDots(s, x, 30, 5, 5, 1);
      rectDots(s, x, 26, 1, 4, 1);
      rectDots(s, x + 4, 26, 1, 4, 1);
      putDot(s, x + 1, 32, -1);
      putDot(s, x + 3, 32, -1);
    }
    box(s, 29, 28, 11, 8, 1);
    lineDots(s, 29, 31, 39, 31, 1, 1);
    // 3칸: 꺼진 작은 모니터와 테이프
    box(s, 10, 39, 13, 10, 1);
    rectDots(s, 12, 41, 9, 6, 1);
    rectDots(s, 13, 42, 7, 4, -1);
    for (const x of [27, 31, 35]) box(s, x, 43, 3, 6, 1);
    // 4칸: 상자와 늘어진 전선
    box(s, 11, 53, 9, 9, 1);
    lineDots(s, 11, 57, 19, 57, 1);
    lineDots(s, 24, 50, 27, 58, 1, 1);
    lineDots(s, 27, 58, 34, 55, 1, 1);
    lineDots(s, 34, 55, 38, 62, 1, 1);

    // 달 포스터: 둥근 달 안에 토끼의 귀
    slab(s, 126, 9, 27, 32);
    disc(s, 139, 24, 9, 9, 1);
    fillPoly(s, [[135, 28], [137, 17], [139, 17], [139, 28]], -1);
    fillPoly(s, [[140, 28], [141, 18], [143, 19], [144, 28]], -1);
    disc(s, 139, 29, 5, 3, -1);
    for (let x = 129; x < 151; x += 3) putDot(s, x, 37, 1);
    // 포스터를 붙인 테이프
    rectDots(s, 124, 8, 4, 2, 1);
    rectDots(s, 151, 8, 4, 2, 1);

    // 링 라이트: 고리와 받침대
    ring(s, 112, 20, 9, 1, 2);
    ring(s, 112, 20, 5, 1, 1);
    rectDots(s, 111, 30, 2, 40, 1);
    lineDots(s, 111, 44, 106, 50, 1);

    // 천장 아래로 늘어진 꼬마전구
    for (let i = 0; i <= 12; i++) {
      const x = 46 + i * 5;
      const y = 5 + Math.round(Math.sin((i / 12) * Math.PI) * 4);
      putDot(s, x, y, 1);
      if (i % 2 === 0) rectDots(s, x - 1, y + 1, 2, 2, 1);
    }
    // 마이크 옆 벽의 메모지 두 장
    box(s, 49, 28, 7, 7, 1);
    lineDots(s, 51, 30, 53, 30, 1);
    lineDots(s, 51, 32, 53, 32, 1);
    fillPoly(s, [[57, 25], [63, 26], [62, 33], [56, 32]], 1);
    lineDots(s, 58, 28, 61, 28, -1);
    lineDots(s, 58, 30, 60, 30, -1);

    // 벽의 선: 걸레받이
    rectDots(s, 44, 62, 20, 1, 1);
    rectDots(s, 102, 62, 9, 1, 1);
    rectDots(s, 114, 62, SW - 114, 1, 1);
    rectDots(s, 0, 62, 7, 1, 1);
    // 오른쪽 구석의 화분
    box(s, 150, 54, 9, 9, 1);
    lineDots(s, 154, 53, 151, 45, 1);
    lineDots(s, 154, 53, 157, 44, 1);
    lineDots(s, 154, 53, 160, 49, 1);
    ink.room = placed(s);
  }

  // ── 먹: 의자 ──
  {
    const s = makeSprite(SW, SH);
    const back: [number, number][] = [
      [CX - 13, 21],
      [CX + 13, 21],
      [CX + 19, 27],
      [CX + 19, 36],
      [CX + 16, 40],
      [CX + 17, DESK],
      [CX - 17, DESK],
      [CX - 16, 40],
      [CX - 19, 36],
      [CX - 19, 27],
    ];
    // 가죽 등받이는 점묘로 채운다: 검은 옷과 검은 머리가 그 앞에서 또렷하다
    shade(s, back, 0.5);
    for (let i = 0; i < back.length; i++) {
      const [x0, y0] = back[i];
      const [x1, y1] = back[(i + 1) % back.length];
      if (y0 === DESK && y1 === DESK) continue;
      lineDots(s, x0, y0, x1, y1, 1);
    }
    // 등받이의 박음질과 머리 받침의 구멍
    lineDots(s, CX - 8, 42, CX - 9, DESK - 1, -1);
    lineDots(s, CX + 8, 42, CX + 9, DESK - 1, -1);
    rectDots(s, CX - 6, 25, 12, 6, -1);
    box(s, CX - 6, 25, 12, 6, 1);
    ink.chair = placed(s);
  }

  // ── 먹: 마이크(책상에서 뻗어 나온 팔) ──
  {
    const s = makeSprite(SW, SH);
    lineDots(s, 46, DESK, 51, 44, 1);
    lineDots(s, 47, DESK, 52, 44, 1);
    lineDots(s, 51, 44, 62, 52, 1);
    lineDots(s, 52, 44, 63, 52, 1);
    rectDots(s, 50, 42, 3, 3, 1);
    // 마이크 몸통과 그물
    rectDots(s, 60, 50, 7, 11, -1);
    box(s, 60, 50, 7, 11, 1);
    for (let y = 52; y < 58; y += 2) rectDots(s, 62, y, 3, 1, 1);
    rectDots(s, 62, 61, 3, 2, 1);
    ink.mic = placed(s);
  }

  // ── 먹: 책상과 그 위의 것들 (가장 앞) ──
  {
    const s = makeSprite(SW, SH);
    rectDots(s, 0, DESK, SW, 1, 1);
    rectDots(s, 0, DESK + 1, SW, 1, -1);
    // ON AIR 표지
    slab(s, 10, 73, 31, 11);
    tiny(s, "ON AIR", 14, 76, 1);
    rectDots(s, 23, 84, 5, 2, 1);
    // 자판
    slab(s, 56, 78, 52, 9);
    for (let y = 80; y < 86; y += 2) for (let x = 58; x < 106; x += 3) putDot(s, x, y, 1);
    rectDots(s, 70, 85, 22, 1, 1);
    // 마우스와 컵
    slab(s, 113, 79, 7, 8);
    rectDots(s, 116, 79, 1, 3, 1);
    slab(s, 128, 74, 9, 12);
    box(s, 136, 77, 4, 5, 1);
    lineDots(s, 131, 73, 130, 70, 1, 1);
    lineDots(s, 134, 73, 135, 69, 1, 1);
    // 책상 끝의 종이들
    fillPoly(s, [[146, 78], [160, 76], [162, 87], [148, 89]], 1);
    for (const y of [80, 82, 84]) lineDots(s, 150, y, 158, y - 1, -1);
    ink.desk = placed(s);
  }

  // ── 사람과 가면 ──
  for (const tilt of [-1, 0, 1]) {
    const seat = tokkiSprite({ tilt, standing: false });
    ink[`seat${tilt}`] = placed(seat, CX - seat.ax, DESK + 2 - seat.ay);
  }
  const stand = tokkiSprite({ tilt: 1, standing: true });
  ink.stand = { canvas: spriteCanvas(stand), x: -stand.ax, y: DESK + 20 - stand.ay };
  const hung = maskSprite(true);
  ink.hung = placed(hung, CX + 12 - hung.ax, 49 - hung.ay);

  // ── 사건의 끝 장면: 불 꺼진 방송실, 책상 위에 가면만 놓여 있다 ──
  tone.maskpool = layer((c) => {
    // 책상에 떨어진 빛의 웅덩이와, 뒤쪽 벽에 번진 약한 빛
    glow(c, CX, 70, 62, 20, [
      [0, 0.66],
      [0.5, 0.3],
      [1, 0],
    ]);
    glow(c, CX, 34, 40, 30, [
      [0, 0.2],
      [1, 0],
    ]);
  });
  {
    const s = makeSprite(SW, SH);
    // 빈 의자의 등받이: 검은 덩어리에 흰 테
    rectDots(s, CX - 17, 18, 34, 40, -1);
    rectDots(s, CX - 15, 16, 30, 2, -1);
    lineDots(s, CX - 15, 16, CX + 14, 16, 1);
    lineDots(s, CX - 17, 18, CX - 17, 57, 1);
    lineDots(s, CX + 16, 18, CX + 16, 57, 1);
    putDot(s, CX - 16, 17, 1);
    putDot(s, CX + 15, 17, 1);
    rectDots(s, CX - 7, 22, 14, 6, -1);
    box(s, CX - 7, 22, 14, 6, 1);
    // 책상의 뒤쪽 끝
    rectDots(s, 0, 58, SW, 1, 1);
    rectDots(s, 0, 59, SW, 1, -1);
    // 가면이 책상에 드리운 그림자
    disc(s, CX + 3, 84, 25, 3, -1);
    ink.maskdesk = placed(s);
    const big = bigMaskSprite();
    ink.bigmask = placed(big, CX - big.ax, 85 - big.ay);
  }

  // ── 꺼진 화면의 잡음: 가로줄로 흩뿌린 점 ──
  const noise = [0, 1, 2].map((seed) => {
    const s = makeSprite(SW, SH);
    let n = 1 + seed * 7919;
    const rand = () => ((n = (n * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (let y = 0; y < SH; y++) {
      const dense = rand() < 0.08 ? 0.22 : 0.012;
      for (let x = 0; x < SW; x++) if (rand() < dense) putDot(s, x, y, 1);
    }
    return spriteCanvas(s);
  });

  return { tone, ink, noise };
}

/**
 * 그 시점의 한 장면.
 * time 은 그 시점에 머문 시간(초)이다: 사람의 작은 움직임, 링 라이트의 깜빡임, 꺼진 화면의 잡음이 이것으로 돈다.
 * still 이면 움직이지 않는 한 장면을 그린다(모션 줄이기).
 */
export function streamFrame(art: StreamArt, frame: StreamFrameId, time: number, still = false): StageFrame {
  const tone: ToneOp[] = [];
  const ink: InkOp[] = [];
  const add = (key: string, alpha: number, op: ToneOp["op"]) => tone.push({ canvas: art.tone[key], alpha, op });
  const put = (p: Placed, dx = 0, dy = 0) => ink.push({ canvas: p.canvas, x: p.x + dx, y: p.y + dy });

  if (frame === "t0700") {
    // 방송이 끝났다: 방은 보이지 않고 잡음만 흐른다
    add("off", 1, "over");
    ink.push({ canvas: art.noise[still ? 0 : Math.floor(time * 9) % art.noise.length], x: 0, y: 0 });
    return { tone, shadows: [], ink };
  }

  if (frame === "mask") {
    // 사건의 끝: 방의 불은 꺼졌고 책상 위에만 빛이 남았다. 빛이 아주 느리게 숨을 쉰다.
    const breath = still ? 1 : 0.9 + 0.1 * Math.sin(time * 0.9);
    add("off", 1, "over");
    add("maskpool", breath, "add");
    add("vignette", 1, "mul");
    put(art.ink.maskdesk);
    put(art.ink.bigmask);
    return { tone, shadows: [], ink };
  }

  // 링 라이트는 빈 방에서 이따금 꺼진다(06:40)
  const flick = frame === "t0640" && !still ? time % 5.2 : 0;
  const ringOn = flick > 3.9 && flick < 4.0 ? 0 : flick > 4.2 && flick < 4.4 ? 0 : 1;

  add("base", 1, "over");
  add("moon", 1, "add");
  add("ring", ringOn, "add");
  add("screen", 1, "add");
  add("onair", 1, "add");
  add("vignette", 1, "mul");

  put(art.ink.room);
  put(art.ink.chair);

  if (frame === "t0015") {
    // 앉아 있다: 몇 초에 한 번 고개를 기울인다
    const beat = still ? 0 : time % 6.4;
    const tilt = beat > 2.6 && beat < 3.5 ? 1 : beat > 5.1 && beat < 5.7 ? -1 : 0;
    put(art.ink[`seat${tilt}`]);
  } else if (frame === "t0310") {
    // 일어나 화면 밖으로 걸어 나간다: 잠깐 서 있다가 오른쪽으로 사라지고, 다시 처음부터
    const loop = still ? 1.5 : time % 4.6;
    const walk = Math.max(0, Math.min(1, (loop - 0.9) / 2.3));
    const x = CX + 14 + Math.round(walk * 96);
    const bob = !still && walk > 0 && walk < 1 ? Math.round(Math.abs(Math.sin(loop * 9)) * 1.4) : 0;
    if (walk < 1) put(art.ink.stand, x, -bob);
  } else {
    put(art.ink.hung);
  }

  put(art.ink.mic);
  put(art.ink.desk);
  return { tone, shadows: [], ink };
}
