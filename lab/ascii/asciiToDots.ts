// ASCII Magic 의 글자 격자 장면(frame)을 탐정학원의 점 격자로 바꾼다 (실험실 전용: 원본 조각을 그대로 돌려 변환 결과를 보는 데 쓴다).
// 제품에는 이 변환기가 들어가지 않는다. 제품에 넣는 조각은 src/fx/ascii/ 에 점 격자용으로 고쳐 옮겼다.
//
// 칸 하나(글자 하나)를 가로 1점 × 세로 2점으로 바꾼다(글자 칸의 비율이 1:2 이므로).
//  - 농담 문자(░▒▓█)와 반 칸 블록: 밝기 = 농도 × 색의 밝기 → 4×4 베이어 점묘
//  - 선·기호·글자: 글자의 모양을 두 점으로 줄여, 색이 밝으면 흰 점, 어두우면 밝기(성긴 점)로 찍는다
// 색은 밝기로만 남는다(두 색 규칙).
import { DotGrid } from "../../src/fx/dots";

export type Frame = string | { text: string; color?: string };

const SHADE: Record<string, number> = { "░": 0.25, "▒": 0.5, "▓": 0.75, "█": 1 };
/** 반 칸 블록: [위 점, 아래 점]의 채움 */
const HALF: Record<string, [number, number]> = { "▀": [1, 0], "▄": [0, 1], "▌": [0.5, 0.5], "▐": [0.5, 0.5], "▁": [0, 0.25], "▂": [0, 0.5], "▃": [0, 0.75], "▅": [0.25, 1], "▆": [0.5, 1], "▇": [0.75, 1], "▔": [0.25, 0] };

const lumCache = new Map<string, number>();
function lum(hex: string | undefined) {
  if (!hex) return 0.88;
  let v = lumCache.get(hex);
  if (v === undefined) {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    v = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    lumCache.set(hex, v);
  }
  return v;
}

// 글자의 모양: 등폭 글꼴로 한 번 그려 위·아래 두 점이 얼마나 덮이는지 잰다
const maskCache = new Map<string, [number, number]>();
let probe: CanvasRenderingContext2D | null = null;
function glyph(ch: string): [number, number] {
  let m = maskCache.get(ch);
  if (m) return m;
  if (!probe) {
    const c = document.createElement("canvas");
    c.width = 16;
    c.height = 32;
    probe = c.getContext("2d", { willReadFrequently: true })!;
    probe.font = "26px Menlo, Monaco, 'Courier New', monospace";
    probe.textBaseline = "alphabetic";
    probe.fillStyle = "#fff";
  }
  probe.clearRect(0, 0, 16, 32);
  probe.fillText(ch, 0, 25);
  const d = probe.getImageData(0, 0, 16, 32).data;
  let top = 0;
  let bot = 0;
  for (let y = 0; y < 32; y++) for (let x = 0; x < 16; x++) (y < 16 ? ((top += d[(y * 16 + x) * 4 + 3]), 0) : ((bot += d[(y * 16 + x) * 4 + 3]), 0));
  top /= 16 * 16 * 255;
  bot /= 16 * 16 * 255;
  const max = Math.max(top, bot);
  m = max < 0.02 ? [0, 0] : [top / max > 0.5 ? 1 : (top / max) * 0.8, bot / max > 0.5 ? 1 : (bot / max) * 0.8];
  maskCache.set(ch, m);
  return m;
}

/** frame 을 점 격자(가로 cols, 세로 rows×2)에 그린다 */
export function asciiToDots(frame: Frame, palette: Record<string, string> | undefined, g: DotGrid) {
  const text = (typeof frame === "string" ? frame : frame.text).split("\n");
  const color = typeof frame === "string" || !frame.color ? null : frame.color.split("\n");
  g.clear(0);
  for (let y = 0; y < text.length; y++) {
    const line = [...text[y]];
    for (let x = 0; x < line.length && x < g.w; x++) {
      const ch = line[x];
      if (ch === " ") continue;
      const key = color ? color[y]?.[x] : undefined;
      const L = lum(key && key !== " " ? palette?.[key] : undefined);
      const i0 = y * 2 * g.w + x;
      const i1 = i0 + g.w;
      if (i1 >= g.tone.length) continue;
      const shade = SHADE[ch];
      if (shade !== undefined) {
        g.tone[i0] = g.tone[i1] = shade * L;
        continue;
      }
      const half = HALF[ch];
      if (half) {
        g.tone[i0] = half[0] * L;
        g.tone[i1] = half[1] * L;
        continue;
      }
      const [a, b] = glyph(ch);
      // 밝은 색의 선·기호는 흰 점으로 또렷하게, 어두운 색은 밝기로(성긴 점)
      if (L >= 0.55) {
        if (a === 1) g.ink[i0] = 1;
        else g.tone[i0] = a * L;
        if (b === 1) g.ink[i1] = 1;
        else g.tone[i1] = b * L;
      } else {
        g.tone[i0] = a * L * 1.3;
        g.tone[i1] = b * L * 1.3;
      }
    }
  }
}

/** 원본 그대로(글자와 색) 캔버스에 그린다: 비교의 왼쪽 */
export function drawAscii(frame: Frame, palette: Record<string, string> | undefined, ctx: CanvasRenderingContext2D, cellW: number, cellH: number) {
  const text = (typeof frame === "string" ? frame : frame.text).split("\n");
  const color = typeof frame === "string" || !frame.color ? null : frame.color.split("\n");
  ctx.fillStyle = "#07070a";
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.font = `${cellH * 0.86}px Menlo, Monaco, 'Courier New', monospace`;
  ctx.textBaseline = "top";
  for (let y = 0; y < text.length; y++) {
    const line = [...text[y]];
    for (let x = 0; x < line.length; x++) {
      if (line[x] === " ") continue;
      const key = color ? color[y]?.[x] : undefined;
      ctx.fillStyle = (key && key !== " " && palette?.[key]) || "#e0e0e0";
      ctx.fillText(line[x], x * cellW, y * cellH);
    }
  }
}
