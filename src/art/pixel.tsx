import { useMemo, type CSSProperties } from "react";
import type { RankId } from "../engine/types";
import { useBox } from "./useBox";

/**
 * 격자 그림 재료 (1비트 흑백 도트).
 * 스프라이트는 작은 격자에 점을 찍어 만들고(아래 그리기 도구), 화면에는 2배로 키워 또렷하게 그린다.
 * 화면에 찍히는 색은 흰색과 검정뿐이다. 아래 팔레트의 색 이름은 그림을 그릴 때 면을 구분하는 이름으로만 쓰이고,
 * 찍을 때 밝기 다섯 단계(TONE)로 옮겨 가운데 세 단계는 점묘로 찍는다(toMonoPaths).
 * 파일 이름과 팔레트의 색 값은 앞선 픽셀 아트 안(B안)에서 온 것이다.
 */

/** 그림 한 점의 화면 크기(CSS px). 배경 그림의 점 크기와 맞춘다. */
export const PX = 2;

export const PALETTE = {
  K: "#1c1722", // 윤곽선
  k: "#3b2f3a",
  W: "#fff8e7",
  P: "#f1e2b8", // 종이
  p: "#c9b383",
  R: "#8c2f39", // 와인
  r: "#5c1f2b",
  E: "#c8414b",
  B: "#d9ab4f", // 황동
  b: "#9a6f2c",
  y: "#f6dd92",
  S: "#8c9aa6", // 강철
  s: "#56636f",
  L: "#c9d6dc",
  O: "#7a5236", // 나무
  o: "#4a3228",
  e: "#dd9a93", // 지우개
  w: "#dcc091", // 깎은 나무
  n: "#eec39a", // 살빛
  N: "#cf9870",
  a: "#a4573a", // 적갈색 머리
  G: "#4f8a72", // 녹청 교복
  g: "#2f5e4d",
  U: "#5a6f96", // 청회색 교복
  u: "#3b4a6b",
  // 점묘: 흰 점이 25·50·75%
  "1": "#404040",
  "2": "#808080",
  "3": "#c0c0c0",
} as const;

type Ink = keyof typeof PALETTE;
type Cell = Ink | null;

interface Grid {
  w: number;
  h: number;
  px: Cell[];
}

/* ───────── 격자에 그리는 도구 ───────── */

function grid(w: number, h: number): Grid {
  return { w, h, px: new Array<Cell>(w * h).fill(null) };
}

function set(g: Grid, x: number, y: number, c: Cell) {
  x = Math.round(x);
  y = Math.round(y);
  if (x < 0 || y < 0 || x >= g.w || y >= g.h) return;
  g.px[y * g.w + x] = c;
}

function get(g: Grid, x: number, y: number): Cell {
  if (x < 0 || y < 0 || x >= g.w || y >= g.h) return null;
  return g.px[y * g.w + x];
}

function rect(g: Grid, x: number, y: number, w: number, h: number, c: Cell) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(g, x + i, y + j, c);
}

function frame(g: Grid, x: number, y: number, w: number, h: number, c: Cell) {
  rect(g, x, y, w, 1, c);
  rect(g, x, y + h - 1, w, 1, c);
  rect(g, x, y, 1, h, c);
  rect(g, x + w - 1, y, 1, h, c);
}

function line(g: Grid, x0: number, y0: number, x1: number, y1: number, c: Cell) {
  x0 = Math.round(x0);
  y0 = Math.round(y0);
  x1 = Math.round(x1);
  y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    set(g, x0, y0, c);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}

/** 채운 타원. 중심과 반지름은 .5 단위까지 쓸 수 있다. */
function oval(g: Grid, cx: number, cy: number, rx: number, ry: number, c: Cell) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) set(g, x, y, c);
    }
  }
}

/** 채운 다각형 (가로줄 단위로 채운다) */
function poly(g: Grid, points: [number, number][], c: Cell) {
  const ys = points.map((p) => p[1]);
  for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
    const xs: number[] = [];
    const sy = y + 0.5;
    for (let i = 0; i < points.length; i++) {
      const [x1, y1] = points[i];
      const [x2, y2] = points[(i + 1) % points.length];
      if (y1 <= sy === y2 <= sy) continue;
      xs.push(x1 + ((sy - y1) / (y2 - y1)) * (x2 - x1));
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      for (let x = Math.round(xs[i]); x < Math.round(xs[i + 1]); x++) set(g, x, y, c);
    }
  }
}

/** 채워진 모양의 바깥 한 줄을 윤곽선으로 두른다 */
function outline(g: Grid, c: Ink): Grid {
  const out = grid(g.w, g.h);
  out.px = g.px.slice();
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      if (get(g, x, y) !== null) continue;
      if (get(g, x - 1, y) || get(g, x + 1, y) || get(g, x, y - 1) || get(g, x, y + 1)) set(out, x, y, c);
    }
  }
  return out;
}

/* ───────── 스프라이트 ───────── */

function key(): Grid {
  const g = grid(40, 20);
  oval(g, 9, 10, 8, 8.5, "B");
  oval(g, 8, 8.5, 6, 6, "y");
  oval(g, 9.5, 10.5, 6.5, 7, "B");
  oval(g, 9, 10, 3.2, 3.6, null);
  rect(g, 16, 8, 21, 4, "B");
  rect(g, 16, 8, 21, 1, "y");
  rect(g, 16, 11, 21, 1, "b");
  rect(g, 27, 12, 3, 5, "B");
  rect(g, 32, 12, 4, 4, "B");
  rect(g, 27, 16, 3, 1, "b");
  rect(g, 32, 15, 4, 1, "b");
  rect(g, 2, 14, 3, 3, "b");
  rect(g, 5, 16, 6, 2, "b");
  return outline(g, "K");
}

function coins(count: number): Grid {
  const g = grid(30, 26);
  for (let i = 0; i < count; i++) {
    const cy = 19 - i * 5;
    const cx = 15 + (i === 1 ? 1 : i === 2 ? -1 : 0);
    oval(g, cx, cy + 3, 11, 4, "K");
    rect(g, cx - 11, cy, 22, 3, "K");
    oval(g, cx, cy + 3, 10, 3.2, "b");
    rect(g, cx - 10, cy, 20, 3, "b");
    oval(g, cx, cy, 11, 4, "K");
    oval(g, cx, cy, 10, 3.2, "B");
    oval(g, cx - 1, cy - 0.5, 7.5, 2, "y");
    rect(g, cx - 1, cy - 1, 2, 1, "b");
    rect(g, cx - 2, cy, 4, 1, "b");
  }
  return g;
}

function envelope(open: boolean): Grid {
  const top = open ? 12 : 0;
  const g = grid(46, 32 + top);
  if (open) {
    poly(
      g,
      [
        [1, top + 1],
        [45, top + 1],
        [23, 0],
      ],
      "p",
    );
    rect(g, 7, 4, 32, 20, "W");
    frame(g, 6, 3, 34, 22, "K");
    rect(g, 11, 8, 24, 1, "p");
    rect(g, 11, 12, 20, 1, "p");
  }
  rect(g, 1, top + 1, 44, 30, "P");
  // 접힌 아래쪽 면
  poly(
    g,
    [
      [1, top + 31],
      [45, top + 31],
      [45, top + 3],
      [29, top + 16],
      [17, top + 16],
      [1, top + 3],
    ],
    "p",
  );
  line(g, 1, top + 30, 17, top + 16, "k");
  line(g, 44, top + 30, 28, top + 16, "k");
  if (!open) {
    poly(
      g,
      [
        [1, top + 1],
        [45, top + 1],
        [23, top + 17],
      ],
      "P",
    );
    line(g, 1, top + 1, 22, top + 16, "K");
    line(g, 44, top + 1, 23, top + 16, "K");
    // 봉랍
    oval(g, 23, top + 16, 5.5, 5.5, "r");
    oval(g, 23, top + 16, 4.5, 4.5, "R");
    oval(g, 21.5, top + 14.5, 1.5, 1.5, "E");
    rect(g, 22, top + 15, 2, 2, "r");
    rect(g, 22, top + 17, 2, 1, "r");
  } else {
    line(g, 1, top + 1, 23, 0, "K");
    line(g, 44, top + 1, 23, 0, "K");
  }
  frame(g, 0, top, 46, 32, "K");
  return g;
}

function pin(): Grid {
  const g = grid(9, 12);
  oval(g, 4.5, 4.5, 4, 4, "R");
  oval(g, 3.5, 3.5, 1.5, 1.5, "E");
  set(g, 3, 3, "W");
  rect(g, 4, 9, 1, 3, "s");
  return outline(g, "K");
}

/** 자물쇠 고리. 다리가 길어서 몸통 뒤에 숨어 있다가, 풀리면 위로 올라온다. */
function shackle(): Grid {
  const g = grid(52, 40);
  const cx = 26;
  const cy = 24;
  for (let y = 0; y < cy; y++) {
    for (let x = 0; x < g.w; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d <= 23 && d >= 14) {
        const angle = Math.atan2(y + 0.5 - cy, x + 0.5 - cx);
        const shade: Ink = d > 20.5 ? "L" : d < 16.5 ? "s" : angle > -0.9 ? "s" : "S";
        set(g, x, y, shade);
      }
    }
  }
  rect(g, 3, cy, 9, 16, "S");
  rect(g, 3, cy, 3, 16, "L");
  rect(g, 9, cy, 3, 16, "s");
  rect(g, 40, cy, 9, 16, "S");
  rect(g, 40, cy, 3, 16, "s");
  rect(g, 46, cy, 3, 16, "s");
  return outline(g, "K");
}

function pencil(): Grid {
  const g = grid(54, 9);
  rect(g, 1, 2, 5, 5, "e");
  rect(g, 6, 1, 4, 7, "S");
  rect(g, 7, 1, 1, 7, "L");
  rect(g, 10, 1, 32, 7, "R");
  rect(g, 10, 2, 32, 1, "E");
  rect(g, 10, 6, 32, 1, "r");
  poly(
    g,
    [
      [42, 1],
      [42, 8],
      [51, 4.5],
    ],
    "w",
  );
  rect(g, 49, 4, 3, 1, "K");
  return outline(g, "K");
}

function chevron(up: boolean): Grid {
  const g = grid(13, 7);
  for (let i = 0; i < 6; i++) {
    const y = up ? i : 5 - i;
    rect(g, 6 - i, y, i * 2 + 1, 1, "K");
  }
  return g;
}

function arrowLeft(): Grid {
  const g = grid(11, 11);
  for (let i = 0; i < 6; i++) rect(g, i, 5 - i, 1, i * 2 + 1, "K");
  rect(g, 5, 4, 6, 3, "K");
  return g;
}

function sparkle(): Grid {
  const g = grid(7, 7);
  rect(g, 3, 0, 1, 7, "W");
  rect(g, 0, 3, 7, 1, "W");
  rect(g, 2, 2, 3, 3, "y");
  set(g, 3, 3, "W");
  return g;
}

/* ───────── 학생 초상: 머리 모양과 교복 색으로 구분한다 ───────── */

export type Hair = "bob" | "short" | "long" | "pony" | "curly" | "side" | "crop" | "braid" | "cap";
export type HairTone = "dark" | "brown" | "auburn" | "sand";
export type Tone = "green" | "brass" | "wine" | "steel" | "navy";

export interface PortraitSpec {
  hair: Hair;
  hairTone: HairTone;
  tone: Tone;
  glasses?: boolean;
}

/* ───────── 큰 시험 봉투: 뒷면·앞주머니·덮개를 따로 그려 겹친다 ───────── */

const ENV_W = 110;
const ENV_H = 76;
const ENV_FLAP = 44;

/** 두 색을 격자로 섞어 채운다 */
function dither(g: Grid, test: (x: number, y: number) => boolean, c: Ink) {
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if ((x + y) % 2 === 0 && test(x, y) && get(g, x, y) !== null) set(g, x, y, c);
}

/** 봉투 안쪽 (앞주머니 뒤로 보이는 면) */
function envBack(): Grid {
  const g = grid(ENV_W, ENV_H);
  rect(g, 1, 1, ENV_W - 2, ENV_H - 2, "p");
  dither(g, (_x, y) => y < 22, "k");
  frame(g, 0, 0, ENV_W, ENV_H, "K");
  return g;
}

/** 위로 젖혀진 덮개 */
function envLid(): Grid {
  const g = grid(ENV_W, ENV_FLAP);
  poly(
    g,
    [
      [0, ENV_FLAP],
      [ENV_W, ENV_FLAP],
      [ENV_W / 2, 0],
    ],
    "p",
  );
  dither(g, (_x, y) => y > ENV_FLAP - 16, "P");
  line(g, 0, ENV_FLAP - 1, ENV_W / 2 - 1, 0, "K");
  line(g, ENV_W - 1, ENV_FLAP - 1, ENV_W / 2, 0, "K");
  return g;
}

/** 앞주머니: 가운데가 V 로 파였다 */
function envFront(): Grid {
  const g = grid(ENV_W, ENV_H);
  const notch: [number, number][] = [
    [0, 0],
    [ENV_W / 2, 40],
    [ENV_W, 0],
    [ENV_W, ENV_H],
    [0, ENV_H],
  ];
  poly(g, notch, "P");
  // 옆 날개의 그늘
  dither(g, (x, y) => y > ENV_H - 4 - Math.min(x, ENV_W - 1 - x) * 0.72, "p");
  line(g, 0, ENV_H - 1, 46, 36, "k");
  line(g, ENV_W - 1, ENV_H - 1, ENV_W - 47, 36, "k");
  line(g, 0, 0, ENV_W / 2 - 1, 40, "K");
  line(g, ENV_W - 1, 0, ENV_W / 2, 40, "K");
  rect(g, 0, 0, 1, ENV_H, "K");
  rect(g, ENV_W - 1, 0, 1, ENV_H, "K");
  rect(g, 0, ENV_H - 1, ENV_W, 1, "K");
  rect(g, 1, ENV_H - 3, ENV_W - 2, 2, "p");
  return g;
}

/** 닫힌 덮개와 봉랍 */
function envFlap(): Grid {
  const g = grid(ENV_W, 60);
  poly(
    g,
    [
      [0, 0],
      [ENV_W, 0],
      [ENV_W / 2, 48],
    ],
    "P",
  );
  dither(g, (x, y) => y > Math.min(x, ENV_W - 1 - x) * 0.86 - 7, "p");
  rect(g, 0, 0, ENV_W, 1, "K");
  line(g, 0, 0, ENV_W / 2 - 1, 47, "K");
  line(g, ENV_W - 1, 0, ENV_W / 2, 47, "K");
  line(g, 1, 0, ENV_W / 2 - 1, 46, "W");
  // 봉랍
  oval(g, 55, 46, 11, 11, "K");
  oval(g, 55, 46, 10, 10, "r");
  oval(g, 54.5, 45.5, 8.6, 8.6, "R");
  oval(g, 51, 42, 2.4, 2.4, "E");
  set(g, 50, 41, "W");
  oval(g, 55, 44.5, 2.6, 2.6, "r");
  rect(g, 54, 46, 2, 4, "r");
  rect(g, 53, 50, 4, 1, "r");
  return g;
}

/** 방패 꼴 등급 휘장 (승급 증서용) */
/** 빈 가장자리를 잘라 낸다 */
function trim(g: Grid): Grid {
  let x0 = g.w;
  let y0 = g.h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      if (g.px[y * g.w + x] === null) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return g;
  const out = grid(x1 - x0 + 1, y1 - y0 + 1);
  for (let y = 0; y < out.h; y++) for (let x = 0; x < out.w; x++) out.px[y * out.w + x] = g.px[(y + y0) * g.w + x + x0];
  return out;
}

/* ───────── 화면에 그리기 ───────── */

function toPaths(g: Grid): { color: string; d: string }[] {
  const byColor = new Map<Ink, string>();
  for (let y = 0; y < g.h; y++) {
    let x = 0;
    while (x < g.w) {
      const c = g.px[y * g.w + x];
      if (c === null) {
        x++;
        continue;
      }
      let run = 1;
      while (x + run < g.w && g.px[y * g.w + x + run] === c) run++;
      byColor.set(c, (byColor.get(c) ?? "") + `M${x} ${y}h${run}v1h-${run}z`);
      x += run;
    }
  }
  return [...byColor.entries()].map(([c, d]) => ({ color: PALETTE[c], d }));
}

/* ───────── 찍기: 격자를 흰 점과 검은 점 두 가지로만 찍는다 ─────────
   팔레트의 색을 밝기 다섯 단계로 옮기고, 가운데 세 단계는 격자 점묘(25·50·75%)로 찍는다.
   어두운 바탕에서도 윤곽이 보이도록 그림 둘레에 흰 점을 한 줄 두른다(halo). */

export const MONO_INK = "#f1f1ea";

const TONE: Record<Ink, 0 | 1 | 2 | 3 | 4> = {
  K: 0,
  k: 1,
  W: 4,
  P: 4,
  p: 3,
  R: 1,
  r: 0,
  E: 2,
  B: 3,
  b: 2,
  y: 4,
  S: 2,
  s: 1,
  L: 3,
  O: 1,
  o: 0,
  e: 3,
  w: 3,
  n: 4,
  N: 3,
  a: 2,
  G: 2,
  g: 1,
  U: 3,
  u: 1,
  "1": 1,
  "2": 2,
  "3": 3,
};

type Tones = Partial<Record<Ink, 0 | 1 | 2 | 3 | 4>>;

/* 물건마다 색을 다르게 옮긴다: 황동은 흰 면과 점묘 그늘, 연필은 검은 몸통에 흰 줄 … */
const SPRITE_TONES: Partial<Record<SpriteName, Tones>> = {
  key: { B: 4, y: 4, b: 2 },
  coins: { B: 4, y: 4, b: 2 },
  shackle: { L: 4, S: 4, s: 2 },
  pencil: { e: 2, S: 4, L: 4, R: 0, E: 4, r: 0, w: 4 },
};

function monoLit(g: Grid, x: number, y: number, tones?: Tones): boolean | null {
  const c = get(g, x, y);
  if (c === null) return null;
  const t = tones?.[c] ?? TONE[c];
  if (t === 0) return false;
  if (t === 4) return true;
  if (t === 2) return (x + y) % 2 === 0;
  if (t === 1) return x % 2 === 0 && y % 2 === 0;
  return !(x % 2 === 1 && y % 2 === 1);
}

function toMonoPaths(g: Grid, halo: boolean, tones?: Tones): { color: string; d: string }[] {
  let white = "";
  let black = "";
  const at = (x: number, y: number): boolean | null => {
    const v = monoLit(g, x, y, tones);
    if (v !== null || !halo) return v;
    return get(g, x - 1, y) !== null || get(g, x + 1, y) !== null || get(g, x, y - 1) !== null || get(g, x, y + 1) !== null ? true : null;
  };
  for (let y = -1; y <= g.h; y++) {
    let x = -1;
    while (x <= g.w) {
      const v = at(x, y);
      if (v === null) {
        x++;
        continue;
      }
      let run = 1;
      while (x + run <= g.w && at(x + run, y) === v) run++;
      const d = `M${x} ${y}h${run}v1h-${run}z`;
      if (v) white += d;
      else black += d;
      x += run;
    }
  }
  return [
    { color: "#000000", d: black },
    { color: MONO_INK, d: white },
  ];
}

/* ───────── 흑백으로 바로 찍은 그림: 흰색·검정과 점묘("1"·"2"·"3")만 쓴다 ───────── */

/**
 * 학생 초상 (1비트). 빛이 한쪽에서만 들어 얼굴의 반은 희고 반은 검다.
 * 사람마다 빛의 방향·머리 모양·옷의 점묘가 달라 실루엣으로 구분된다.
 * 그늘 쪽 눈은 흰 점 하나, 그늘 쪽 안경은 흰 테로 남는다.
 */
function monoPortrait(spec: PortraitSpec): Grid {
  const g = grid(20, 22);
  const fromRight = spec.hair === "long" || spec.hair === "curly" || spec.hair === "crop" || spec.hair === "braid";
  const dark = (x: number) => (fromRight ? x <= 8 : x >= 11);
  const paint = (x: number, y: number, w: number, h: number, lit: Ink, shade: Ink) => {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(g, x + i, y + j, dark(x + i) ? shade : lit);
  };
  const HAIR: Record<HairTone, [Ink, Ink]> = { dark: ["K", "K"], brown: ["1", "K"], auburn: ["2", "K"], sand: ["3", "2"] };
  const CLOTH: Record<Tone, [Ink, Ink]> = { green: ["2", "1"], brass: ["3", "2"], wine: ["1", "K"], steel: ["W", "2"], navy: ["K", "K"] };
  const [h1, h2] = HAIR[spec.hairTone];
  const [c1, c2] = CLOTH[spec.tone];
  const hair = (x: number, y: number, w: number, h: number) => paint(x, y, w, h, h1, h2);
  /** 그 자리의 옷 위에서 보이는 색 */
  const onCloth = (x: number): Ink => {
    const c = dark(x) ? c2 : c1;
    return c === "K" || c === "1" ? "W" : "K";
  };

  if (spec.hair === "long") {
    hair(3, 6, 3, 13);
    hair(14, 6, 3, 13);
  }

  // 어깨와 교복
  paint(4, 16, 12, 1, c1, c2);
  paint(3, 17, 14, 5, c1, c2);
  // 깃 선과 넥타이
  for (let i = 0; i < 5; i++) {
    set(g, 7 - (i > 2 ? 1 : 0), 17 + i, onCloth(7));
    set(g, 12 + (i > 2 ? 1 : 0), 17 + i, onCloth(12));
  }
  rect(g, 8, 16, 4, 1, "W");
  rect(g, 9, 17, 2, 1, "W");
  rect(g, 9, 18, 2, 3, onCloth(9));
  // 목
  paint(8, 14, 4, 2, "W", "K");
  // 얼굴: 빛이 닿는 반쪽만 희다
  oval(g, 10, 9, 5, 5.5, "n");
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (get(g, x, y) === "n") set(g, x, y, dark(x) ? "K" : "W");
  const litEye = fromRight ? 12 : 7;
  const shadeEye = fromRight ? 7 : 12;
  if (!spec.glasses) {
    rect(g, litEye, 9, 1, 2, "K");
    set(g, shadeEye, 9, "W");
  }
  // 코: 그늘이 빛 쪽으로 한 점 넘어온다
  set(g, fromRight ? 9 : 10, 10, "K");
  set(g, fromRight ? 9 : 10, 11, "K");
  // 입
  rect(g, fromRight ? 10 : 8, 12, 2, 1, "K");

  switch (spec.hair) {
    case "short":
      hair(6, 2, 8, 1);
      hair(5, 3, 10, 2);
      hair(5, 5, 1, 2);
      hair(14, 5, 1, 2);
      hair(6, 5, 4, 1);
      break;
    case "bob":
      hair(6, 2, 8, 1);
      hair(4, 3, 12, 2);
      hair(4, 5, 2, 8);
      hair(14, 5, 2, 8);
      hair(6, 5, 8, 1);
      break;
    case "long":
      hair(6, 2, 8, 1);
      hair(4, 3, 12, 2);
      hair(4, 5, 2, 4);
      hair(14, 5, 2, 4);
      hair(6, 5, 3, 1);
      hair(11, 5, 3, 1);
      break;
    case "pony":
      hair(6, 2, 8, 1);
      hair(5, 3, 10, 2);
      hair(5, 5, 1, 2);
      hair(6, 5, 5, 1);
      hair(15, 3, 2, 2);
      hair(16, 5, 2, 6);
      hair(15, 11, 2, 2);
      set(g, 15, 5, "W");
      break;
    case "curly":
      for (let x = 5; x <= 14; x += 2) hair(x, 1, 1, 1);
      hair(4, 2, 12, 3);
      hair(3, 3, 1, 3);
      hair(16, 3, 1, 3);
      hair(4, 5, 2, 2);
      hair(14, 5, 2, 2);
      hair(7, 5, 1, 1);
      hair(10, 5, 1, 1);
      hair(12, 5, 1, 1);
      break;
    case "side":
      hair(6, 2, 8, 1);
      hair(5, 3, 10, 2);
      hair(5, 5, 6, 1);
      hair(5, 6, 3, 1);
      hair(14, 5, 1, 2);
      break;
    case "crop":
      hair(6, 2, 8, 1);
      hair(5, 3, 10, 1);
      hair(5, 4, 1, 1);
      hair(14, 4, 1, 1);
      break;
    case "braid":
      hair(6, 2, 8, 1);
      hair(5, 3, 10, 2);
      hair(6, 5, 3, 1);
      hair(11, 5, 3, 1);
      for (let y = 5; y <= 16; y++) {
        const k = y % 2;
        hair(3 + k, y, 2, 1);
        hair(15 - k, y, 2, 1);
      }
      set(g, 4, 17, "W");
      set(g, 15, 17, "W");
      break;
    case "cap":
      hair(5, 5, 1, 2);
      hair(14, 5, 1, 2);
      rect(g, 6, 0, 8, 1, "K");
      rect(g, 5, 1, 10, 3, "K");
      rect(g, 5, 4, 10, 1, "W");
      rect(g, 3, 5, 14, 1, "K");
      rect(g, 9, 2, 2, 1, "W");
      break;
  }

  if (spec.glasses) {
    for (const fx of [6, 11]) {
      for (let j = 0; j < 4; j++)
        for (let i = 0; i < 3; i++) {
          const edge = i === 0 || i === 2 || j === 0 || j === 3;
          const x = fx + i;
          if (edge) set(g, x, 8 + j, dark(x) ? "W" : "K");
          else set(g, x, 8 + j, dark(x) ? "K" : j === 2 ? "K" : "W");
        }
    }
    set(g, 9, 9, dark(9) ? "W" : "K");
    set(g, 10, 9, dark(10) ? "W" : "K");
  }

  return outline(g, "K");
}

/** 학원 엠블럼 (1비트): 검은 방패 안의 흰 돋보기와 열쇠 구멍 */
function monoCrest(): Grid {
  const g = grid(24, 26);
  const half = [9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 8, 8, 7, 7, 6, 5, 4, 3, 2, 1];
  half.forEach((hw, row) => rect(g, 12 - hw, row + 1, hw * 2, 1, "K"));
  // 돋보기: 흰 테, 검은 알, 흰 열쇠 구멍
  oval(g, 10.5, 9.5, 5.5, 5.5, "W");
  oval(g, 10.5, 9.5, 4.2, 4.2, "K");
  rect(g, 10, 8, 2, 2, "W");
  rect(g, 10, 10, 2, 1, "W");
  rect(g, 9, 11, 4, 1, "W");
  for (let i = 0; i < 5; i++) rect(g, 14 + i, 13 + i, 2, 2, "W");
  return outline(g, "K");
}

/** 탐정 신분증 (1비트): 검은 머리띠, 검은 사진칸 속의 흰 사람, 검은 글줄 */
function monoId(): Grid {
  const g = grid(42, 30);
  rect(g, 1, 1, 40, 28, "W");
  rect(g, 1, 1, 40, 6, "K");
  rect(g, 4, 3, 3, 2, "W");
  rect(g, 9, 3, 12, 1, "W");
  rect(g, 1, 27, 40, 2, "2");
  // 사진
  rect(g, 4, 9, 14, 17, "K");
  oval(g, 11, 15, 2.8, 3, "W");
  rect(g, 7, 19, 8, 6, "W");
  rect(g, 6, 21, 10, 4, "W");
  // 글줄
  rect(g, 21, 11, 16, 2, "K");
  rect(g, 21, 16, 12, 1, "K");
  rect(g, 21, 19, 14, 1, "K");
  rect(g, 21, 22, 8, 1, "K");
  // 등급 표시
  oval(g, 34.5, 22.5, 3.6, 3.6, "K");
  oval(g, 34.5, 22.5, 2.4, 2.4, "W");
  rect(g, 34, 22, 1, 1, "K");
  return outline(g, "K");
}

/** 앞에서 본 주화 한 닢 (1비트): 흰 원판에 검은 홈 */
function monoCoin(): Grid {
  const g = grid(13, 13);
  oval(g, 6.5, 6.5, 5.5, 5.5, "W");
  rect(g, 6, 4, 1, 5, "K");
  rect(g, 5, 4, 3, 1, "K");
  rect(g, 5, 8, 3, 1, "K");
  return outline(g, "K");
}

/**
 * 큰 등급 휘장 (1비트). 등급마다 윤곽이 다르다: 올라갈수록 뿔이 돋고, 날개가 붙고, 관을 쓰고, 끝내 별이 된다.
 * 가운데(가로 9~20, 세로 6~22)는 등급 글자가 얹히는 자리라 검게 비워 둔다.
 *  F 무쇠 꼬리표 · D 청동 방패 · C 뿔 돋은 강철 방패 · B 날개 단 은 방패 · A 관을 쓴 금 방패 · S 여덟 갈래 별
 */
function monoMedal(rank: RankId): Grid {
  const g = grid(30, 34);
  /** 가운데 줄을 기준으로 한 줄씩 채운다: rows[i] 는 top + i 번째 줄의 반폭 */
  const body = (top: number, rows: number[]) => rows.forEach((hw, i) => hw > 0 && rect(g, 15 - hw, top + i, hw * 2, 1, "K"));
  /** 윤곽에서 inset 점 안쪽에 흰 테를 두른다 (좌우만. 위아래는 따로 긋는다) */
  const rim = (top: number, rows: number[], inset: number, from = 0, to = rows.length) =>
    rows.forEach((hw, i) => {
      if (i < from || i >= to || hw <= inset + 2) return;
      set(g, 15 - hw + inset, top + i, "W");
      set(g, 15 + hw - inset - 1, top + i, "W");
    });
  const heater = [13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 12, 12, 11, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

  switch (rank) {
    case "F": {
      // 무쇠 꼬리표: 귀를 접은 네모 판에 못 구멍 하나
      const plate = [9, 10, ...new Array<number>(24).fill(11), 10, 9];
      body(3, plate);
      rim(3, plate, 2, 2, 26);
      rect(g, 7, 5, 16, 1, "W");
      rect(g, 7, 28, 16, 1, "W");
      rect(g, 14, 1, 2, 2, "K");
      break;
    }
    case "D": {
      // 청동 방패: 가장 흔한 방패꼴. 아래에 갈매기 줄 하나
      body(1, heater);
      rim(1, heater, 2, 2);
      rect(g, 4, 3, 22, 1, "W");
      for (let i = 0; i < 4; i++) {
        set(g, 11 + i, 24 + i, "W");
        set(g, 18 - i, 24 + i, "W");
      }
      break;
    }
    case "C": {
      // 강철 방패: 어깨에 뿔이 돋고 윗변이 패였다
      const horned = [0, 0, 0, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 12, 12, 11, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
      body(1, horned);
      // 양 어깨의 뿔과 가운데의 봉우리
      for (const [x, h] of [[2, 3], [3, 3], [4, 2], [5, 1], [27, 3], [26, 3], [25, 2], [24, 1]] as const) rect(g, x, 4 - h, 1, h, "K");
      rect(g, 13, 1, 4, 3, "K");
      rect(g, 14, 0, 2, 1, "K");
      rim(1, horned, 2, 5);
      rect(g, 4, 6, 22, 1, "W");
      rect(g, 13, 24, 4, 2, "W");
      rect(g, 14, 26, 2, 1, "W");
      break;
    }
    case "B": {
      // 은 방패: 양옆으로 날개(깃 세 장)가 뻗는다. 깃은 아래로 갈수록 짧다.
      const slim = [9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 8, 8, 7, 7, 6, 5, 4, 3, 2, 1];
      body(2, slim);
      const feathers: [len: number, y: number][] = [
        [6, 4],
        [4, 9],
        [2, 14],
      ];
      for (const [len, y] of feathers) {
        rect(g, 6 - len, y, len, 3, "K");
        rect(g, 24, y, len, 3, "K");
        // 깃 끝은 한 점 깎는다
        set(g, 6 - len, y, null);
        set(g, 24 + len - 1, y, null);
        if (len > 2) {
          rect(g, 6 - len + 1, y + 1, len - 2, 1, "W");
          rect(g, 25, y + 1, len - 2, 1, "W");
        }
      }
      rim(2, slim, 2, 2);
      rect(g, 8, 4, 14, 1, "W");
      rect(g, 12, 25, 2, 2, "W");
      rect(g, 16, 25, 2, 2, "W");
      break;
    }
    case "A": {
      // 금 방패: 세 갈래 관을 썼다. 가운데 봉우리가 가장 높다.
      const crowned = [0, 0, 0, 0, 0, 0, 0, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 11, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
      body(1, crowned);
      // 관의 띠와 봉우리 셋
      rect(g, 4, 5, 22, 3, "K");
      rect(g, 4, 2, 3, 3, "K");
      rect(g, 4, 1, 2, 1, "K");
      rect(g, 23, 2, 3, 3, "K");
      rect(g, 24, 1, 2, 1, "K");
      rect(g, 12, 3, 6, 2, "K");
      rect(g, 13, 1, 4, 2, "K");
      rect(g, 14, 0, 2, 1, "K");
      rect(g, 8, 4, 2, 1, "K");
      rect(g, 20, 4, 2, 1, "K");
      // 띠의 흰 줄과 가운데 구슬
      rect(g, 6, 6, 18, 1, "W");
      rect(g, 14, 2, 2, 2, "W");
      rim(1, crowned, 2, 9);
      rect(g, 5, 10, 20, 1, "W");
      for (let i = 0; i < 3; i++) rect(g, 10 + i * 4, 25, 2, 2, "W");
      break;
    }
    case "S": {
      // 흑요석과 금: 여덟 갈래 별. 긴 살 넷과 짧은 살 넷
      for (let y = 0; y < 34; y++) {
        for (let x = 0; x < 30; x++) {
          const dx = Math.abs(x + 0.5 - 15);
          const dy = Math.abs(y + 0.5 - 17);
          const long = dx / 15 + dy / 5 <= 1 || dx / 5 + dy / 17 <= 1;
          const short = dx <= 9.5 && dy <= 9.5 && dx + dy <= 14.5;
          if (long || short) set(g, x, y, "K");
        }
      }
      oval(g, 15, 17, 10, 10, "K");
      // 가운데 둥근 판의 흰 테 (글자가 얹히는 곳은 비운다)
      for (let y = 0; y < 34; y++) {
        for (let x = 0; x < 30; x++) {
          const d = Math.hypot(x + 0.5 - 15, y + 0.5 - 17);
          if (d > 8.4 && d <= 9.4) set(g, x, y, "W");
        }
      }
      // 긴 살의 끝마다 흰 점
      rect(g, 14, 2, 2, 2, "W");
      rect(g, 14, 30, 2, 2, "W");
      rect(g, 2, 16, 2, 2, "W");
      rect(g, 26, 16, 2, 2, "W");
      break;
    }
  }
  return outline(g, "K");
}

/** 검수·테스트용: 휘장의 점 그림을 글자로 */
export function medalAscii(rank: RankId): string[] {
  const g = monoMedal(rank);
  return Array.from({ length: g.h }, (_, y) => Array.from({ length: g.w }, (_, x) => (g.px[y * g.w + x] === null ? " " : g.px[y * g.w + x] === "W" ? "o" : "#")).join(""));
}

/** 겹쳐 놓는 조각(봉투의 네 겹)과 사진틀 안의 초상에는 둘레 점을 두르지 않는다 */
const NO_HALO: ReadonlySet<SpriteName> = new Set<SpriteName>(["portrait", "env-back", "env-lid", "env-front", "env-flap"]);

export type SpriteName =
  | "crest"
  | "key"
  | "id"
  | "coins"
  | "coin"
  | "envelope"
  | "envelope-open"
  | "pin"
  | "shackle"
  | "pencil"
  | "chevron-up"
  | "chevron-down"
  | "arrow-left"
  | "sparkle"
  | "portrait"
  | "env-back"
  | "env-lid"
  | "env-front"
  | "env-flap"
  | "medal";

const DEFAULT_PORTRAIT: PortraitSpec = { hair: "cap", hairTone: "dark", tone: "navy" };

function build(name: SpriteName, rank: RankId, spec: PortraitSpec): Grid {
  switch (name) {
    case "portrait":
      return monoPortrait(spec);
    case "env-back":
      return envBack();
    case "env-lid":
      return envLid();
    case "env-front":
      return envFront();
    case "env-flap":
      return envFlap();
    case "medal":
      return monoMedal(rank);
    case "crest":
      return monoCrest();
    case "key":
      return key();
    case "id":
      return monoId();
    case "coins":
      return coins(3);
    case "coin":
      return monoCoin();
    case "envelope":
      return envelope(false);
    case "envelope-open":
      return envelope(true);
    case "pin":
      return pin();
    case "shackle":
      return shackle();
    case "pencil":
      return pencil();
    case "chevron-up":
      return chevron(true);
    case "chevron-down":
      return chevron(false);
    case "arrow-left":
      return arrowLeft();
    case "sparkle":
      return sparkle();
  }
}

interface SpriteProps {
  name: SpriteName;
  /** 그림 한 점의 화면 크기. 기본은 PX. */
  scale?: number;
  rank?: RankId;
  /** name 이 "portrait" 일 때 그릴 사람 */
  portrait?: PortraitSpec;
  /** 빈 가장자리를 잘라 내지 않는다 (여러 장을 같은 자리에 겹칠 때) */
  untrimmed?: boolean;
  className?: string;
  style?: CSSProperties;
}

/** 격자에 찍은 그림을 흰 점과 검은 점으로 놓는다. */
export function Sprite({ name, scale = PX, rank = "F", portrait: spec = DEFAULT_PORTRAIT, untrimmed = false, className, style }: SpriteProps) {
  const { g, paths } = useMemo(() => {
    const raw = build(name, rank, spec);
    const built = untrimmed ? raw : trim(raw);
    return { g: built, paths: toMonoPaths(built, !NO_HALO.has(name), SPRITE_TONES[name]) };
    // spec 은 값이 같은 고정 객체로 넘긴다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, rank, spec.hair, spec.hairTone, spec.tone, spec.glasses, untrimmed]);

  return (
    <svg
      className={["sprite", className].filter(Boolean).join(" ")}
      style={{ overflow: "visible", ...style }}
      width={g.w * scale}
      height={g.h * scale}
      viewBox={`0 0 ${g.w} ${g.h}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
    >
      {paths.map((p) => (
        <path key={p.color} d={p.d} fill={p.color} />
      ))}
    </svg>
  );
}

/* ───────── 표시: 동그라미·체크·가위표·밑줄을 점으로 찍는다 ───────── */

interface PixelMarkProps {
  kind: "circle" | "check" | "cross" | "underline";
  color?: string;
  className?: string;
  /** 깜빡이며 나타날지 */
  draw?: boolean;
  delayMs?: number;
}

export function PixelMark({ kind, color = MONO_INK, className, draw = false, delayMs = 0 }: PixelMarkProps) {
  const [ref, box] = useBox<HTMLSpanElement>();
  const cols = Math.max(0, Math.floor(box.w / PX));
  const rows = Math.max(0, Math.floor(box.h / PX));

  const d = useMemo(() => {
    if (cols < 3 || rows < 2) return "";
    const g = grid(cols, rows);
    const c: Ink = "K";
    if (kind === "circle") {
      const cx = cols / 2;
      const cy = rows / 2;
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const dx = (x + 0.5 - cx) / (cols / 2);
          const dy = (y + 0.5 - cy) / (rows / 2);
          const v = dx * dx + dy * dy;
          const inner = ((x + 0.5 - cx) / (cols / 2 - 1.6)) ** 2 + ((y + 0.5 - cy) / (rows / 2 - 1.6)) ** 2;
          if (v <= 1 && inner > 1) set(g, x, y, c);
        }
      }
    } else if (kind === "cross") {
      const m = Math.min(cols, rows) - 1;
      const ox = Math.floor((cols - m) / 2);
      const oy = Math.floor((rows - m) / 2);
      for (let t = 0; t < 2; t++) {
        line(g, ox + t, oy, ox + m - 1 + t, oy + m - 1, c);
        line(g, ox + m - 1 + t, oy, ox + t, oy + m - 1, c);
      }
    } else if (kind === "check") {
      const m = Math.min(cols, rows);
      for (let t = 0; t < 2; t++) {
        line(g, 1, Math.round(m * 0.55) + t, Math.round(m * 0.36), m - 2 + t, c);
        line(g, Math.round(m * 0.36), m - 2 + t, m - 1, 1 + t, c);
      }
    } else {
      rect(g, 0, rows - 1, cols, 1, c);
    }
    return toPaths(g)[0]?.d ?? "";
  }, [cols, rows, kind]);

  return (
    <span
      ref={ref}
      className={["penmark pxmark", className].filter(Boolean).join(" ")}
      data-kind={kind}
      data-draw={draw}
      style={{ "--pen-delay": `${delayMs}ms` } as CSSProperties}
      aria-hidden="true"
    >
      {d && (
        <svg width={cols * PX} height={rows * PX} viewBox={`0 0 ${cols} ${rows}`} shapeRendering="crispEdges" focusable="false">
          <path d={d} fill={color} />
        </svg>
      )}
    </span>
  );
}

interface PenMarkProps {
  kind: "circle" | "check" | "cross" | "underline";
  /** 깜빡이며 나타날지 */
  draw?: boolean;
  delayMs?: number;
  className?: string;
}

/**
 * 시험지에 치는 표시. 부모 크기에 맞춰 점으로 찍는다. 부모는 position: relative 여야 한다.
 * 흰 점으로 찍고, 겹친 자리의 색을 뒤집어(mono.css 의 .pxmark) 흰 바탕 위에서는 검게 보인다.
 */
export function PenMark({ kind, draw, delayMs, className }: PenMarkProps) {
  return <PixelMark kind={kind} color={MONO_INK} draw={draw} delayMs={delayMs} className={className} />;
}
