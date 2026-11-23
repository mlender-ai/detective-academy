// 쿼터뷰 홈 · 학원 홀의 그림.
// 한 칸이 1m 쯤인 6×6 칸의 방을 뒤 모서리에서 비스듬히 내려다본다. 높은 벽은 위로 갈수록 어둠에 잠긴다.
// 왼쪽 벽: 시험 게시판 · 연습실 문. 오른쪽 벽: 비 오는 높은 창 둘 · 벽등 · 승급 시험실 문.
// 바닥: 창 아래의 기록 보관함과 긴 의자, 문 옆의 우산꽂이, 오른쪽 앞의 낡은 텔레비전(사건 접수함). 게시판 앞에 전등 하나가 매달려 있다.
// 그림은 전부 코드로 찍는다. 벽에 붙는 것은 평평하게 그린 뒤 면에 기울여 붙이고(stampFace), 빛은 자리마다 계산해 점묘가 되게 한다.
import { Iso, Layer, box, stampFace, type Footprint, type Piece } from "./iso";

export const W = 196;
export const H = 300;
/** 방의 크기(칸)와 벽의 높이(칸) */
export const NX = 6;
export const NY = 6;
export const WALL = 9;
export const ISO = new Iso(98, 186);

export type HallSpot = "board" | "practice" | "exam" | "archive" | "case";

/** 들어갈 곳은 아니지만 눌러서 살펴볼 수 있는 것 */
export type HallDecor = "window" | "bench" | "stand";

export interface DecorDef {
  stand: [number, number];
  look: [number, number];
  hit: [number, number, number, number];
}

/** 갈 수 있는 곳: 설 자리, 바라볼 곳, 누를 영역(점), 도착했을 때의 몸짓 */
export interface SpotDef {
  stand: [number, number];
  look: [number, number];
  /** 누를 영역과 표시 괄호를 두를 네모: x, y, w, h (점) */
  hit: [number, number, number, number];
  frame: [number, number, number, number];
  /** 이름표가 뜨는 자리(점): 물건의 위쪽 가운데 */
  tag: [number, number];
  arrive: "idle" | "interact" | "examine";
}

/* ───────── 빛 ───────── */

export interface Lamp {
  x: number;
  y: number;
  z: number;
  /** 바닥에 떨어지는 빛의 웅덩이: 가운데의 밝기와 반지름(칸) */
  floor: number;
  floorR: number;
  /** 벽에 번지는 빛무리: 밝기와 닿는 거리(칸) */
  wall: number;
  wallR: number;
}

/**
 * 빛 둘: 게시판 앞에 매달린 큰 등, 시험실 문 옆의 벽등(가끔 깜빡인다).
 * 벽등은 창과 문 사이의 벽에 붙는다: 매단 등을 오른쪽에 두면 화면에서 창과 겹쳐 창밖의 가로등처럼 읽혔다.
 */
export const LAMPS: Lamp[] = [
  { x: 2.1, y: 2.8, z: 5.4, floor: 1.1, floorR: 3.3, wall: 0.5, wallR: 4.6 },
  { x: 4.2, y: 0.9, z: 5.2, floor: 0.9, floorR: 2.3, wall: 0.5, wallR: 3.4 },
];
/** 벽등이 붙는 자리(오른쪽 벽의 x, 높이) */
const SCONCE = { x: 3.9, z: 3.9 };

const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/** 갓 아래로 퍼지는 빛. 바닥(z = 0)에는 둥근 웅덩이로, 벽에는 갓보다 낮은 곳을 가운데로 한 빛무리로 든다. */
export function lampLight(l: Lamp, x: number, y: number, z: number) {
  const r = Math.hypot(x - l.x, y - l.y);
  if (z <= 0) return l.floor * smooth(1 - r / l.floorR);
  // 갓 위로는 비추지 않는다
  const over = smooth((l.z - 0.2 - z) / 1.2);
  if (over <= 0) return 0;
  const d = Math.hypot(r, (z - (l.z - 2.4)) * 0.7);
  return l.wall * over * smooth(1 - d / l.wallR);
}

/** 오른쪽 벽의 높은 창 (x 범위, 높이 범위) */
const WINDOWS = [
  { x0: 0.75, x1: 2.0, z0: 2.0, z1: 5.75 },
  { x0: 2.5, x1: 3.75, z0: 2.0, z1: 5.75 },
];

/**
 * 번개가 칠 때 창으로 들어와 바닥에 눕는 빛: 창마다 평행사변형 하나.
 * 평소에는 그리지 않는다(전등의 웅덩이 · 바둑판과 겹쳐 얼룩으로 읽혔다). 번개 때만 얹어 그 순간이 또렷해진다.
 */
function windowLight(x: number, y: number) {
  // 빛은 창에서 방 안쪽(+y)으로, 아래로, 오른쪽(+x)으로 비스듬히 떨어진다
  const u = x - 0.82 * y;
  const z = 1.3 * y;
  for (const w of WINDOWS) if (u >= w.x0 && u <= w.x1 && z >= w.z0 && z <= w.z1) return 0.75;
  return 0;
}

const AMBIENT = 0.06;

/** 빛을 가리는 상자: 바닥 자리와 높이(칸) */
export interface Blocker extends Footprint {
  h: number;
}

/** 바닥의 (x, y)에서 전등을 올려다본 선이 상자에 막히는가 */
export function shaded(l: Lamp, x: number, y: number, blockers: Blocker[]) {
  for (const b of blockers) {
    // 선분 (x, y, 0) → (l.x, l.y, l.z) 와 상자의 겹침을 세 축의 구간으로 본다
    let t0 = 0;
    let t1 = 1;
    for (const [p, d, lo, hi] of [
      [x, l.x - x, b.x0, b.x1],
      [y, l.y - y, b.y0, b.y1],
      [0, l.z, 0, b.h],
    ] as const) {
      if (Math.abs(d) < 1e-6) {
        if (p < lo || p > hi) {
          t0 = 2;
          break;
        }
        continue;
      }
      const a = (lo - p) / d;
      const c = (hi - p) / d;
      t0 = Math.max(t0, Math.min(a, c));
      t1 = Math.min(t1, Math.max(a, c));
    }
    if (t0 < t1) return true;
  }
  return false;
}

/** 바닥의 한 자리에 드는 빛 (전등 0 · 전등 1 · 창을 따로 준다: 깜빡임과 문 불빛을 따로 얹으려고) */
function floorLight(x: number, y: number, blockers: Blocker[] = []) {
  const shade = (l: Lamp) => (blockers.length && shaded(l, x, y, blockers) ? 0.12 : 1);
  return [lampLight(LAMPS[0], x, y, 0) * shade(LAMPS[0]), lampLight(LAMPS[1], x, y, 0) * shade(LAMPS[1]), windowLight(x, y)];
}

/** 물건이 받는 빛(0~1): 그 자리 바닥의 빛에서 어림한다 */
export function litAt(x: number, y: number) {
  const [a, b] = floorLight(x, y);
  return Math.min(1, AMBIENT + a + b);
}

/* ───────── 평평하게 그리는 조각들 (벽과 물건의 앞면에 붙인다) ───────── */

export const GLYPH: Record<string, string[]> = {
  F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  C: [".####", "#....", "#....", "#....", "#....", "#....", ".####"],
  B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
};

/** 종이 한 장: 흰 바탕에 검은 글줄 */
export function paper(L: Layer, x: number, y: number, w: number, h: number, lines = true) {
  L.rectInk(x, y, w, h, 1);
  L.rectInk(x - 1, y - 1, w + 2, 1, -1);
  L.rectInk(x - 1, y + h, w + 2, 1, -1);
  L.rectInk(x - 1, y, 1, h, -1);
  L.rectInk(x + w, y, 1, h, -1);
  if (lines) for (let j = y + 2; j < y + h - 1; j += 2) L.rectInk(x + 1, j, Math.max(1, w - 2 - ((j * 7) % 3)), 1, -1);
}

/** 시험 게시판 (44×38점). solved 면 큰 시험지에 해결 도장(가위표)이 찍힌다. */
function boardFlat(solved: boolean) {
  const L = new Layer(44, 38);
  L.rect(0, 0, 44, 38, 0.36);
  L.frame(0, 0, 44, 38, 1);
  L.frame(1, 1, 42, 36, -1);
  // 오늘의 사건: 큰 시험지. 해결하면 시험지가 검게 뒤집히고 굵은 가위표가 찍힌다(멀리서도 달라 보이게).
  if (solved) {
    L.rectInk(4, 4, 16, 24, 1);
    L.rectInk(5, 5, 14, 22, -1);
    for (let k = 0; k < 12; k++) {
      const y = Math.round(7 + k * 1.55);
      for (const w of [0, 1, 2]) {
        L.dot(6 + k + w, y, 1);
        L.dot(18 - k - w, y, 1);
      }
    }
  } else {
    paper(L, 5, 5, 14, 22, false);
    L.rectInk(7, 7, 10, 2, -1);
    for (let j = 11; j < 25; j += 2) L.rectInk(7, j, j % 4 === 3 ? 10 : 7, 1, -1);
  }
  // 작은 쪽지들
  paper(L, 23, 5, 8, 9);
  paper(L, 34, 6, 6, 7);
  paper(L, 24, 18, 7, 12);
  paper(L, 34, 17, 6, 9);
  paper(L, 8, 30, 9, 4);
  // 압정
  for (const [px, py] of [[12, 5], [27, 5], [37, 6], [27, 18], [37, 17]] as const) L.dot(px, py, -1);
  return L;
}

/**
 * 문: 흰 틀 한 줄 안의 검은 문짝. leaves 가 2 면 가운데에서 갈린다. glassH 가 있으면 윗부분이 유리(밝기 glassTone)이고,
 * 없으면 판 하나의 테만 긋는다. 줄을 겹겹이 두르지 않는다: 이 크기에서는 빗금 잡음이 된다.
 */
export function doorFlat(w: number, h: number, leaves: 1 | 2, glassH: number, glassTone: number) {
  const L = new Layer(w, h);
  L.rect(0, 0, w, h, 0);
  L.frame(0, 0, w, h, 1);
  const leafW = (w - 2) / leaves;
  for (let n = 0; n < leaves; n++) {
    const x = 1 + Math.round(n * leafW);
    const lw = Math.round(leafW);
    if (n > 0) L.rectInk(x, 1, 1, h - 1, 1);
    if (glassH) {
      // 유리: 불이 켜지면 흰 면이 된다
      L.frame(x + 2, 4, lw - 4, glassH, 1);
      L.rect(x + 3, 5, lw - 6, glassH - 2, glassTone);
    } else {
      L.frame(x + 3, 5, lw - 6, h - 12, 1);
    }
    // 손잡이
    const hx = leaves === 2 ? (n === 0 ? x + lw - 3 : x + 2) : x + lw - 4;
    L.rectInk(hx, Math.round(h * 0.6), 2, 3, 1);
  }
  return L;
}

/** 연습실 문이 열린 모습: 문 안의 불빛이 보인다 */
export function doorOpenFlat(w: number, h: number) {
  const L = new Layer(w, h);
  L.rect(0, 0, w, h, 0);
  L.frame(0, 0, w, h, 1);
  // 안쪽: 환한 방
  L.rect(1, 1, w - 2, h - 1, 0.95);
  // 안쪽으로 젖혀진 문짝의 옆모습
  L.rectInk(1, 1, 3, h - 1, -1);
  L.rectInk(4, 1, 1, h - 1, 1);
  // 안의 책상 실루엣
  L.rectInk(Math.round(w * 0.45), h - 12, Math.round(w * 0.4), 2, -1);
  L.rectInk(Math.round(w * 0.5), h - 10, 1, 10, -1);
  L.rectInk(Math.round(w * 0.78), h - 10, 1, 10, -1);
  return L;
}

/** 문 위의 등급 표찰 (17×13점) */
export function plateFlat(rank: string) {
  const L = new Layer(17, 13);
  L.rectInk(0, 0, 17, 13, -1);
  L.rectInk(1, 1, 15, 11, 1);
  const g = GLYPH[rank] ?? GLYPH.S;
  g.forEach((row, y) => {
    for (let x = 0; x < 5; x++) if (row[x] === "#") L.dot(6 + x, 3 + y, -1);
  });
  return L;
}

/** 연습실 문 위의 열쇠 표찰 (15×9점) */
function keyPlateFlat() {
  const L = new Layer(15, 9);
  L.rectInk(0, 0, 15, 9, -1);
  L.frame(0, 0, 15, 9, 1);
  L.frame(2, 2, 5, 5, 1);
  L.rectInk(7, 4, 6, 1, 1);
  L.rectInk(10, 5, 1, 2, 1);
  L.rectInk(12, 5, 1, 2, 1);
  return L;
}

/** 높은 창 (20×60점): 둥근 머리, 창살. 유리는 비워 둔다(밤빛과 비가 그 자리에 그려진다). */
const WIN_W = 20;
const WIN_H = 60;
function windowInside(i: number, j: number) {
  // 머리는 반원, 아래는 네모
  const r = WIN_W / 2;
  if (j >= r) return i >= 0 && i < WIN_W && j < WIN_H;
  const dx = i + 0.5 - r;
  const dy = r - j - 0.5;
  return dx * dx + dy * dy <= r * r;
}
function windowFlat() {
  const L = new Layer(WIN_W, WIN_H + 3);
  for (let j = 0; j < WIN_H; j++)
    for (let i = 0; i < WIN_W; i++) {
      if (!windowInside(i, j)) continue;
      const edge = !windowInside(i - 1, j) || !windowInside(i + 1, j) || !windowInside(i, j - 1) || j === WIN_H - 1;
      if (edge) L.dot(i, j, 1);
      else L.put(i, j, 0); // 유리: 빛은 따로 얹는다
    }
  // 창살: 세로 하나, 가로 둘
  for (let j = 2; j < WIN_H; j++) L.dot(WIN_W / 2, j, 1);
  for (const j of [20, 40]) for (let i = 1; i < WIN_W - 1; i++) L.dot(i, j, 1);
  // 창턱: 흰 두 줄
  L.rectInk(0, WIN_H, WIN_W, 2, 1);
  return L;
}

/** 보관함의 앞면: 점묘 면에 서랍 셋. 서랍은 검은 금 한 줄로 가르고 흰 손잡이만 둔다. */
export function cabinetFlat(w: number, h: number, tone: number) {
  const L = new Layer(w, h);
  L.rect(0, 0, w, h, tone);
  const dh = Math.floor(h / 3);
  for (let r = 0; r < 3; r++) {
    if (r > 0) L.rectInk(1, r * dh, w - 2, 1, -1);
    L.rectInk(Math.floor(w / 2) - 3, r * dh + Math.floor(dh / 2), 6, 2, 1);
  }
  return L;
}

/** 연습실 문과 시험실 문의 크기(점). 시험실 문은 유리가 크다: 불이 켜졌을 때 멀리서도 보여야 한다. */
const DOOR = { w: 20, h: 54 };
const EXAM = { w: 24, h: 58, glass: 26 };

/** 시험실 문 옆의 벽등 (9×11점): 받침, 갓, 켜졌을 때의 전구 */
function sconceFlat(on: boolean) {
  const L = new Layer(9, 11);
  L.rectInk(3, 0, 3, 2, 1);
  L.rectInk(4, 2, 1, 2, 1);
  for (let j = 0; j < 4; j++) {
    const half = 1 + j;
    for (let i = -half; i <= half; i++) L.dot(4 + i, 4 + j, Math.abs(i) === half || j === 0 ? 1 : -1);
  }
  L.rectInk(0, 8, 9, 1, 1);
  if (on) L.rectInk(2, 9, 5, 2, 1);
  else L.rectInk(4, 9, 1, 1, 1);
  return L;
}

/* ───────── 방의 바탕: 바닥과 벽, 벽에 붙은 것들 ───────── */

interface BaseArt {
  /** 바닥과 벽(모든 전등이 켜진 상태) */
  base: Layer;
  /** 창으로 든 빛이 바닥에 보태는 밝기: 번개가 칠 때 한 번 더 얹는다 */
  moon: Float32Array;
  /** 텔레비전의 그림자가 덜어 내는 밝기 */
  tvShade: Float32Array;
  /** 문 앞 전등(전등 1)이 보태는 밝기: 깜빡일 때 뺀다 */
  lamp1: Float32Array;
  /** 창의 유리 자리(1 이면 유리): 비를 이 안에만 그린다 */
  glass: Uint8Array;
}

/** 벽의 화소가 방의 어디인가 */
function wallPoint(sx: number, sy: number): { side: "L" | "R"; u: number; z: number; zd: number } | null {
  const { ox, oy } = ISO;
  if (sx < ox) {
    const k = ox - sx;
    const u = (k - 0.5) / 16;
    if (u >= NY) return null;
    const zd = oy + Math.floor(k / 2) - 1 - sy;
    if (zd < 0 || zd >= WALL * 16) return null;
    return { side: "L", u, z: (zd + 0.5) / 16, zd };
  }
  const k = sx - ox;
  const u = (k + 0.5) / 16;
  if (u >= NX) return null;
  const zd = oy + Math.ceil(k / 2) - 1 - sy;
  if (zd < 0 || zd >= WALL * 16) return null;
  return { side: "R", u, z: (zd + 0.5) / 16, zd };
}

const hash = (a: number, b: number) => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

function paintBase(): BaseArt {
  const albedo = new Layer(W, H);
  const lamp1 = new Float32Array(W * H);
  const moon = new Float32Array(W * H);
  const tvShade = new Float32Array(W * H);
  const light = new Float32Array(W * H);
  const glow = new Float32Array(W * H);
  const kind = new Uint8Array(W * H); // 1 바닥 · 2 벽

  // 1) 재질: 바닥의 바둑판, 벽의 돌
  for (let sy = 0; sy < H; sy++)
    for (let sx = 0; sx < W; sx++) {
      const i = sy * W + sx;
      const [fx, fy] = ISO.floor(sx + 0.5, sy + 0.5);
      if (fx >= 0 && fy >= 0 && fx < NX && fy < NY) {
        kind[i] = 1;
        const dark = (Math.floor(fx) + Math.floor(fy)) % 2 === 1;
        const a = dark ? 0.5 : 1;
        albedo.put(sx, sy, a);
        const [l0, l1, l2] = floorLight(fx, fy, SHADOWS);
        light[i] = AMBIENT + l0;
        lamp1[i] = l1;
        moon[i] = l2 * a;
        // 텔레비전이 놓였을 때 그 그림자가 덜어 내는 빛
        const [t0, t1] = floorLight(fx, fy, [...SHADOWS, TV_BLOCK]);
        tvShade[i] = (l0 - t0 + (l1 - t1)) * a;
        continue;
      }
      const wp = wallPoint(sx, sy);
      if (!wp) continue;
      kind[i] = 2;
      const { side, u, z } = wp;
      // 벽은 고른 면이다. 빛이 닿는 곳만 점묘로 드러나고 나머지는 어둠이다.
      albedo.put(sx, sy, 1);
      const x = side === "L" ? 0 : u;
      const y = side === "L" ? u : 0;
      light[i] = lampLight(LAMPS[0], x, y, z);
      lamp1[i] = lampLight(LAMPS[1], x, y, z);
    }

  // 2) 벽에 붙은 것 (재질로 붙인다: 빛을 받는다)
  // 왼쪽 벽(x = 0): 보는 쪽에서 왼쪽이 y 가 큰 쪽
  stampFace(albedo, ISO, boardFlat(false), "y", 0, 4.0, 1.5);
  stampFace(albedo, ISO, doorFlat(DOOR.w, DOOR.h, 1, 0, 0), "y", 0, 5.75, 0);
  stampFace(albedo, ISO, keyPlateFlat(), "y", 0, 5.625, DOOR.h / 16 + 0.2);
  // 오른쪽 벽(y = 0)
  const win = windowFlat();
  const glass = new Uint8Array(W * H);
  for (const w of WINDOWS) {
    const before = albedo.mask.slice();
    const prevTone = albedo.tone.slice();
    stampFace(albedo, ISO, win, "x", 0, w.x0, w.z0 - 2 / 16);
    // 유리 자리: 방금 붙인 것 가운데 밝기 0 · 먹 없음인 자리
    for (let i = 0; i < W * H; i++) if (albedo.mask[i] && albedo.ink[i] === 0 && albedo.tone[i] === 0 && (prevTone[i] !== 0 || !before[i])) glass[i] = 1;
  }
  stampFace(albedo, ISO, doorFlat(EXAM.w, EXAM.h, 2, EXAM.glass, 0.07), "x", 0, 4.25, 0);

  // 3) 빛을 입힌다
  const base = new Layer(W, H);
  for (let i = 0; i < W * H; i++) {
    if (!kind[i]) continue;
    base.mask[i] = 1;
    base.ink[i] = albedo.ink[i];
    base.tone[i] = albedo.tone[i] * (light[i] + lamp1[i]) + glow[i];
    lamp1[i] *= albedo.tone[i];
  }
  // 유리: 밖의 흐린 밤빛(위가 조금 밝다)
  for (let sy = 0; sy < H; sy++)
    for (let sx = 0; sx < W; sx++) {
      const i = sy * W + sx;
      if (!glass[i]) continue;
      // 유리에는 옅은 밤빛이 깔린다: 벽의 어둠과 갈려 창으로 읽힌다
      base.tone[i] = 0.07;
      lamp1[i] = 0;
    }

  // 4) 뼈대가 되는 흰 선: 벽과 바닥이 만나는 줄, 허리 판벽의 줄, 뒤 모서리, 벽의 잘린 끝
  const { ox, oy } = ISO;
  for (let sx = 0; sx < W; sx++) {
    const left = sx < ox;
    const k = left ? ox - sx : sx - ox;
    if ((left ? (k - 0.5) / 16 : (k + 0.5) / 16) >= (left ? NY : NX)) continue;
    const baseY = oy + (left ? Math.floor(k / 2) : Math.ceil(k / 2)) - 1;
    const put = (zd: number, v: 1 | -1) => {
      const y = baseY - zd;
      if (y < 0 || y >= H) return;
      const i = y * W + sx;
      // 문과 게시판 위로는 긋지 않는다
      if (albedo.ink[i] !== 0) return;
      base.ink[i] = v;
    };
    put(0, 1);
  }
  // 뒤 모서리의 세로줄: 위로 갈수록 성기다
  for (let zd = 1; zd < WALL * 16; zd++) {
    const y = oy - 1 - zd;
    if (y < 0) break;
    if (zd < 64 || (zd < 88 && zd % 2 === 0) || (zd < 104 && zd % 4 === 0)) base.ink[y * W + ox] = 1;
  }
  // 벽의 잘린 끝(왼쪽 끝 · 오른쪽 끝)
  for (const [sx, baseY] of [
    [ox - NY * 16, oy + NY * 8 - 1],
    [ox + NX * 16 - 1, oy + NX * 8 - 1],
  ] as const) {
    for (let zd = 0; zd < WALL * 16; zd++) {
      const y = baseY - zd;
      if (y < 0) break;
      if (zd < 40 || (zd < 56 && zd % 2 === 0) || (zd < 68 && zd % 4 === 0)) {
        base.ink[y * W + sx] = 1;
        base.mask[y * W + sx] = 1;
      }
    }
  }

  // 5) 바닥 판의 앞 두 변과 두께
  const A = ISO.p(0, NY, 0);
  const B = ISO.p(NX, NY, 0);
  const C = ISO.p(NX, 0, 0);
  base.poly([A, B, [B[0], B[1] + 6], [A[0], A[1] + 6]], 0.2);
  base.poly([B, C, [C[0], C[1] + 6], [B[0], B[1] + 6]], 0.07);
  base.line(A[0], A[1], B[0] - 1, B[1], 1);
  base.line(B[0], B[1], C[0] - 1, C[1], 1);
  base.line(A[0], A[1] + 6, B[0] - 1, B[1] + 6, 1, 1);
  base.line(B[0], B[1] + 6, C[0] - 1, C[1] + 6, 1, 1);
  base.line(A[0], A[1], A[0], A[1] + 6, 1);
  base.line(B[0] - 1, B[1], B[0] - 1, B[1] + 6, 1);
  base.line(C[0] - 1, C[1], C[0] - 1, C[1] + 6, 1);

  return { base, lamp1, glass, moon, tvShade };
}

/* ───────── 바닥에 놓인 것 ───────── */

export interface Prop {
  id: string;
  foot: Footprint;
  piece: Piece;
  /** 길을 막는가 */
  solid: boolean;
}

function prop(id: string, foot: Footprint, solid: boolean, draw: (L: Layer) => void): Prop {
  const L = new Layer(W, H);
  draw(L);
  return { id, foot, piece: L.crop(), solid };
}

const CABINET: Footprint = { x0: 0.5, y0: 0.125, x1: 2.0, y1: 0.75 };
const TV: Footprint = { x0: 4.75, y0: 2.75, x1: 5.75, y1: 3.375 };
/** 창 아래의 긴 의자와 문 옆의 우산꽂이(비 오는 밤이다) */
const BENCH: Footprint = { x0: 2.5, y0: 0.125, x1: 3.75, y1: 0.625 };
const STAND: Footprint = { x0: 0.125, y0: 3.875, x1: 0.625, y1: 4.375 };
const SHADOWS: Blocker[] = [
  { ...CABINET, h: 1.5 },
  { ...BENCH, h: 0.6 },
  { ...STAND, h: 0.9 },
];
const TV_BLOCK: Blocker = { ...TV, h: 1.75 };

function paintCabinet(L: Layer) {
  const f = CABINET;
  // 윗면은 밝고, 서랍이 달린 앞면은 점묘, 오른쪽 면은 검다: 세 면의 밝기가 달라야 덩어리로 읽힌다
  box(L, ISO, f.x0, f.y0, 0, f.x1, f.y1, 1.5, { top: 0.8, left: 0.25, right: 0 });
  stampFace(L, ISO, cabinetFlat(24, 24, 0.25), "x", f.y1, f.x0, 0);
  // 앞면의 테를 다시 긋는다(붙인 면이 덮은 자리)
  const a = ISO.p(f.x0, f.y1, 1.5);
  const b = ISO.p(f.x1, f.y1, 1.5);
  const a0 = ISO.p(f.x0, f.y1, 0);
  const b0 = ISO.p(f.x1, f.y1, 0);
  L.outline([a, b, b0, a0], 1);
  // 위에 놓인 서류 한 장
  const p = ISO.p(1.0, 0.3, 1.5);
  L.polyInk([p, [p[0] + 8, p[1] + 4], [p[0] + 2, p[1] + 7], [p[0] - 6, p[1] + 3]], -1);
  L.line(p[0] - 3, p[1] + 3, p[0] + 4, p[1] + 5, 1);
}

function paintBench(L: Layer) {
  const f = BENCH;
  // 다리 둘은 검은 덩어리, 앉는 판은 흰 면
  box(L, ISO, f.x0 + 0.06, f.y0 + 0.06, 0, f.x0 + 0.26, f.y1 - 0.06, 0.5, { top: 0, left: 0, right: 0 });
  box(L, ISO, f.x1 - 0.26, f.y0 + 0.06, 0, f.x1 - 0.06, f.y1 - 0.06, 0.5, { top: 0, left: 0, right: 0 });
  box(L, ISO, f.x0, f.y0, 0.5, f.x1, f.y1, 0.66, { top: 1, left: 0.25, right: 0 });
}

function paintStand(L: Layer) {
  const f = STAND;
  box(L, ISO, f.x0, f.y0, 0, f.x1, f.y1, 0.8, { top: 0, left: 0.25, right: 0 });
  // 꽂힌 우산 둘: 접힌 천은 두 점 굵기의 흰 덩어리, 손잡이는 굽었다
  const [cx, cy] = ISO.p((f.x0 + f.x1) / 2, (f.y0 + f.y1) / 2, 0.8);
  const x = Math.round(cx);
  const y = Math.round(cy);
  for (let k = 0; k < 12; k++) {
    L.dot(x - 2 - Math.round(k * 0.25), y - k, 1);
    L.dot(x - 1 - Math.round(k * 0.25), y - k, 1);
  }
  L.dot(x - 5, y - 13, 1);
  L.dot(x - 6, y - 14, 1);
  L.dot(x - 7, y - 14, 1);
  L.dot(x - 8, y - 13, 1);
  for (let k = 0; k < 9; k++) {
    L.dot(x + 2 + Math.round(k * 0.3), y - k, 1);
    L.dot(x + 3 + Math.round(k * 0.3), y - k, 1);
  }
  L.dot(x + 5, y - 10, 1);
  L.dot(x + 6, y - 11, 1);
  L.dot(x + 7, y - 11, 1);
  L.dot(x + 8, y - 10, 1);
}

/** 텔레비전의 화면이 놓이는 자리 (앞면에 붙는 평평한 그림의 크기와 위치) */
export const TV_SCREEN = { w: 12, h: 9 };

function paintTv(L: Layer, screen: Layer) {
  const f = TV;
  const lit = litAt(4.6, 3.6);
  // 받침대
  box(L, ISO, f.x0 + 0.1, f.y0 + 0.08, 0, f.x1 - 0.1, f.y1 - 0.08, 0.7, { top: 0, left: 0, right: 0 });
  // 몸통
  box(L, ISO, f.x0, f.y0, 0.7, f.x1, f.y1, 1.75, { top: 0.3 + lit * 0.4, left: 0, right: 0 });
  // 앞면: 화면과 다이얼
  const face = new Layer(16, 17);
  face.rect(0, 0, 16, 17, 0);
  face.rectInk(1, 2, TV_SCREEN.w + 2, TV_SCREEN.h + 2, 1);
  face.blit(screen, 2, 3);
  face.dot(14, 4, 1);
  face.dot(14, 7, 1);
  face.rectInk(13, 11, 2, 1, 1);
  face.rectInk(13, 13, 2, 1, 1);
  stampFace(L, ISO, face, "x", f.y1, f.x0, 0.7);
  // 안테나
  const t = ISO.p(5.3, 3.0, 1.75);
  L.line(t[0], t[1], t[0] - 5, t[1] - 9, 1);
  L.line(t[0], t[1], t[0] + 6, t[1] - 8, 1);
}

/** 화면 그림: 잡음 두 장, 토끼 가면이 스치는 한 장, 꺼진 화면 */
function tvScreen(kind: "noise0" | "noise1" | "mask" | "off") {
  const L = new Layer(TV_SCREEN.w, TV_SCREEN.h);
  L.rectInk(0, 0, TV_SCREEN.w, TV_SCREEN.h, -1);
  if (kind === "off") {
    L.dot(TV_SCREEN.w / 2, TV_SCREEN.h / 2, 1);
    return L;
  }
  const seed = kind === "noise1" ? 9 : 3;
  for (let y = 0; y < TV_SCREEN.h; y++) for (let x = 0; x < TV_SCREEN.w; x++) if (hash(x + seed * 13, y * 7 + seed) > (kind === "mask" ? 0.82 : 0.52)) L.dot(x, y, 1);
  if (kind === "mask") {
    // 긴 귀 둘과 얼굴
    L.rectInk(3, 0, 2, 4, 1);
    L.rectInk(7, 0, 2, 4, 1);
    L.rectInk(2, 3, 8, 5, 1);
    L.dot(4, 5, -1);
    L.dot(7, 5, -1);
    L.rectInk(5, 7, 2, 1, -1);
  }
  return L;
}

/** 매달린 전등: 사슬과 갓, 갓 아래의 전구 */
function paintLamp(L: Layer, lamp: Lamp, on: boolean) {
  const [x, y] = ISO.p(lamp.x, lamp.y, lamp.z);
  for (let j = 8; j < 46; j++) if (j < 22 || (j < 34 ? j % 2 === 0 : j % 4 === 0)) L.dot(x, y - j, 1);
  // 갓: 위가 좁은 사다리꼴
  for (let j = 0; j < 7; j++) {
    const half = 3 + j;
    for (let i = -half; i <= half; i++) L.dot(x + i, y - 7 + j, Math.abs(i) === half || j === 0 ? 1 : -1);
  }
  for (let i = -10; i <= 10; i++) L.dot(x + i, y, 1);
  if (on) {
    L.rectInk(x - 3, y + 1, 7, 2, 1);
    L.rectInk(x - 2, y + 3, 5, 1, 1);
  } else {
    L.rectInk(x - 1, y + 1, 3, 1, 1);
  }
}

/* ───────── 한데 모은 것 ───────── */

/** 밝기를 보태거나 덜 자리만 모아 둔 것(매 장면 화면 전체를 훑지 않으려고) */
export interface Patch {
  at: Int32Array;
  by: Float32Array;
}

export function patch(values: Float32Array): Patch {
  const at: number[] = [];
  for (let i = 0; i < values.length; i++) if (values[i]) at.push(i);
  return { at: Int32Array.from(at), by: Float32Array.from(at, (i) => values[i]) };
}

export interface HallArt {
  base: Layer;
  /** 문 앞 전등이 보태는 밝기(깜빡일 때 뺀다) · 창빛(번개 때 더 얹는다) · 텔레비전의 그림자(놓였을 때 뺀다) */
  lamp1: Patch;
  glass: Uint8Array;
  moon: Patch;
  tvShade: Patch;
  props: Prop[];
  /** 텔레비전의 네 모습 */
  tv: Record<"noise0" | "noise1" | "mask" | "off", Prop>;
  /** 게시판 앞에 매달린 등 */
  lamp: Prop;
  /** 시험실 문 옆의 벽등: 켜진 것과 꺼진 것(깜빡일 때) */
  sconceOn: Piece;
  sconceOff: Piece;
  /** 상태에 따라 벽 위에 덧그리는 것 */
  boardSolved: Piece;
  practiceOpen: Piece;
  examLit: Piece;
  plate(rank: string): Piece;
  /** 문 앞 바닥에 번지는 불빛 */
  practicePool: Patch;
  examPool: Patch;
  spots: Record<HallSpot, SpotDef>;
  decor: Record<HallDecor, DecorDef>;
  /** 길을 막는 자리 */
  blocks: Footprint[];
}

function piece(draw: (L: Layer) => void): Piece {
  const L = new Layer(W, H);
  draw(L);
  return L.crop();
}

/** 문 앞 바닥에 번지는 빛(반달 모양) */
function pool(cx: number, cy: number, rx: number, ry: number, power: number) {
  const out = new Float32Array(W * H);
  for (let sy = 0; sy < H; sy++)
    for (let sx = 0; sx < W; sx++) {
      const [fx, fy] = ISO.floor(sx + 0.5, sy + 0.5);
      if (fx < 0 || fy < 0 || fx >= NX || fy >= NY) continue;
      const d = Math.hypot((fx - cx) / rx, (fy - cy) / ry);
      if (d < 1) out[sy * W + sx] = power * (1 - d) * (1 - d);
    }
  return out;
}

/** 물건의 화면 네모에서 누를 영역을 만든다(손가락에 맞춰 넉넉하게, 적어도 24점 = 48px) */
export function hitOf(p: { x: number; y: number; w: number; h: number }, pad = 3): [number, number, number, number] {
  const w = Math.max(24, p.w + pad * 2);
  const h = Math.max(24, p.h + pad * 2);
  return [Math.round(p.x + p.w / 2 - w / 2), Math.round(p.y + p.h / 2 - h / 2), w, h];
}

let cached: HallArt | null = null;

/** 방의 그림. 한 번 그려 두고 다시 쓴다(홈에 돌아올 때마다 다시 그리지 않는다). */
export function paintHall(): HallArt {
  return (cached ??= buildHall());
}

function buildHall(): HallArt {
  const { base, lamp1, glass, moon, tvShade } = paintBase();

  const tvOf = (kind: "noise0" | "noise1" | "mask" | "off") => prop("tv", TV, true, (L) => paintTv(L, tvScreen(kind)));
  const props: Prop[] = [prop("cabinet", CABINET, true, paintCabinet), prop("bench", BENCH, true, paintBench), prop("stand", STAND, true, paintStand)];
  // 매달린 등은 게시판 앞의 하나뿐이다(문 옆의 빛은 벽등이다)
  const hang = LAMPS[0];
  const hangFoot = { x0: hang.x - 0.1, y0: hang.y - 0.1, x1: hang.x + 0.1, y1: hang.y + 0.1 };
  const lamp = prop("lamp", hangFoot, false, (L) => paintLamp(L, hang, true));
  const sconce = (on: boolean) => piece((L) => stampFace(L, ISO, sconceFlat(on), "x", 0, SCONCE.x, SCONCE.z));

  const boardSolved = piece((L) => stampFace(L, ISO, boardFlat(true), "y", 0, 4.0, 1.5));
  const practiceOpen = piece((L) => stampFace(L, ISO, doorOpenFlat(DOOR.w, DOOR.h), "y", 0, 5.75, 0));
  const examLit = piece((L) => stampFace(L, ISO, doorFlat(EXAM.w, EXAM.h, 2, EXAM.glass, 1), "x", 0, 4.25, 0));
  const plates = new Map<string, Piece>();

  // 화면에서의 자리(점)
  const rectOf = (pc: Piece) => ({ x: pc.x, y: pc.y, w: pc.layer.w, h: pc.layer.h });
  const boardRect = rectOf(piece((L) => stampFace(L, ISO, boardFlat(false), "y", 0, 4.0, 1.5)));
  const practiceRect = rectOf(practiceOpen);
  const examRect = rectOf(examLit);
  const cabinetRect = rectOf(props[0].piece);
  const tvRect = rectOf(tvOf("off").piece);
  const tagOf = (r: { x: number; y: number; w: number; h: number }): [number, number] => [Math.round(r.x + r.w / 2), r.y];
  const frameOf = (r: { x: number; y: number; w: number; h: number }, pad = 3): [number, number, number, number] => [r.x - pad, r.y - pad, r.w + pad * 2, r.h + pad * 2];

  const spots: Record<HallSpot, SpotDef> = {
    // 이름표의 자리는 손으로 잡는다: 게시판은 왼쪽 위 귀(낮은 화면에서 서술 띠에 가리지 않게), 양 끝의 문은 화면 안쪽으로 당긴다
    board: { stand: [0.95, 2.0], look: [0, 2.0], hit: hitOf(boardRect), frame: frameOf(boardRect), tag: [boardRect.x + 12, boardRect.y + 18], arrive: "interact" },
    practice: { stand: [0.95, 5.1], look: [0, 5.1], hit: hitOf(practiceRect, 2), frame: frameOf(practiceRect, 2), tag: [26, practiceRect.y], arrive: "idle" },
    // 시험실 문은 옆에 비켜 선다: 불 켜진 유리를 탐정이 가리지 않게
    exam: { stand: [4.0, 1.0], look: [4.7, 0], hit: hitOf({ ...examRect, y: examRect.y - 14, h: examRect.h + 14 }, 2), frame: frameOf(examRect, 2), tag: [174, examRect.y - 16], arrive: "idle" },
    archive: { stand: [1.3, 1.4], look: [1.25, 0.4], hit: hitOf(cabinetRect), frame: frameOf(cabinetRect), tag: tagOf(cabinetRect), arrive: "examine" },
    case: { stand: [4.4, 4.0], look: [5.25, 3.05], hit: hitOf(tvRect, 2), frame: frameOf(tvRect, 2), tag: tagOf(tvRect), arrive: "examine" },
  };

  const benchRect = rectOf(props[1].piece);
  const standRect = rectOf(props[2].piece);
  const [wx0, wy0] = ISO.p(WINDOWS[0].x0, 0, WINDOWS[0].z1);
  const [wx1, wy1] = ISO.p(WINDOWS[1].x1, 0, WINDOWS[1].z0);
  const decor: Record<HallDecor, DecorDef> = {
    window: { stand: [2.3, 1.5], look: [2.3, 0], hit: [wx0 - 2, wy0 - 2, wx1 - wx0 + 4, wy1 - wy0 + 4] },
    bench: { stand: [3.1, 1.1], look: [3.1, 0.3], hit: hitOf(benchRect, 2) },
    stand: { stand: [1.0, 4.2], look: [0.3, 4.2], hit: hitOf(standRect, 2) },
  };

  return {
    base,
    lamp1: patch(lamp1),
    glass,
    moon: patch(moon),
    tvShade: patch(tvShade),
    props,
    tv: { noise0: tvOf("noise0"), noise1: tvOf("noise1"), mask: tvOf("mask"), off: tvOf("off") },
    lamp,
    sconceOn: sconce(true),
    sconceOff: sconce(false),
    boardSolved,
    practiceOpen,
    examLit,
    plate(rank) {
      let p = plates.get(rank);
      if (!p) {
        p = piece((L) => stampFace(L, ISO, plateFlat(rank), "x", 0, 4.25 + (EXAM.w - 17) / 2 / 16, EXAM.h / 16 + 0.2));
        plates.set(rank, p);
      }
      return p;
    },
    practicePool: patch(pool(0.2, 5.1, 1.7, 1.0, 0.9)),
    examPool: patch(pool(5.0, 0.2, 1.1, 1.9, 0.95)),
    spots,
    decor,
    blocks: [CABINET, TV, BENCH, STAND],
  };
}
