/**
 * 점 격자. 움직이는 작은 그림(비, 주화, 모래시계)을 흑백 점으로 그리는 바탕이다.
 * 칸 하나가 화면의 점 하나(2px)다. 칸마다 두 가지를 가진다.
 *  - 밝기(tone, 0~1): 4×4 베이어 격자로 흰 점·검은 점으로 바뀐다(중간 밝기는 점묘가 된다).
 *  - 먹(ink): 1 = 흰 점, -1 = 검은 점, 0 = 없음. 점묘 뒤에 그대로 얹힌다.
 * 장면(src/scene)의 "밝기 층 + 먹 층"과 같은 약속이라, 장면 안에 넣어도 점묘의 결이 어긋나지 않는다.
 */
import { BAYER4, INK_RGB } from "../scene/dot";

export class DotGrid {
  readonly tone: Float32Array;
  readonly ink: Int8Array;

  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.tone = new Float32Array(w * h);
    this.ink = new Int8Array(w * h);
  }

  clear(tone = 0) {
    this.tone.fill(tone);
    this.ink.fill(0);
    return this;
  }

  inside(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  /** 밝기를 놓는다 */
  set(x: number, y: number, v: number) {
    x = Math.round(x);
    y = Math.round(y);
    if (this.inside(x, y)) this.tone[y * this.w + x] = v;
  }

  /** 밝기를 더 밝은 쪽으로만 올린다 */
  lift(x: number, y: number, v: number) {
    x = Math.round(x);
    y = Math.round(y);
    if (!this.inside(x, y)) return;
    const i = y * this.w + x;
    if (v > this.tone[i]) this.tone[i] = v;
  }

  /** 먹 점을 찍는다 (1 흰 점, -1 검은 점, 0 지움) */
  dot(x: number, y: number, v: 1 | -1 | 0 = 1) {
    x = Math.round(x);
    y = Math.round(y);
    if (this.inside(x, y)) this.ink[y * this.w + x] = v;
  }

  rect(x: number, y: number, w: number, h: number, v: 1 | -1 | 0) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.dot(x + i, y + j, v);
  }

  line(x0: number, y0: number, x1: number, y1: number, v: 1 | -1 = 1, skip = 0) {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (let n = 0; n < 2000; n++) {
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
}

/**
 * 점 격자를 두 색 화소로 바꿔 out(RGBA)에 쓴다.
 * ox·oy 는 이 격자가 화면의 점 격자에서 놓이는 자리다: 점묘의 결이 화면의 다른 그림과 이어지게 한다.
 * clear 가 참이면 꺼진 점은 투명하게 둔다(다른 그림 위에 얹을 때).
 */
export function paintDots(g: DotGrid, out: Uint8ClampedArray, ox = 0, oy = 0, clear = false) {
  const { w, h, tone, ink } = g;
  for (let y = 0; y < h; y++) {
    const row = ((y + oy) & 3) * 4;
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const k = ink[i];
      const on = k !== 0 ? k > 0 : tone[i] > (BAYER4[row + ((x + ox) & 3)] + 0.5) / 16;
      const o = i * 4;
      out[o] = on ? INK_RGB[0] : 0;
      out[o + 1] = on ? INK_RGB[1] : 0;
      out[o + 2] = on ? INK_RGB[2] : 0;
      out[o + 3] = on || !clear || k < 0 ? 255 : 0;
    }
  }
}

/** 점 격자를 캔버스에 그린다 (캔버스의 한 화소가 점 하나. 화면에는 2배로 놓는다) */
export class DotCanvas {
  private ctx: CanvasRenderingContext2D;
  private image: ImageData;

  constructor(
    readonly canvas: HTMLCanvasElement,
    readonly grid: DotGrid,
  ) {
    canvas.width = grid.w;
    canvas.height = grid.h;
    this.ctx = canvas.getContext("2d")!;
    this.image = this.ctx.createImageData(grid.w, grid.h);
  }

  draw(ox = 0, oy = 0, clear = false) {
    paintDots(this.grid, this.image.data, ox, oy, clear);
    this.ctx.putImageData(this.image, 0, 0);
  }
}
