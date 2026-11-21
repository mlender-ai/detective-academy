// 점 화면에 한 장면을 그린다 (Canvas 2D).
// 밝기 층을 더하고 곱해 합친 뒤 4×4 베이어 격자로 흰 점·검은 점으로 바꾸고, 그 위에 먹 층을 얹는다.
// 빛을 층으로 따로 두면 전등이 꺼지거나 문이 열릴 때 점묘가 실제로 바뀐다.
import { ditherInto } from "./dot";

export interface ToneOp {
  canvas: HTMLCanvasElement;
  /** 0 이면 건너뛴다. 렌더러마다 어긋나지 않게 0 과 1 만 쓴다. */
  alpha: number;
  op: "over" | "add" | "mul";
  x?: number;
  y?: number;
}

export interface InkOp {
  canvas: HTMLCanvasElement;
  x: number;
  y: number;
}

export interface StageFrame {
  tone: ToneOp[];
  /** 발밑 그림자: 밝기 층을 어둡게 누른다 */
  shadows: { x: number; y: number; rx: number; ry: number }[];
  ink: InkOp[];
}

const OP = { over: "source-over", add: "lighter", mul: "multiply" } as const;

export class Stage {
  private out: CanvasRenderingContext2D;
  private tone: CanvasRenderingContext2D;
  private image: ImageData;

  constructor(
    canvas: HTMLCanvasElement,
    readonly w: number,
    readonly h: number,
  ) {
    canvas.width = w;
    canvas.height = h;
    this.out = canvas.getContext("2d")!;
    this.out.imageSmoothingEnabled = false;
    this.image = this.out.createImageData(w, h);
    const toneCanvas = document.createElement("canvas");
    toneCanvas.width = w;
    toneCanvas.height = h;
    this.tone = toneCanvas.getContext("2d", { willReadFrequently: true })!;
  }

  draw(frame: StageFrame) {
    const { tone, out, w, h } = this;
    tone.globalCompositeOperation = "source-over";
    tone.globalAlpha = 1;
    tone.fillStyle = "#000";
    tone.fillRect(0, 0, w, h);
    for (const op of frame.tone) {
      if (op.alpha <= 0) continue;
      tone.globalCompositeOperation = OP[op.op];
      tone.globalAlpha = op.alpha;
      tone.drawImage(op.canvas, op.x ?? 0, op.y ?? 0);
    }
    tone.globalCompositeOperation = "source-over";
    tone.globalAlpha = 0.7;
    tone.fillStyle = "#000";
    for (const s of frame.shadows) {
      tone.beginPath();
      tone.ellipse(s.x, s.y, s.rx, s.ry, 0, 0, Math.PI * 2);
      tone.fill();
    }
    tone.globalAlpha = 1;
    ditherInto(tone.getImageData(0, 0, w, h).data, this.image.data, w, h);
    out.putImageData(this.image, 0, 0);
    for (const i of frame.ink) out.drawImage(i.canvas, i.x, i.y);
  }
}

/**
 * 장면을 굴린다. 화면을 떠나 있는 동안에는 그리지 않고, 돌아오면 이어서 돈다.
 * 돌려받은 함수를 부르면 멈춘다(화면에서 내려갈 때 반드시 부른다).
 */
export function runLoop(step: (dt: number) => void): () => void {
  let raf = 0;
  let last = performance.now();
  let stopped = false;
  const tick = (now: number) => {
    if (stopped) return;
    step(Math.min(0.1, (now - last) / 1000));
    last = now;
    raf = requestAnimationFrame(tick);
  };
  const onVisibility = () => {
    cancelAnimationFrame(raf);
    if (!document.hidden && !stopped) {
      last = performance.now();
      raf = requestAnimationFrame(tick);
    }
  };
  document.addEventListener("visibilitychange", onVisibility);
  raf = requestAnimationFrame(tick);
  return () => {
    stopped = true;
    cancelAnimationFrame(raf);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}

/** 밝기 층을 그릴 때 쓰는 도구 */
export const SS = 3;

export function toneLayer(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void, fill: string | null = "#000"): HTMLCanvasElement {
  const big = document.createElement("canvas");
  big.width = w * SS;
  big.height = h * SS;
  const c = big.getContext("2d")!;
  c.scale(SS, SS);
  if (fill) {
    c.fillStyle = fill;
    c.fillRect(0, 0, w, h);
  }
  draw(c);
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const oc = out.getContext("2d")!;
  oc.imageSmoothingQuality = "high";
  oc.drawImage(big, 0, 0, w, h);
  return out;
}

export type Pt = [number, number];

export function tracePath(c: CanvasRenderingContext2D, pts: Pt[]) {
  c.beginPath();
  pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.closePath();
}

export function clipTo(c: CanvasRenderingContext2D, pts: Pt[], fn: () => void) {
  c.save();
  tracePath(c, pts);
  c.clip();
  fn();
  c.restore();
}
