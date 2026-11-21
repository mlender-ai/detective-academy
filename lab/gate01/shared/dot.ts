// 흑백 점 화면의 공통 도구.
// 화면은 "점 격자"다(점 하나 = 화면의 2px). 장면은 두 가지로 이뤄진다.
//  - 밝기 층(tone): 0~255 의 회색으로 그린 뒤, 4×4 베이어 격자로 흰 점·검은 점 두 가지로 바꾼다.
//  - 먹 층(ink): 흰 점(1)·검은 점(-1)·빈칸(0)을 직접 찍은 그림. 점묘 뒤에 그대로 얹는다.

export const INK_HEX = "#f1f1ea";
export const INK_RGB: [number, number, number] = [241, 241, 234];
export const DOT = 2;

export const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** 직접 찍은 그림: 1 = 흰 점, -1 = 검은 점, 0 = 빈칸 */
export interface Sprite {
  w: number;
  h: number;
  px: Int8Array;
  /** 기준점(발끝 가운데 등). 그림 안의 좌표 */
  ax: number;
  ay: number;
}

export function makeSprite(w: number, h: number, ax = 0, ay = 0): Sprite {
  return { w, h, px: new Int8Array(w * h), ax, ay };
}

export function putDot(s: Sprite, x: number, y: number, v: number) {
  x = Math.round(x);
  y = Math.round(y);
  if (x < 0 || y < 0 || x >= s.w || y >= s.h) return;
  s.px[y * s.w + x] = v;
}

export function getDot(s: Sprite, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= s.w || y >= s.h) return 0;
  return s.px[y * s.w + x];
}

export function rectDots(s: Sprite, x: number, y: number, w: number, h: number, v: number) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) putDot(s, x + i, y + j, v);
}

export function lineDots(s: Sprite, x0: number, y0: number, x1: number, y1: number, v: number, skip = 0) {
  x0 = Math.round(x0);
  y0 = Math.round(y0);
  x1 = Math.round(x1);
  y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let n = 0;
  for (;;) {
    if (!skip || n % (skip + 1) === 0) putDot(s, x0, y0, v);
    n++;
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

export function fillPoly(s: Sprite, pts: [number, number][], v: number) {
  const ys = pts.map((p) => p[1]);
  for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[(i + 1) % pts.length];
      if (y0 === y1) continue;
      const yy = y + 0.5;
      if (yy < Math.min(y0, y1) || yy >= Math.max(y0, y1)) continue;
      xs.push(x0 + ((yy - y0) / (y1 - y0)) * (x1 - x0));
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) for (let x = Math.round(xs[i]); x < Math.round(xs[i + 1]); x++) putDot(s, x, y, v);
  }
}

/** 그림 둘레(빈칸 가운데 그림에 닿은 자리)에 점을 한 줄 두른다 */
export function haloDots(s: Sprite, v: number): Sprite {
  const out = makeSprite(s.w + 2, s.h + 2, s.ax + 1, s.ay + 1);
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) out.px[(y + 1) * out.w + x + 1] = s.px[y * s.w + x];
  for (let y = 0; y < out.h; y++)
    for (let x = 0; x < out.w; x++) {
      if (out.px[y * out.w + x] !== 0) continue;
      const near = getDot(s, x - 2, y - 1) || getDot(s, x, y - 1) || getDot(s, x - 1, y - 2) || getDot(s, x - 1, y);
      if (near) out.px[y * out.w + x] = 2; // 임시 표시
    }
  for (let i = 0; i < out.px.length; i++) if (out.px[i] === 2) out.px[i] = v;
  return out;
}

/** 직접 찍은 그림을 캔버스로 (점 하나 = 1px. 화면에 놓을 때 2배로 키운다) */
export function spriteCanvas(s: Sprite): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = s.w;
  c.height = s.h;
  const ctx = c.getContext("2d")!;
  const im = ctx.createImageData(s.w, s.h);
  for (let i = 0; i < s.px.length; i++) {
    const v = s.px[i];
    if (v === 0) continue;
    const o = i * 4;
    if (v > 0) {
      im.data[o] = INK_RGB[0];
      im.data[o + 1] = INK_RGB[1];
      im.data[o + 2] = INK_RGB[2];
    }
    im.data[o + 3] = 255;
  }
  ctx.putImageData(im, 0, 0);
  return c;
}

/** 밝기(회색 RGBA)를 흰 점·검은 점으로 바꿔 out 에 쓴다. 알파가 0 인 자리는 검정으로 둔다. */
export function ditherInto(tone: Uint8ClampedArray, out: Uint8ClampedArray, w: number, h: number) {
  for (let y = 0; y < h; y++) {
    const row = (y & 3) * 4;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const on = tone[i] / 255 > (BAYER4[row + (x & 3)] + 0.5) / 16;
      out[i] = on ? INK_RGB[0] : 0;
      out[i + 1] = on ? INK_RGB[1] : 0;
      out[i + 2] = on ? INK_RGB[2] : 0;
      out[i + 3] = 255;
    }
  }
}

export function gray(v: number, a = 1): string {
  const n = Math.round(Math.max(0, Math.min(1, v)) * 255);
  return `rgba(${n},${n},${n},${a})`;
}
