// ASCII Magic 실험 페이지. 제품용 조각(src/fx/ascii)과, 원본 조각을 그대로 돌려 점으로 바꾼 것을 나란히 보여 준다.
import { getDailyPuzzle } from "../../src/data/puzzles";
import { buildDemoState, emptyProgress } from "../../src/engine/progressEngine";
import type { PuzzleInput } from "../../src/engine/types";
import { DotCanvas, DotGrid } from "../../src/fx/dots";
import { CANDLE, COIN, HOURGLASS, createRain, drawCandle, drawCoin, drawHourglass } from "../../src/fx/ascii";
import { asciiToDots, drawAscii, type Frame } from "./asciiToDots";

import * as rainyWindow from "ascii-magic-art/pieces/rainy-window.js";
import * as candleFlame from "ascii-magic-art/pieces/candle-flame.js";
import * as pendulumClock from "ascii-magic-art/pieces/pendulum-wall-clock.js";
import * as fireflies from "ascii-magic-art/pieces/fireflies.js";
import * as tvStatic from "ascii-magic-art/pieces/tv-static.js";
import * as rotaryPhone from "ascii-magic-art/pieces/rotary-phone.js";
import * as typewriter from "ascii-magic-art/pieces/typewriter.js";
import * as decodeReveal from "ascii-magic-art/pieces/decode-reveal.js";
import * as countdown from "ascii-magic-art/pieces/countdown-timer.js";
import * as hourglass from "ascii-magic-art/pieces/hourglass.js";
import * as spinningCoin from "ascii-magic-art/pieces/spinning-coin.js";
import * as rotatingStar from "ascii-magic-art/pieces/rotating-star.js";
import * as fireworks from "ascii-magic-art/pieces/fireworks.js";

interface Piece {
  meta: { slug: string; name: string; cols: number; rows: number; fps: number; palette?: Record<string, string> };
  default: () => (t: number) => Frame;
}

const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
const q = new URLSearchParams(location.search);
/** ?t=초 : 그 시각의 한 장면만 그린다(캡처용) */
const fixed = q.has("t") ? Number(q.get("t")) : null;

/** 화면에 보이는 동안에만 도는 그리기 묶음 */
const runners = new Map<Element, (t: number) => void>();
const visible = new Set<Element>();
const io = new IntersectionObserver((entries) => {
  for (const e of entries) (e.isIntersecting ? visible.add(e.target) : visible.delete(e.target));
});
function animate(el: Element, draw: (t: number) => void) {
  runners.set(el, draw);
  io.observe(el);
  draw(fixed ?? 0.8);
}
const t0 = performance.now();
function loop() {
  const t = (performance.now() - t0) / 1000;
  if (!document.hidden) for (const el of visible) runners.get(el)!(t);
  requestAnimationFrame(loop);
}
if (!still && fixed === null) requestAnimationFrame(loop);

const cost = document.getElementById("cost") as HTMLTableElement;
function measure(draw: (t: number) => void, frames = 120) {
  const a = performance.now();
  for (let i = 0; i < frames; i++) draw(i / 15);
  return (performance.now() - a) / frames;
}

/* ───────── 1. 제품용 조각 ───────── */

interface Port {
  name: string;
  from: string;
  where: string;
  w: number;
  h: number;
  draw: (g: DotGrid, t: number) => void;
  /** 되풀이되는 한 바퀴의 장면 수(구운 PNG 의 용량을 어림하는 데 쓴다). 0 이면 되풀이가 없다. */
  loop: number;
  verdict: string;
}

const rain = createRain(26, 28, { lights: 0 });
/** 모래시계: 12초에 한 번 가득에서 빔까지 간다(제품에서는 남은 시간의 비율을 받는다) */
const glassSpent = (t: number) => Math.min(1, ((t % 14) / 12) * 1.0);
/** 주화: 0.6초 뒤에 한 바퀴 돌고 멈춘다. 4초마다 다시 보여 준다(제품에서는 한 번만 돈다) */
const coinStep = (t: number) => Math.max(0, Math.min(COIN.turn, Math.floor(((t % 4) - 0.6) * COIN.rate + 1e-6)));

const PORTS: Port[] = [
  { name: "비 내리는 유리", from: "rainy-window", where: "복도의 창", w: 26, h: 28, draw: rain, loop: 0, verdict: "실행 중에 그린다(되풀이가 없어 구울 수 없다)" },
  { name: "촛불", from: "candle-flame", where: "기록 보관함 위", w: CANDLE.w, h: CANDLE.h, draw: (g, t) => drawCandle(g, t), loop: 0, verdict: "실행 중에 그린다(깜빡임이 잡음이라 되풀이가 없다)" },
  { name: "수사 크레딧 한 닢", from: "spinning-coin (박자만)", where: "채점 결과의 보상 · 한 바퀴 돌고 멈춘다", w: COIN.size, h: COIN.size, draw: (g, t) => drawCoin(g, coinStep(t)), loop: COIN.turn / 2, verdict: "어느 쪽이든 싸다(반 바퀴 12장면). 실행 중에 그린다" },
  { name: "모래시계", from: "hourglass (구성만)", where: "제한 시간 시험의 위 막대 · 제품에 놓이는 크기", w: HOURGLASS.w, h: HOURGLASS.h, draw: (g, t) => drawHourglass(g, glassSpent(t), t), loop: 0, verdict: "실행 중에 그린다(남은 시간을 따라 달라진다)" },
];

const portsBox = document.getElementById("ports")!;
for (const port of PORTS) {
  const grid = new DotGrid(port.w, port.h);
  const fig = document.createElement("figure");
  fig.className = "port";
  const row = document.createElement("div");
  row.className = "port__row";
  const small = document.createElement("canvas");
  const big = document.createElement("canvas");
  small.style.width = `${port.w * 2}px`;
  small.style.height = `${port.h * 2}px`;
  big.style.width = `${port.w * 6}px`;
  big.style.height = `${port.h * 6}px`;
  const dc = new DotCanvas(small, grid);
  big.width = port.w;
  big.height = port.h;
  const bctx = big.getContext("2d")!;
  row.append(small, big);
  const ms = measure((t) => {
    port.draw(grid, t);
    dc.draw();
  });
  // 구운 PNG 한 바퀴의 용량: 실제로 한 바퀴를 한 장(가로로 이어 붙인 띠)에 그려 PNG 로 만들어 본다
  let baked = "–";
  if (port.loop) {
    const sheet = document.createElement("canvas");
    sheet.width = port.w * port.loop;
    sheet.height = port.h;
    const sctx = sheet.getContext("2d")!;
    // 되풀이되는 것은 주화뿐이다: 반 바퀴의 장면을 차례로 굽는다
    for (let i = 0; i < port.loop; i++) {
      drawCoin(grid, i);
      dc.draw();
      sctx.drawImage(small, i * port.w, 0);
    }
    baked = `${(atob(sheet.toDataURL("image/png").split(",")[1]).length / 1024).toFixed(1)} KB (${port.loop}장면)`;
  }
  const cap = document.createElement("figcaption");
  cap.innerHTML = `<b></b><span></span>`;
  cap.querySelector("b")!.textContent = port.name;
  cap.querySelector("span")!.textContent = `원본 ${port.from} · ${port.where} · ${port.w}×${port.h}점 · ${ms.toFixed(3)}ms`;
  fig.append(row, cap);
  portsBox.append(fig);
  animate(fig, (t) => {
    port.draw(grid, t);
    dc.draw();
    bctx.drawImage(small, 0, 0);
  });
  const tr = cost.insertRow();
  for (const [text, num] of [[port.name, 0], [`${port.w}×${port.h}`, 0], [ms.toFixed(3), 1], [`${Math.round(1000 / ms).toLocaleString()}`, 1], [baked, 1], [port.verdict, 0]] as const) {
    const td = tr.insertCell();
    td.textContent = text;
    if (num) td.className = "num";
  }
}

/* ───────── 3. 원본과 변환 결과 ───────── */

const GROUPS: [string, Piece[]][] = [
  ["환경", [rainyWindow, candleFlame, pendulumClock, fireflies, tvStatic] as unknown as Piece[]],
  ["인터랙션", [rotaryPhone, countdown, hourglass, typewriter, decodeReveal] as unknown as Piece[]],
  ["보상", [spinningCoin, rotatingStar, fireworks] as unknown as Piece[]],
];
const pairsBox = document.getElementById("pairs")!;
for (const [label, pieces] of GROUPS) {
  const head = document.createElement("p");
  head.className = "group";
  head.textContent = label;
  const wrap = document.createElement("div");
  wrap.className = "pairs";
  pairsBox.append(head, wrap);
  for (const piece of pieces) {
    const { cols, rows, palette, slug, name } = piece.meta;
    const draw = piece.default();
    const k = Math.max(2, Math.floor(280 / cols)); // 점 하나의 크기(px)
    const fig = document.createElement("figure");
    fig.className = "pair";
    const row = document.createElement("div");
    row.className = "pair__row";
    const left = document.createElement("canvas");
    left.width = cols * k * 2;
    left.height = rows * k * 4;
    left.style.width = `${cols * k}px`;
    left.style.height = `${rows * k * 2}px`;
    left.style.imageRendering = "auto";
    const lctx = left.getContext("2d")!;
    const right = document.createElement("canvas");
    right.style.width = `${cols * k}px`;
    right.style.height = `${rows * k * 2}px`;
    const grid = new DotGrid(cols, rows * 2);
    const dc = new DotCanvas(right, grid);
    row.append(left, right);
    let frame = draw(0.8);
    const ms = measure((t) => {
      frame = draw(t);
      asciiToDots(frame, palette, grid);
      dc.draw();
    }, 40);
    const cap = document.createElement("figcaption");
    cap.style.maxWidth = "none";
    cap.innerHTML = `<b></b><span></span>`;
    cap.querySelector("b")!.textContent = `${name} (${slug})`;
    cap.querySelector("span")!.textContent = `글자 ${cols}×${rows}칸 → 점 ${cols}×${rows * 2} · 그리기와 변환 ${ms.toFixed(2)}ms/장면`;
    fig.append(row, cap);
    wrap.append(fig);
    animate(fig, (t) => {
      frame = draw(t);
      drawAscii(frame, palette, lctx, k * 2, k * 4);
      asciiToDots(frame, palette, grid);
      dc.draw();
    });
  }
}

/* ───────── 2. 제품 화면 비교 ───────── */

const SCENES = [
  { id: "home", label: "복도(홈)", preset: "daily-unsolved", hash: "" },
  { id: "home-d", label: "복도 · D급", preset: "promoted", hash: "" },
  { id: "result", label: "채점 결과(보상) · 금고 앞으로 → 제출", preset: "daily-unsolved", hash: "daily", solve: true },
  { id: "exam", label: "제한 시간 시험", preset: "ready-b", hash: "exam" },
];
let scene = SCENES[0];
let size = "390x844";
const before = document.getElementById("before") as HTMLIFrameElement;
const after = document.getElementById("after") as HTMLIFrameElement;
const DATE = "2026-11-22";
const url = (fx: boolean) => {
  const save = `fx-${scene.id}-${fx ? "on" : "off"}`;
  const p = new URLSearchParams({ demo: "1", save, cine: "0", date: DATE });
  if ("solve" in scene && scene.solve) {
    // 보상은 문제를 푸는 순간에만 나온다: 답을 미리 넣어 둔 상태를 만들어, 금고 앞에서 제출만 누르면 되게 한다
    const state = buildDemoState("daily-unsolved", new Date(`${DATE}T12:00:00+09:00`));
    const daily = getDailyPuzzle(DATE);
    if (daily.type !== "code") throw new Error("보상 장면은 첫날의 암호 문제로 본다");
    const input: PuzzleInput = { type: "code", dials: [...daily.solution], memo: {} };
    state.puzzles[daily.id] = { ...emptyProgress(), status: "in_progress", input };
    try {
      for (const key of Object.keys(localStorage)) if (key.startsWith(`detective-academy:v1:${save}:`)) localStorage.removeItem(key);
      localStorage.setItem(`detective-academy:v1:${save}`, JSON.stringify(state));
    } catch {}
  } else {
    p.set("preset", scene.preset);
    p.set("apply", "1");
  }
  if (fx) p.set("fx", "ascii");
  return `../../index.html?${p}${scene.hash ? `#/${scene.hash}` : ""}`;
};
function show() {
  const [w, h] = size.split("x").map(Number);
  for (const [frame, fx] of [[before, false], [after, true]] as const) {
    frame.width = String(w);
    frame.height = String(h);
    frame.src = url(fx);
  }
}
const sceneBox = document.getElementById("scene")!;
for (const s of SCENES) {
  const b = document.createElement("button");
  b.textContent = s.label;
  b.setAttribute("aria-pressed", String(s === scene));
  b.addEventListener("click", () => {
    scene = s;
    for (const other of sceneBox.querySelectorAll("button")) other.setAttribute("aria-pressed", String(other === b));
    show();
  });
  sceneBox.append(b);
}
const sizeBox = document.getElementById("size")!;
sizeBox.addEventListener("click", (e) => {
  const b = (e.target as HTMLElement).closest("button");
  if (!b) return;
  for (const other of sizeBox.querySelectorAll("button")) other.setAttribute("aria-pressed", String(other === b));
  size = b.dataset.v!;
  show();
});
if (!q.has("noframes")) show();
