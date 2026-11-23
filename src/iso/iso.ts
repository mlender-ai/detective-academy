// 쿼터뷰(비스듬히 내려다본 방) 장면의 바탕: 투영, 점 층, 그리는 도구, 깊이 정렬.
// 화면은 지금까지와 같은 "점 격자"다(점 하나 = 화면의 2px). 칸마다 밝기(0~1 → 4×4 점묘)와 먹(흰 점·검은 점)을 가진다.
// 옆에서 본 장면(src/scene)과 다른 점은 가림이다: 앞에 놓인 물건이 뒤의 것을 밝기째로 덮어야 해서,
// 물건마다 "덮는 자리(mask)"를 가진 층으로 그리고 뒤에서 앞으로 차례로 얹는다.
import { BAYER4, INK_RGB } from "../scene/dot";

/** 바닥 한 칸의 반폭·반높이(점)와 높이 한 칸(점). 칸 하나는 화면에서 가로 32점 × 세로 16점의 마름모다. */
export const HW = 16;
export const HH = 8;
export const ZS = 16;

export type Ink = 1 | -1 | 0;
export type Pt = [number, number];
/** 밝기: 값 하나, 또는 점마다 다른 값 */
export type Shade = number | ((x: number, y: number) => number);

/** 점 층. tone 은 밝기, ink 는 먹(1 흰 점 · -1 검은 점 · 0 없음), mask 는 이 층이 덮는 자리다. */
export class Layer {
  readonly tone: Float32Array;
  readonly ink: Int8Array;
  readonly mask: Uint8Array;

  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.tone = new Float32Array(w * h);
    this.ink = new Int8Array(w * h);
    this.mask = new Uint8Array(w * h);
  }

  clear() {
    this.tone.fill(0);
    this.ink.fill(0);
    this.mask.fill(0);
    return this;
  }

  inside(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  /** 밝기를 놓는다. 그 자리의 먹은 지운다(면이 뒤의 선을 덮는다). */
  put(x: number, y: number, tone: number) {
    if (!this.inside(x, y)) return;
    const i = y * this.w + x;
    this.tone[i] = tone;
    this.ink[i] = 0;
    this.mask[i] = 1;
  }

  /** 먹 점을 찍는다 */
  dot(x: number, y: number, v: Ink = 1) {
    x = Math.round(x);
    y = Math.round(y);
    if (!this.inside(x, y)) return;
    const i = y * this.w + x;
    this.ink[i] = v;
    this.mask[i] = 1;
  }

  /** 덮던 자리를 비운다(구멍을 낸다) */
  cut(x: number, y: number) {
    if (!this.inside(x, y)) return;
    const i = y * this.w + x;
    this.tone[i] = 0;
    this.ink[i] = 0;
    this.mask[i] = 0;
  }

  rect(x: number, y: number, w: number, h: number, shade: Shade) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.put(x + i, y + j, typeof shade === "number" ? shade : shade(x + i, y + j));
  }

  rectInk(x: number, y: number, w: number, h: number, v: Ink) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.dot(x + i, y + j, v);
  }

  /** 테두리만 */
  frame(x: number, y: number, w: number, h: number, v: Ink = 1) {
    for (let i = 0; i < w; i++) {
      this.dot(x + i, y, v);
      this.dot(x + i, y + h - 1, v);
    }
    for (let j = 0; j < h; j++) {
      this.dot(x, y + j, v);
      this.dot(x + w - 1, y + j, v);
    }
  }

  line(x0: number, y0: number, x1: number, y1: number, v: Ink = 1, skip = 0) {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (let n = 0; n < 4000; n++) {
      if (!skip || n % (skip + 1) === 0) this.dot(x0, y0, v);
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

  private scan(pts: Pt[], fn: (x: number, y: number) => void) {
    let top = Infinity;
    let bottom = -Infinity;
    for (const p of pts) {
      top = Math.min(top, p[1]);
      bottom = Math.max(bottom, p[1]);
    }
    for (let y = Math.max(0, Math.floor(top)); y <= Math.min(this.h - 1, Math.ceil(bottom)); y++) {
      const yy = y + 0.5;
      const xs: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const [xa, ya] = pts[i];
        const [xb, yb] = pts[(i + 1) % pts.length];
        if (ya === yb) continue;
        if (yy < Math.min(ya, yb) || yy >= Math.max(ya, yb)) continue;
        xs.push(xa + ((yy - ya) / (yb - ya)) * (xb - xa));
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) for (let x = Math.max(0, Math.round(xs[i])); x < Math.min(this.w, Math.round(xs[i + 1])); x++) fn(x, y);
    }
  }

  /** 다각형을 밝기로 채운다 */
  poly(pts: Pt[], shade: Shade) {
    if (typeof shade === "number") this.scan(pts, (x, y) => this.put(x, y, shade));
    else this.scan(pts, (x, y) => this.put(x, y, shade(x, y)));
  }

  /** 다각형을 먹으로 채운다 */
  polyInk(pts: Pt[], v: Ink) {
    this.scan(pts, (x, y) => this.dot(x, y, v));
  }

  /** 다각형의 둘레를 긋는다 */
  outline(pts: Pt[], v: Ink = 1, skip = 0) {
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      this.line(a[0], a[1], b[0], b[1], v, skip);
    }
  }

  /** 다른 층을 얹는다: 그 층이 덮는 자리는 밝기와 먹을 모두 바꾼다 */
  blit(src: Layer, dx: number, dy: number) {
    const x0 = Math.max(0, -dx);
    const x1 = Math.min(src.w, this.w - dx);
    const y0 = Math.max(0, -dy);
    const y1 = Math.min(src.h, this.h - dy);
    for (let y = y0; y < y1; y++) {
      let s = y * src.w + x0;
      let d = (y + dy) * this.w + x0 + dx;
      for (let x = x0; x < x1; x++, s++, d++) {
        if (!src.mask[s]) continue;
        this.tone[d] = src.tone[s];
        this.ink[d] = src.ink[s];
        this.mask[d] = 1;
      }
    }
  }

  /** 덮는 자리만 남기고 잘라 낸다 */
  crop(): Piece {
    let x0 = this.w;
    let y0 = this.h;
    let x1 = -1;
    let y1 = -1;
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++)
        if (this.mask[y * this.w + x]) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
    if (x1 < 0) return { layer: new Layer(1, 1), x: 0, y: 0 };
    const out = new Layer(x1 - x0 + 1, y1 - y0 + 1);
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const s = y * this.w + x;
        if (!this.mask[s]) continue;
        const d = (y - y0) * out.w + (x - x0);
        out.tone[d] = this.tone[s];
        out.ink[d] = this.ink[s];
        out.mask[d] = 1;
      }
    return { layer: out, x: x0, y: y0 };
  }
}

/** 잘라 낸 그림과 그것이 장면에서 놓이는 자리 */
export interface Piece {
  layer: Layer;
  x: number;
  y: number;
}

/** 방의 뒤 모서리(0, 0, 0)가 화면의 (ox, oy)에 놓이는 투영 */
export class Iso {
  constructor(
    readonly ox: number,
    readonly oy: number,
  ) {}

  /** 방 좌표(칸) → 화면의 점 */
  p(x: number, y: number, z = 0): Pt {
    return [this.ox + (x - y) * HW, this.oy + (x + y) * HH - z * ZS];
  }

  /** 화면의 점 → 바닥(높이 0)의 방 좌표 */
  floor(px: number, py: number): Pt {
    const a = (px - this.ox) / HW;
    const b = (py - this.oy) / HH;
    return [(a + b) / 2, (b - a) / 2];
  }

  /** x 축과 나란한 세로 면(y = at)의 네 귀: 보는 쪽에서 왼쪽이 x0 */
  faceX(at: number, x0: number, x1: number, z0: number, z1: number): Pt[] {
    return [this.p(x0, at, z1), this.p(x1, at, z1), this.p(x1, at, z0), this.p(x0, at, z0)];
  }

  /** y 축과 나란한 세로 면(x = at)의 네 귀: 보는 쪽에서 왼쪽이 y1(큰 쪽) */
  faceY(at: number, y0: number, y1: number, z0: number, z1: number): Pt[] {
    return [this.p(at, y1, z1), this.p(at, y0, z1), this.p(at, y0, z0), this.p(at, y1, z0)];
  }

  /** 높이 z 의 가로 면 */
  top(x0: number, y0: number, x1: number, y1: number, z: number): Pt[] {
    return [this.p(x0, y0, z), this.p(x1, y0, z), this.p(x1, y1, z), this.p(x0, y1, z)];
  }
}

export interface BoxStyle {
  top: Shade;
  /** y 가 큰 쪽의 면(화면에서 왼쪽 아래를 본다) */
  left: Shade;
  /** x 가 큰 쪽의 면(화면에서 오른쪽 아래를 본다) */
  right: Shade;
  /** 모서리 선. 0 이면 긋지 않는다 */
  edge?: Ink;
}

/** 상자를 그린다: 보이는 세 면(윗면, 왼쪽 앞면, 오른쪽 앞면)과 모서리 선 */
export function box(L: Layer, iso: Iso, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, s: BoxStyle) {
  const A = iso.p(x0, y0, z1);
  const B = iso.p(x1, y0, z1);
  const C = iso.p(x1, y1, z1);
  const D = iso.p(x0, y1, z1);
  const B0 = iso.p(x1, y0, z0);
  const C0 = iso.p(x1, y1, z0);
  const D0 = iso.p(x0, y1, z0);
  L.poly([D, C, C0, D0], s.left);
  L.poly([C, B, B0, C0], s.right);
  L.poly([A, B, C, D], s.top);
  const e = s.edge ?? 1;
  if (e) {
    L.outline([A, B, C, D], e);
    L.line(D[0], D[1], D0[0], D0[1], e);
    L.line(C[0], C[1], C0[0], C0[1], e);
    L.line(B[0], B[1], B0[0], B0[1], e);
    L.line(D0[0], D0[1], C0[0], C0[1], e);
    L.line(C0[0], C0[1], B0[0], B0[1], e);
  }
}

/**
 * 평평하게 그린 그림(flat)을 세로 면에 붙인다. 가로줄은 2:1 로 기울고 세로줄은 그대로 선다.
 *  - axis "x": x 축과 나란한 면(y = at). flat 의 왼쪽 끝이 x = start.
 *  - axis "y": y 축과 나란한 면(x = at). flat 의 왼쪽 끝이 y = start(큰 쪽)이고 오른쪽으로 갈수록 y 가 준다.
 * zBottom 은 flat 의 아랫변 높이(칸). at · start 는 1/8 칸 단위로 준다(점에 딱 맞게).
 */
export function stampFace(L: Layer, iso: Iso, flat: Layer, axis: "x" | "y", at: number, start: number, zBottom: number) {
  const zb = Math.round(zBottom * ZS);
  if (axis === "x") {
    const ox = iso.ox - Math.round(at * HW);
    const oy = iso.oy + Math.round(at * HH);
    const k0 = Math.round(start * HW);
    for (let i = 0; i < flat.w; i++) {
      const k = k0 + i;
      const base = oy + Math.ceil(k / 2);
      for (let j = 0; j < flat.h; j++) {
        const s = j * flat.w + i;
        if (!flat.mask[s]) continue;
        const x = ox + k;
        const y = base - 1 - zb - (flat.h - 1 - j);
        if (!L.inside(x, y)) continue;
        const d = y * L.w + x;
        L.tone[d] = flat.tone[s];
        L.ink[d] = flat.ink[s];
        L.mask[d] = 1;
      }
    }
  } else {
    const ox = iso.ox + Math.round(at * HW);
    const oy = iso.oy + Math.round(at * HH);
    const i0 = Math.round(start * HW);
    for (let i = 0; i < flat.w; i++) {
      const n = i0 - i;
      const base = oy + Math.floor(n / 2);
      for (let j = 0; j < flat.h; j++) {
        const s = j * flat.w + i;
        if (!flat.mask[s]) continue;
        const x = ox - n;
        const y = base - 1 - zb - (flat.h - 1 - j);
        if (!L.inside(x, y)) continue;
        const d = y * L.w + x;
        L.tone[d] = flat.tone[s];
        L.ink[d] = flat.ink[s];
        L.mask[d] = 1;
      }
    }
  }
}

/**
 * 밝기를 일곱 단계로 끊는다: 흰 점이 16칸 가운데 0 · 1 · 2 · 4 · 8 · 12 · 16칸.
 * 단계 사이를 매끄럽게 잇지 않아야 점묘가 깨끗한 무늬의 띠로 나뉜다(매끄러운 농담은 이 크기에서 지저분한 잡음이 된다).
 */
export function toneLevel(t: number) {
  return t < 0.035 ? 0 : t < 0.095 ? 1 : t < 0.19 ? 2 : t < 0.37 ? 4 : t < 0.63 ? 8 : t < 0.87 ? 12 : 16;
}

/** 밝기(0~1 을 256칸으로 나눈 값) → 단계 */
const LEVEL = Uint8Array.from({ length: 256 }, (_, q) => toneLevel(q / 255));

// 화소 하나를 32비트로 한 번에 쓴다(RGBA 순서의 바이트를 리틀 엔디언으로 묶은 값)
const WHITE = (255 << 24) | (INK_RGB[2] << 16) | (INK_RGB[1] << 8) | INK_RGB[0];
const BLACK = 255 << 24;

/** 층을 두 색 화소로 바꿔 out(RGBA)에 쓴다 */
export function paintLayer(L: Layer, out: Uint8ClampedArray) {
  const { w, h, tone, ink } = L;
  const px = new Uint32Array(out.buffer, out.byteOffset, w * h);
  let i = 0;
  for (let y = 0; y < h; y++) {
    const row = (y & 3) * 4;
    for (let x = 0; x < w; x++, i++) {
      const k = ink[i];
      if (k !== 0) {
        px[i] = k > 0 ? WHITE : BLACK;
        continue;
      }
      const t = tone[i];
      px[i] = t > 0 && LEVEL[t >= 1 ? 255 : (t * 255) | 0] > BAYER4[row + (x & 3)] ? WHITE : BLACK;
    }
  }
}

/* ───────── 깊이 정렬 ───────── */

/** 바닥에 차지하는 자리(칸). 이것으로 누가 앞인지 가린다. */
export interface Footprint {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const EPS = 0.01;

/** a 가 b 보다 뒤(먼저 그려야 한다)인가 */
function behind(a: Footprint, b: Footprint) {
  const aBack = a.x1 <= b.x0 + EPS || a.y1 <= b.y0 + EPS;
  const bBack = b.x1 <= a.x0 + EPS || b.y1 <= a.y0 + EPS;
  return aBack && !bBack;
}

const depth = (f: Footprint) => f.x0 + f.x1 + f.y0 + f.y1;

/** 뒤에서 앞으로 그릴 차례. 물건이 스무 개 남짓이라 매 장면 다시 세워도 값이 없다. */
export function drawOrder<T extends { foot: Footprint }>(items: T[]): T[] {
  const rest = [...items].sort((a, b) => depth(a.foot) - depth(b.foot));
  const out: T[] = [];
  while (rest.length) {
    let pick = 0;
    for (let i = 0; i < rest.length; i++) {
      let free = true;
      for (let j = 0; j < rest.length; j++) {
        if (i !== j && behind(rest[j].foot, rest[i].foot)) {
          free = false;
          break;
        }
      }
      if (free) {
        pick = i;
        break;
      }
    }
    out.push(rest.splice(pick, 1)[0]);
  }
  return out;
}
