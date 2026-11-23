// Godot 실험용 에셋을 굽는다. 제품의 장면 코드를 그대로 불러 쓴다(다시 그리지 않는다).
//  - 밝기 층: 회색조 PNG (복도 340×150점, 자료실 216×104점)
//  - 먹 층: 흰 점(#f1f1ea) · 검은 점 · 투명 PNG 와 놓을 자리
//  - 탐정: 키 60점(복도)·46점(자료실)의 대기·걷기·살피기·손 뻗기·모자 인사 장면을 한 장에 모은 그림과 차례표
//  - 견줄 기준 장면: 제품의 Stage 가 그린 결과 그대로(시각을 고정해서)
// 결과는 window.__bake 에 담는다. 파일로 받는 것은 bake.mjs 가 한다.
import { detectiveSprite, shadowRadius, type Action } from "../../src/scene/detective";
import { BAYER4, INK_RGB, spriteCanvas, type Sprite } from "../../src/scene/dot";
import { BRACKET, cornerBrackets } from "../../src/scene/marks";
import { BOX, FLOOR, LAMP_X, WALK, WH, WW, clockHands, paintSide, rankPlate } from "../../src/scene/sideArt";
import { SideScene } from "../../src/scene/sideScene";
import { Stage } from "../../src/scene/stage";
import { V_BOX, V_FLOOR, V_LAMP, V_WALK, VH, VW, paintVault } from "../../src/scene/vaultArt";
import { VaultScene } from "../../src/scene/vaultScene";
import { DAILY_CODE } from "../../src/data/puzzles";
import { vaultStory } from "../../src/screens/codeux/story";

const TAU = Math.PI * 2;
const out = document.getElementById("out")!;

/** 파일 이름 → PNG(data URL) */
const files: Record<string, string> = {};
/** 파일 이름 → JSON 으로 쓸 값 */
const json: Record<string, unknown> = {};

function show(title: string, canvases: [string, HTMLCanvasElement][], scale = 2) {
  const h = document.createElement("h2");
  h.textContent = title;
  out.append(h);
  for (const [name, c] of canvases) {
    const fig = document.createElement("figure");
    const copy = document.createElement("canvas");
    copy.width = c.width;
    copy.height = c.height;
    copy.getContext("2d")!.drawImage(c, 0, 0);
    copy.style.width = `${c.width * scale}px`;
    copy.style.height = `${c.height * scale}px`;
    const cap = document.createElement("figcaption");
    cap.textContent = `${name} ${c.width}×${c.height}`;
    fig.append(copy, cap);
    out.append(fig);
  }
}

const png = (c: HTMLCanvasElement) => c.toDataURL("image/png");

/* ───────── 장면의 층 ───────── */

type Placed = { canvas: HTMLCanvasElement; x: number; y: number };

/**
 * 밝기 층을 합치는 차례대로 세로로 이어 붙인 한 장. Godot 가 이 한 장을 층 묶음(Texture2DArray)으로 가져온다:
 * 실행할 때 그림을 다시 읽어 묶을 필요가 없다. 층 하나하나의 PNG 는 눈으로 보는 용도로 프로젝트 밖(ref/tone)에 둔다.
 */
function bakeToneStrip(dir: string, tone: Record<string, HTMLCanvasElement>, order: string[]) {
  const first = tone[order[0]];
  const strip = document.createElement("canvas");
  strip.width = first.width;
  strip.height = first.height * order.length;
  const ctx = strip.getContext("2d")!;
  order.forEach((name, i) => ctx.drawImage(tone[name], 0, i * first.height));
  files[`${dir}/tone_layers.png`] = png(strip);
}

function bakeLayers(dir: string, tone: Record<string, HTMLCanvasElement>, ink: Record<string, Placed>) {
  const inkMeta: Record<string, { x: number; y: number; w: number; h: number }> = {};
  for (const [name, c] of Object.entries(tone)) files[`ref/tone/${dir}/${name}.png`] = png(c);
  for (const [name, p] of Object.entries(ink)) {
    files[`${dir}/ink/${name}.png`] = png(p.canvas);
    inkMeta[name] = { x: p.x, y: p.y, w: p.canvas.width, h: p.canvas.height };
  }
  show(`${dir} · 밝기 층`, Object.entries(tone), 1);
  show(
    `${dir} · 먹 층`,
    Object.entries(ink).map(([n, p]) => [n, p.canvas] as [string, HTMLCanvasElement]),
    1,
  );
  return inkMeta;
}

// 복도
const side = paintSide();
// 문 위의 표찰: F급 견습 탐정이 보는 다음 등급 글자(D)와, 견줄 때 쓸 나머지 글자
for (const rank of ["D", "C", "B", "A", "S"]) side.ink[`plate${rank}`] = rankPlate(rank);
const sideInk = bakeLayers("corridor", side.tone, side.ink);

type Box = readonly [number, number, number, number];
const grow = (b: Box, pad: number): Box => [b[0] - pad, b[1] - pad, b[2] + pad * 2, b[3] + pad * 2];

// 설 자리·누를 영역은 src/scene/sideScene.ts 의 SPOTS 와 같은 식이다(그 표는 모듈 밖으로 나오지 않아 같은 식을 옮겨 적었다).
const SIDE_SPOTS = {
  archive: { x: BOX.archive[0] + BOX.archive[2] + 11, hit: [18, 22, 66, 86], frame: grow(BOX.archive, 8), arrive: "examine", face: -Math.PI / 2 },
  board: { x: BOX.board[0] - 3, hit: [84, 16, 74, 92], frame: grow(BOX.board, 9), arrive: "interact", face: 0 },
  practice: { x: BOX.practice[0] + BOX.practice[2] / 2, hit: [166, 16, 52, 92], frame: grow(BOX.practice, 9), arrive: "idle", face: 0 },
  exam: { x: BOX.exam[0] + BOX.exam[2] / 2, hit: [234, 10, 60, 98], frame: grow(BOX.exam, 10), arrive: "idle", face: 0 },
};

const SIDE_TONE: [string, string][] = [
  ["base", "over"],
  ["lamp0", "add"],
  ["lamp1", "add"],
  ["lamp2", "add"],
  ["doors", "mul"],
  ["board", "add"],
  ["practiceGlass", "add"],
  ["practiceOpen", "add"],
  ["examDim", "add"],
  ["examLit", "add"],
  ["moon", "add"],
  ["branch", "mul"],
];
bakeToneStrip("corridor", side.tone, SIDE_TONE.map(([name]) => name));

json["corridor/scene.json"] = {
  size: [WW, WH],
  floor: FLOOR,
  walk: WALK,
  lampX: LAMP_X,
  box: BOX,
  spots: SIDE_SPOTS,
  homeX: 152,
  viewW: 216,
  detectiveH: 60,
  shadow: shadowRadius(60),
  bracket: BRACKET,
  ink: sideInk,
  // 밝기 층을 합치는 차례 (src/scene/sideScene.ts 의 frame() 과 같다)
  toneOrder: SIDE_TONE,
  bayer4: BAYER4,
  ink_rgb: INK_RGB,
};

// 자료실
const vault = paintVault();
const vaultInk = bakeLayers("vault", vault.tone, vault.ink);
const VAULT_SPOTS = {
  desk: {
    x: V_BOX.sheet[0] - 10,
    hit: [54, 26, 68, 72],
    frame: grow([V_BOX.desk[0], V_BOX.sheet[1], V_BOX.desk[2], V_BOX.desk[1] + V_BOX.desk[3] - V_BOX.sheet[1]], 7),
    arrive: "interact",
  },
  safe: { x: V_BOX.safe[0] + 9, hit: [142, 16, 62, 82], frame: grow(V_BOX.safe, 8), arrive: "interact" },
};
const VAULT_TONE: [string, string][] = [
  ["base", "over"],
  ["lamp0", "add"],
  ["lamp1", "add"],
  ["dark", "mul"],
  ["steel", "add"],
  ["deskLamp", "add"],
  ["safeAjar", "add"],
  ["safeOpen", "add"],
];
bakeToneStrip("vault", vault.tone, VAULT_TONE.map(([name]) => name));

json["vault/scene.json"] = {
  size: [VW, VH],
  floor: V_FLOOR,
  walk: V_WALK,
  lampX: V_LAMP,
  box: V_BOX,
  spots: VAULT_SPOTS,
  doorX: V_BOX.door[0] + 8,
  detectiveH: 46,
  shadow: shadowRadius(46),
  ink: vaultInk,
  toneOrder: VAULT_TONE,
};

/* ───────── 모서리 괄호 ───────── */
{
  const list = cornerBrackets();
  list.forEach((c, i) => (files[`common/bracket${i}.png`] = png(c)));
  show(
    "모서리 괄호",
    list.map((c, i) => [`bracket${i}`, c] as [string, HTMLCanvasElement]),
    3,
  );
}

/* ───────── 발밑 그림자 ─────────
   제품의 Stage 는 밝기 층 위에 검은 타원을 불투명도 0.7 로 깐다. 같은 타원을 투명 바탕에 그려 알파로 굽는다. */
function bakeShadow(h: number) {
  const [rx, ry] = shadowRadius(h);
  const w = Math.ceil(rx) * 2 + 4;
  const hh = Math.ceil(ry) * 2 + 4;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = hh;
  const ctx = c.getContext("2d")!;
  ctx.globalAlpha = 0.7;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.ellipse(w / 2, hh / 2, rx, ry, 0, 0, TAU);
  ctx.fill();
  files[`common/shadow${h}.png`] = png(c);
  return { w, h: hh, cx: w / 2, cy: hh / 2 };
}
const shadowMeta = { 60: bakeShadow(60), 46: bakeShadow(46) };

/* ───────── 탐정 ───────── */

const spriteKey = (s: Sprite) => `${s.w}x${s.h}:${Array.from(s.px).join("")}`;

/**
 * 한 키(h)의 장면들을 한 장에 모은다. 같은 그림은 한 번만 싣고, 동작마다 [칸 번호, 머무는 길이(1/12초)] 차례표를 낸다.
 * 걷기는 열여섯 방향 × 열두 장면을 그대로(걸음의 위상은 걸은 거리에 맞추므로 Godot 쪽에서 장면 번호를 직접 고른다).
 */
function bakeDetective(h: number, withSuccess: boolean, loopDirs: number[]) {
  const cells: Sprite[] = [];
  const index = new Map<string, number>();
  const cell = (s: Sprite) => {
    const key = spriteKey(s);
    let i = index.get(key);
    if (i === undefined) {
      i = cells.length;
      cells.push(s);
      index.set(key, i);
    }
    return i;
  };
  const anims: Record<string, [number, number][]> = {};
  const push = (name: string, i: number) => {
    const list = (anims[name] ??= []);
    const last = list[list.length - 1];
    if (last && last[0] === i) last[1] += 1;
    else list.push([i, 1]);
  };
  const dirAngle = (dir: number) => (dir * TAU) / 16;

  // 걷기: 방향마다 12장면
  for (let dir = 0; dir < 16; dir++) for (let f = 0; f < 12; f++) push(`walk_${dir}`, cell(detectiveSprite(h, { action: "walk", t: f / 12, facing: dirAngle(dir) })));

  const timed = (name: string, action: Action, dir: number, frames: number) => {
    for (let f = 0; f <= frames; f++) push(name, cell(detectiveSprite(h, { action, t: f / 12, facing: dirAngle(dir) })));
  };
  // 서 있기: 숨(3.4초)·무게 중심(6.2초)·옷자락(4.6초)의 느린 움직임이라 되풀이되는 주기가 없다.
  // 60초 치를 다 구우면 거의 모든 장면이 서로 달라 그림이 1,386칸(984×3944px)이 된다(실제로 구워 보았다).
  // 그래서 6.8초(숨 두 번)만 굽는다: 이음매에서 어긋나는 양은 0.2점 아래다. 잠깐만 보이는 방향은 한 장면만 둔다.
  const IDLE_LOOP = Math.round(6.8 * 12);
  for (const dir of loopDirs) timed(`idle_${dir}`, "idle", dir, IDLE_LOOP - 1);
  for (const dir of [0, 4, 8, 12]) if (!loopDirs.includes(dir)) timed(`idle_${dir}`, "idle", dir, 0);
  // 손 뻗기(등을 보인다), 살피기(왼쪽·오른쪽을 본다): 제품은 2.4초 뒤 서 있는 자세로 돌아간다
  timed("interact_0", "interact", 0, 29);
  timed("examine_12", "examine", 12, 29);
  timed("examine_4", "examine", 4, 29);
  // 모자 인사(금고가 열렸을 때)
  if (withSuccess) timed("success_0", "success", 0, 12 * 4);

  const w = cells[0].w;
  const hh = cells[0].h;
  for (const s of cells) if (s.w !== w || s.h !== hh || s.ax !== cells[0].ax || s.ay !== cells[0].ay) throw new Error("탐정 그림의 크기가 장면마다 다르다");
  const cols = 24;
  const rows = Math.ceil(cells.length / cols);
  const sheet = document.createElement("canvas");
  sheet.width = cols * w;
  sheet.height = rows * hh;
  const ctx = sheet.getContext("2d")!;
  cells.forEach((s, i) => ctx.drawImage(spriteCanvas(s), (i % cols) * w, Math.floor(i / cols) * hh));
  files[`detective/h${h}.png`] = png(sheet);
  json[`detective/h${h}.json`] = { h, cell: [w, hh], anchor: [cells[0].ax, cells[0].ay], cols, count: cells.length, fps: 12, anims, shadow: shadowMeta[h as 60 | 46] };
  show(`탐정 h=${h} · ${cells.length}칸`, [[`h${h}`, sheet]], 1);
}
// 복도에서는 등을 보이거나(게시판·문) 왼쪽을 보고(보관함) 서 있고, 자료실에서는 등을 보이고 서 있다
bakeDetective(60, false, [0, 12]);
bakeDetective(46, true, [0]);

/* ───────── 문제 자료 ───────── */
{
  const p = DAILY_CODE;
  const story = vaultStory(p);
  // 시도 기록의 글은 src/games/CodeBreaker/CodeBreaker.tsx 의 clueText 와 같은 규칙이다(Godot 쪽에서 같은 규칙으로 만든다).
  json["data/puzzle.json"] = {
    id: p.id,
    type: p.type,
    title: p.title,
    typeLabel: p.typeLabel,
    difficulty: p.difficulty,
    description: p.description,
    rules: p.rules,
    hints: p.hints.map((h) => h.text),
    explanation: p.explanation.map((e) => e.text),
    solution: p.solution,
    reward: p.reward,
    story,
  };
}

/* ───────── 견줄 기준 장면 ─────────
   제품의 SideScene·VaultScene 과 Stage 가 그린 결과 그대로. 벽시계는 실제 시각이라 23:40 으로 고정한다. */
const RealDate = Date;
class FixedDate extends RealDate {
  constructor() {
    super(2026, 10, 22, 23, 40, 0);
  }
}

function withFixedClock<T>(fn: () => T): T {
  (globalThis as unknown as { Date: unknown }).Date = FixedDate;
  try {
    return fn();
  } finally {
    (globalThis as unknown as { Date: unknown }).Date = RealDate;
  }
}

const refs: Record<string, unknown> = {};
const refCanvases: [string, HTMLCanvasElement][] = [];

function sideRef(name: string, at: "board" | "practice" | "exam" | "archive" | null, seconds: number, state: Partial<SideScene["state"]> = {}) {
  const scene = new SideScene();
  // 390px 폭 화면에서 보이는 영역(점): 캔버스 432px 가 가운데 놓이고 왼쪽 22px 가 잘린다
  scene.setView({ x0: 11, y0: 0, x1: 206, y1: WH });
  scene.state = { dailySolved: false, examRank: "D", examOpen: false, mark: null, ...state };
  if (at) {
    scene.go(at);
    scene.skip();
  }
  // 카메라가 자리 잡고 동작이 펼쳐지도록 1/60초씩 굴린다
  const steps = Math.round(seconds * 60);
  for (let i = 0; i < steps; i++) scene.update(1 / 60);
  const canvas = document.createElement("canvas");
  const stage = new Stage(canvas, scene.w, scene.h);
  withFixedClock(() => stage.draw(scene.frame()));
  files[`ref/${name}.png`] = png(canvas);
  refs[name] = { scene: "corridor", at, seconds, state: scene.state, clock: [23, 40] };
  refCanvases.push([name, canvas]);
}
// 들어선 직후(정면을 보고 선 첫 장면). 정면으로 서 있는 자세는 한 장면만 구웠다.
sideRef("corridor-home", null, 0);
sideRef("corridor-board", "board", 2, { mark: null });
sideRef("corridor-practice", "practice", 2, { mark: "board" });
sideRef("corridor-exam", "exam", 2, { mark: "board" });
sideRef("corridor-archive", "archive", 2, { mark: "board" });
sideRef("corridor-board-solved", "board", 4, { dailySolved: true });

function vaultRef(name: string, at: "desk" | "safe" | null, seconds: number, state: Partial<VaultScene["state"]> = {}) {
  const scene = new VaultScene();
  scene.state = { open: false, mark: null, ...state };
  if (at) {
    scene.go(at);
    scene.skip();
  }
  const steps = Math.round(seconds * 60);
  for (let i = 0; i < steps; i++) scene.update(1 / 60);
  const canvas = document.createElement("canvas");
  const stage = new Stage(canvas, scene.w, scene.h);
  stage.draw(scene.frame());
  files[`ref/${name}.png`] = png(canvas);
  refs[name] = { scene: "vault", at, seconds, state: scene.state };
  refCanvases.push([name, canvas]);
}
vaultRef("vault-door", null, 0);
vaultRef("vault-desk", "desk", 2, { mark: "safe" });
vaultRef("vault-safe", "safe", 2, { mark: "desk" });
vaultRef("vault-open", "safe", 2, { open: true });
json["ref/refs.json"] = refs;
show("견줄 기준 장면 (제품의 Stage 가 그린 것)", refCanvases, 2);

// 벽시계 바늘 한 장(23:40): Godot 쪽에서 같은 식으로 찍은 것과 견준다
withFixedClock(() => {
  const hands = clockHands(23, 40);
  files["ref/clock-2340.png"] = png(hands.canvas);
});

/* ───────── 작은 꼬리말 글꼴(갈무리11 12px)을 비트맵 글꼴로 굽는다 ─────────
   Godot 4.7.2 는 갈무리11 의 WOFF2 를 열지 못했다(FreeType 오류). TTF 는 열리지만 5.4MB 다.
   그래서 브라우저가 12px 로 찍은 글자를 그대로 모아 AngelCode BMFont(.fnt + PNG)로 굽는다: Godot 가 그대로 가져온다.
   글자는 ASCII 와 KS X 1001 의 한글 2,350자, 그리고 화면에 쓰는 기호 몇 개다. */
const text: Record<string, string> = {};

async function bakeBitmapFont(name: string, url: string, size: number) {
  let soft = 0;
  const family = `${name}Bake`;
  const face = new FontFace(family, `url(${url})`);
  await face.load();
  document.fonts.add(face);

  const chars: string[] = [];
  for (let c = 0x20; c <= 0x7e; c++) chars.push(String.fromCharCode(c));
  const euckr = new TextDecoder("euc-kr");
  for (let hi = 0xb0; hi <= 0xc8; hi++) for (let lo = 0xa1; lo <= 0xfe; lo++) chars.push(euckr.decode(new Uint8Array([hi, lo])));
  chars.push(..."·…「」▶■□▼×○△※→←↑↓–—");

  // 글자는 K배로 크게 찍어 칸마다 가운데 한 점을 읽는다. 제 크기(12px)로 찍으면 맥의 글자 다듬기 때문에
  // 가장자리가 흐려져(글자마다 60점쯤) 문턱값에 따라 획이 달라진다. K배에서는 획의 모서리가 화소에 딱 맞는다.
  const K = 4;
  const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
  probe.font = `${size * K}px ${family}`;
  const box = probe.measureText("한글Ag");
  const ascent = Math.round(box.fontBoundingBoxAscent / K);
  const descent = Math.round(box.fontBoundingBoxDescent / K);
  const cw = size + 2;
  const ch = ascent + descent;
  probe.canvas.width = cw * K;
  probe.canvas.height = ch * K;

  /** 글자 하나를 찍어 켜진 점을 돌려준다 */
  const stamp = (c: string, fallback: string) => {
    probe.clearRect(0, 0, cw * K, ch * K);
    probe.font = `${size * K}px ${family}, ${fallback}`;
    probe.textBaseline = "alphabetic";
    probe.fillStyle = "#fff";
    probe.fillText(c, 0, ascent * K);
    const data = probe.getImageData(0, 0, cw * K, ch * K).data;
    const on = new Uint8Array(cw * ch);
    for (let y = 0; y < ch; y++)
      for (let x = 0; x < cw; x++) {
        const a = data[((y * K + K / 2) * cw * K + x * K + K / 2) * 4 + 3];
        // 칸의 가운데가 흐리면(0 도 255 도 아니면) 획이 격자에 맞지 않은 것이다
        if (a > 8 && a < 247) soft++;
        on[y * cw + x] = a > 127 ? 1 : 0;
      }
    return on;
  };

  const kept: { c: string; on: Uint8Array; advance: number }[] = [];
  for (const c of chars) {
    // 이 글꼴에 없는 글자는 다른 글꼴로 찍힌다: 대신 찍힐 글꼴을 바꿔도 모양이 같은 것만 싣는다
    const a = stamp(c, "serif");
    const b = stamp(c, "monospace");
    if (a.some((v, i) => v !== b[i])) continue;
    probe.font = `${size * K}px ${family}`;
    const advance = Math.round(probe.measureText(c).width / K);
    if (c !== " " && !a.some((v) => v)) continue;
    kept.push({ c, on: a, advance });
  }

  const cols = 64;
  const rows = Math.ceil(kept.length / cols);
  const sheet = document.createElement("canvas");
  sheet.width = cols * cw;
  sheet.height = rows * ch;
  const sctx = sheet.getContext("2d")!;
  const im = sctx.createImageData(sheet.width, sheet.height);
  const lines = [
    `info face="${name}" size=${size} bold=0 italic=0 charset="" unicode=1 stretchH=100 smooth=0 aa=0 padding=0,0,0,0 spacing=0,0`,
    `common lineHeight=${ch} base=${ascent} scaleW=${sheet.width} scaleH=${sheet.height} pages=1 packed=0`,
    `page id=0 file="${name.toLowerCase()}_${size}.png"`,
    `chars count=${kept.length}`,
  ];
  kept.forEach((g, i) => {
    const x0 = (i % cols) * cw;
    const y0 = Math.floor(i / cols) * ch;
    for (let y = 0; y < ch; y++)
      for (let x = 0; x < cw; x++) {
        if (!g.on[y * cw + x]) continue;
        const o = ((y0 + y) * sheet.width + x0 + x) * 4;
        im.data[o] = im.data[o + 1] = im.data[o + 2] = im.data[o + 3] = 255;
      }
    lines.push(`char id=${g.c.codePointAt(0)} x=${x0} y=${y0} width=${cw} height=${ch} xoffset=0 yoffset=0 xadvance=${g.advance} page=0 chnl=15`);
  });
  sctx.putImageData(im, 0, 0);
  const base = `font/${name.toLowerCase()}_${size}`;
  files[`${base}.png`] = png(sheet);
  text[`${base}.fnt`] = lines.join("\n") + "\n";
  show(`${name} ${size}px 비트맵 글꼴 · ${kept.length}자 (올림 ${ascent} · 내림 ${descent}, 격자에 맞지 않은 점 ${soft}개)`, [[`${name}_${size}`, sheet]], 1);
  return { glyphs: kept.length, ascent, descent, soft };
}

const fontMeta = await bakeBitmapFont("Galmuri11", "/node_modules/galmuri/dist/Galmuri11.woff2", 12);
json["font/galmuri11_12.json"] = fontMeta;

(window as unknown as { __bake: unknown }).__bake = { files, json, text };
document.title = `구움: PNG ${Object.keys(files).length} · JSON ${Object.keys(json).length}`;
