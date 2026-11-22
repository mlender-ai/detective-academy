// 옆에서 본 학원 복도를 "층"으로 나눠 그린다. B안(플레이 가능한 복도)이 쓴다.
// 벽에 기록 보관함 · 시험 게시판 · 연습실 문 · 승급 시험실 문 · 창이 정면으로 놓이고, 탐정은 그 앞을 좌우로 걷는다.
// 복도는 화면보다 넓어서 카메라가 탐정을 따라 옆으로 민다.
import { fillPoly, gray, lineDots, makeSprite, putDot, rectDots, spriteCanvas, type Sprite } from "./dot";
import { clipTo, toneLayer, tracePath, type Pt } from "./stage";

/** 복도 전체의 폭과 높이(점) */
export const WW = 340;
export const WH = 150;
/** 벽과 바닥이 만나는 줄, 탐정이 걷는 줄 */
export const FLOOR = 104;
export const WALK = 123;

/** 전등은 물건 사이의 빈 벽 앞에 건다. 창 쪽 끝에는 등이 없어 달빛이 보인다. */
export const LAMP_X = [77, 163, 226];

/** 물건의 자리(벽 위의 네모: x, y, w, h) */
export const BOX = {
  archive: [26, 64, 40, FLOOR - 64],
  board: [92, 30, 58, 46],
  practice: [176, 38, 32, FLOOR - 38],
  exam: [244, 32, 40, FLOOR - 32],
  window: [306, 30, 26, 40],
  clock: [38, 28, 15, 15],
  /** 사건 접수함: 창 아래의 낡은 텔레비전과 받침대 */
  case: [305, 78, 24, FLOOR - 78],
} as const;

export interface Placed {
  canvas: HTMLCanvasElement;
  x: number;
  y: number;
}

export interface SideArt {
  tone: Record<string, HTMLCanvasElement>;
  ink: Record<string, Placed>;
}

const placed = (s: Sprite, x = 0, y = 0): Placed => ({ canvas: spriteCanvas(s), x, y });
const layer = (draw: (c: CanvasRenderingContext2D) => void, fill: string | null = "#000") => toneLayer(WW, WH, draw, fill);

const lin = (c: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, stops: [number, number][]) => {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  stops.forEach(([t, v]) => g.addColorStop(t, gray(v)));
  return g;
};

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

/** 등급 글자(5×7점). 승급 시험실 문 위의 표찰에 찍는다. */
const GLYPH: Record<string, string[]> = {
  F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  C: [".####", "#....", "#....", "#....", "#....", "#....", ".####"],
  B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
};

export function rankPlate(rank: string): Placed {
  const s = makeSprite(17, 13);
  rectDots(s, 0, 0, 17, 13, -1);
  rectDots(s, 1, 1, 15, 11, 1);
  const g = GLYPH[rank] ?? GLYPH.S;
  g.forEach((row, y) => {
    for (let x = 0; x < 5; x++) if (row[x] === "#") putDot(s, 6 + x, 3 + y, -1);
  });
  const [x, y, w] = BOX.exam;
  return placed(s, Math.round(x + w / 2 - 8.5), y - 15);
}

/** 벽시계의 바늘 */
export function clockHands(hours: number, minutes: number): Placed {
  const s = makeSprite(15, 15);
  const cx = 7;
  const cy = 7;
  const hand = (turn: number, len: number) => lineDots(s, cx, cy, cx + Math.sin(turn * Math.PI * 2) * len, cy - Math.cos(turn * Math.PI * 2) * len, -1);
  hand(minutes / 60, 5);
  hand(((hours % 12) + minutes / 60) / 12, 3);
  return placed(s, BOX.clock[0], BOX.clock[1]);
}

export function paintSide(): SideArt {
  const tone: Record<string, HTMLCanvasElement> = {};
  const ink: Record<string, Placed> = {};

  // ── 바탕: 벽, 허리 아래, 바닥 ──
  tone.base = layer((c) => {
    c.fillStyle = gray(0.09);
    c.fillRect(0, 0, WW, 78);
    c.fillStyle = gray(0.05);
    c.fillRect(0, 78, WW, FLOOR - 78);
    c.fillStyle = gray(0.02);
    c.fillRect(0, 0, WW, 9);
    c.fillStyle = gray(0.06);
    c.fillRect(0, FLOOR, WW, WH - FLOOR);
    // 융단
    c.fillStyle = gray(0.13);
    c.fillRect(0, 113, WW, 22);
  });

  // ── 전등마다의 빛: 갓에서 바닥으로 퍼지는 원뿔과, 바닥의 빛 웅덩이 ──
  LAMP_X.forEach((x, i) => {
    tone[`lamp${i}`] = layer((c) => {
      const cone: Pt[] = [
        [x - 5, 23],
        [x + 5, 23],
        [x + 50, WH],
        [x - 50, WH],
      ];
      clipTo(c, cone, () => {
        c.globalCompositeOperation = "lighter";
        c.fillStyle = lin(c, 0, 23, 0, WH, [[0, 0.55], [0.5, 0.28], [1, 0.1]]);
        c.fillRect(0, 0, WW, WH);
      });
      clipTo(c, [[0, FLOOR], [WW, FLOOR], [WW, WH], [0, WH]], () => glow(c, x, 124, 40, 10, [[0, 0.5], [0.6, 0.26], [1, 0]]));
      // 벽에 번진 빛
      clipTo(c, [[0, 9], [WW, 9], [WW, FLOOR], [0, FLOOR]], () => glow(c, x, 40, 58, 60, [[0, 0.26], [1, 0]]));
    });
  });

  // ── 게시판 위의 작은 등 ──
  const [bx, by, bw, bh] = BOX.board;
  tone.board = layer((c) => {
    clipTo(c, [[bx, by], [bx + bw, by], [bx + bw, by + bh], [bx, by + bh]], () => {
      glow(c, bx + bw / 2, by - 4, bw * 0.62, bh * 0.7, [[0, 0.62], [0.6, 0.24], [1, 0]]);
    });
  });

  const [px, py, pw, ph] = BOX.practice;
  const [ex, ey, ew, eh] = BOX.exam;

  // ── 문짝과 게시판의 판은 전등 빛을 받아도 어둡다 (곱해서 누른다). 그 위에 유리의 불빛을 다시 더한다. ──
  tone.doors = layer((c) => {
    c.fillStyle = "#000";
    c.fillRect(px, py, pw, ph);
    c.fillRect(ex, ey, ew, eh);
    c.fillRect(bx, by, bw, bh);
  }, "#fff");

  // ── 연습실 문이 열리면: 문 안이 밝고, 바닥에 빛이 쏟아진다 ──
  tone.practiceOpen = layer((c) => {
    c.fillStyle = gray(0.95);
    c.fillRect(px + 1, py + 1, pw - 2, ph - 1);
    c.fillStyle = lin(c, 0, FLOOR, 0, WH, [[0, 0.9], [0.6, 0.45], [1, 0.1]]);
    tracePath(c, [
      [px, FLOOR],
      [px + pw, FLOOR],
      [px + pw + 22, WH],
      [px - 22, WH],
    ]);
    c.fill();
  });
  // 닫혀 있을 때 문의 젖빛 유리로 새는 빛
  tone.practiceGlass = layer((c) => {
    c.fillStyle = gray(0.34);
    c.fillRect(px + 6, py + 8, pw - 12, 20);
  });

  // ── 승급 시험실: 시험을 볼 수 있으면 문 유리와 문틈으로 불빛이 샌다 ──
  tone.examLit = layer((c) => {
    c.fillStyle = gray(0.92);
    c.fillRect(ex + 5, ey + 8, 12, 24);
    c.fillRect(ex + ew - 17, ey + 8, 12, 24);
    // 문 아래 틈
    c.fillRect(ex + 1, FLOOR - 2, ew - 2, 2);
    c.fillStyle = lin(c, 0, FLOOR, 0, FLOOR + 22, [[0, 0.7], [1, 0]]);
    tracePath(c, [
      [ex + 2, FLOOR],
      [ex + ew - 2, FLOOR],
      [ex + ew + 8, FLOOR + 22],
      [ex - 8, FLOOR + 22],
    ]);
    c.fill();
  });
  tone.examDim = layer((c) => {
    c.fillStyle = gray(0.16);
    c.fillRect(ex + 5, ey + 8, 12, 24);
    c.fillRect(ex + ew - 17, ey + 8, 12, 24);
  });

  // ── 창: 블라인드 사이로 든 달빛이 바닥에 비스듬히 눕는다 ──
  const [wx, wy, ww, wh] = BOX.window;
  tone.moon = layer((c) => {
    for (let i = 0; i < 6; i++) {
      const y = FLOOR + 6 + i * 6;
      const x0 = wx - 8 - i * 9;
      c.fillStyle = gray(0.5);
      tracePath(c, [
        [x0, y],
        [x0 + ww + 14, y],
        [x0 + ww + 10, y + 3],
        [x0 - 4, y + 3],
      ]);
      c.fill();
    }
  });
  // 창밖 나뭇가지의 그림자: 달빛 위에서 조금씩 흔들린다 (곱해서 어둡게)
  tone.branch = layer((c) => {
    c.strokeStyle = gray(0.15);
    c.lineWidth = 2.4;
    c.beginPath();
    c.moveTo(wx - 50, FLOOR + 44);
    c.quadraticCurveTo(wx - 20, FLOOR + 20, wx + 16, FLOOR + 12);
    c.moveTo(wx - 24, FLOOR + 26);
    c.lineTo(wx - 14, FLOOR + 40);
    c.moveTo(wx - 6, FLOOR + 18);
    c.lineTo(wx + 4, FLOOR + 30);
    c.stroke();
  }, "#fff");

  // ── 먹선 ──
  const m = makeSprite(WW, WH);
  // 천장 몰딩, 허리 몰딩, 걸레받이, 융단의 가장자리
  rectDots(m, 0, 9, WW, 1, -1);
  lineDots(m, 0, 78, WW - 1, 78, 1, 2);
  rectDots(m, 0, FLOOR - 3, WW, 1, 1);
  rectDots(m, 0, FLOOR, WW, 1, -1);
  rectDots(m, 0, 112, WW, 1, -1);
  rectDots(m, 0, 135, WW, 1, -1);
  // 융단의 술: 두 가장자리 안쪽에 점을 한 줄씩 찍는다
  for (let x = 2; x < WW; x += 4) {
    putDot(m, x, 115, -1);
    putDot(m, x, 132, -1);
  }

  // 기록 보관함: 서랍 세 칸, 위에 쌓인 서류철
  {
    const [x, y, w, h] = BOX.archive;
    rectDots(m, x, y, w, h, -1);
    rectDots(m, x, y, w, 1, 1);
    rectDots(m, x, y, 1, h, 1);
    rectDots(m, x + w - 1, y, 1, h, 1);
    for (let i = 0; i < 3; i++) {
      const dy = y + 3 + i * 12;
      rectDots(m, x + 3, dy, w - 6, 1, 1);
      rectDots(m, x + 3, dy + 9, w - 6, 1, 1);
      rectDots(m, x + 3, dy, 1, 10, 1);
      rectDots(m, x + w - 4, dy, 1, 10, 1);
      rectDots(m, x + w / 2 - 4, dy + 4, 8, 2, 1);
    }
    // 서류철
    rectDots(m, x + 5, y - 9, 12, 9, -1);
    rectDots(m, x + 5, y - 9, 12, 1, 1);
    rectDots(m, x + 5, y - 9, 1, 9, 1);
    rectDots(m, x + 16, y - 9, 1, 9, 1);
    rectDots(m, x + 8, y - 6, 6, 1, 1);
    rectDots(m, x + 20, y - 5, 14, 5, -1);
    rectDots(m, x + 20, y - 5, 14, 1, 1);
    rectDots(m, x + 20, y - 3, 14, 1, 1);
  }

  // 시험 게시판: 틀과 작은 쪽지들 (큰 시험지는 따로 둔다)
  {
    rectDots(m, bx - 3, by - 3, bw + 6, bh + 6, -1);
    rectDots(m, bx, by, bw, bh, 0);
    rectDots(m, bx - 2, by - 2, bw + 4, 1, 1);
    rectDots(m, bx - 2, by + bh + 1, bw + 4, 1, 1);
    rectDots(m, bx - 2, by - 2, 1, bh + 4, 1);
    rectDots(m, bx + bw + 1, by - 2, 1, bh + 4, 1);
    // 작은 등
    rectDots(m, bx + bw / 2 - 7, by - 7, 14, 3, -1);
    rectDots(m, bx + bw / 2 - 7, by - 7, 14, 1, 1);
    rectDots(m, bx + bw / 2 - 1, by - 9, 2, 2, 1);
    // 쪽지들
    const note = (x: number, y: number, w: number, h: number) => {
      rectDots(m, x, y, w, h, 1);
      for (let j = 2; j < h - 1; j += 2) rectDots(m, x + 1, y + j, w - 3, 1, -1);
      putDot(m, x + Math.floor(w / 2), y, -1);
    };
    note(bx + 34, by + 5, 9, 12);
    note(bx + 46, by + 8, 8, 10);
    note(bx + 33, by + 24, 11, 14);
    note(bx + 47, by + 26, 8, 9);
  }

  // 연습실 문: 문틀과 표찰(열쇠)
  {
    rectDots(m, px - 3, py - 3, pw + 6, ph + 3, -1);
    rectDots(m, px, py, pw, ph, 0);
    rectDots(m, px - 2, py - 2, pw + 4, 1, 1);
    rectDots(m, px - 2, py - 2, 1, ph + 2, 1);
    rectDots(m, px + pw + 1, py - 2, 1, ph + 2, 1);
    // 표찰
    const tx = px + pw / 2 - 8;
    const ty = py - 15;
    rectDots(m, tx, ty, 16, 11, -1);
    rectDots(m, tx + 1, ty + 1, 14, 9, 1);
    rectDots(m, tx + 3, ty + 3, 4, 5, -1);
    rectDots(m, tx + 4, ty + 4, 2, 3, 1);
    rectDots(m, tx + 7, ty + 5, 6, 1, -1);
    rectDots(m, tx + 10, ty + 6, 1, 2, -1);
    rectDots(m, tx + 12, ty + 6, 1, 2, -1);
  }

  // 승급 시험실 문: 두 짝 문, 굵은 문틀
  {
    rectDots(m, ex - 4, ey - 4, ew + 8, eh + 4, -1);
    rectDots(m, ex, ey, ew, eh, 0);
    rectDots(m, ex - 3, ey - 3, ew + 6, 1, 1);
    rectDots(m, ex - 3, ey - 3, 1, eh + 3, 1);
    rectDots(m, ex + ew + 2, ey - 3, 1, eh + 3, 1);
    rectDots(m, ex - 1, ey - 1, ew + 2, 1, 1);
    rectDots(m, ex - 1, ey - 1, 1, eh + 1, 1);
    rectDots(m, ex + ew, ey - 1, 1, eh + 1, 1);
    rectDots(m, ex + ew / 2, ey, 1, eh, 1);
    for (const side of [0, 1]) {
      const x0 = ex + (side ? ew - 18 : 4);
      // 유리 테
      rectDots(m, x0, ey + 7, 14, 1, 1);
      rectDots(m, x0, ey + 32, 14, 1, 1);
      rectDots(m, x0, ey + 7, 1, 26, 1);
      rectDots(m, x0 + 13, ey + 7, 1, 26, 1);
      // 아래 판
      rectDots(m, x0, ey + 40, 14, 1, 1);
      rectDots(m, x0, ey + eh - 8, 14, 1, 1);
      rectDots(m, x0, ey + 40, 1, eh - 47, 1);
      rectDots(m, x0 + 13, ey + 40, 1, eh - 47, 1);
    }
    rectDots(m, ex + ew / 2 - 3, ey + 38, 2, 4, 1);
    rectDots(m, ex + ew / 2 + 2, ey + 38, 2, 4, 1);
  }

  // 창과 블라인드
  {
    rectDots(m, wx - 2, wy - 2, ww + 4, wh + 4, -1);
    for (let y = 0; y < wh; y++) if (y % 4 < 2) rectDots(m, wx, wy + y, ww, 1, 1);
    rectDots(m, wx - 2, wy - 2, ww + 4, 1, 1);
    rectDots(m, wx - 2, wy + wh + 1, ww + 4, 1, 1);
    rectDots(m, wx - 2, wy - 2, 1, wh + 4, 1);
    rectDots(m, wx + ww + 1, wy - 2, 1, wh + 4, 1);
    rectDots(m, wx - 4, wy + wh + 3, ww + 8, 2, 1);
  }

  // 벽시계의 판
  {
    const [cx0, cy0] = BOX.clock;
    for (let y = 0; y < 15; y++)
      for (let x = 0; x < 15; x++) {
        const d = Math.hypot(x - 7, y - 7);
        if (d <= 7.4) putDot(m, cx0 + x, cy0 + y, d > 6.3 ? -1 : 1);
      }
    for (const [dx, dy] of [
      [0, -5],
      [5, 0],
      [0, 5],
      [-5, 0],
    ])
      putDot(m, cx0 + 7 + dx, cy0 + 7 + dy, -1);
  }

  // 전등: 줄과 갓
  for (const x of LAMP_X) {
    rectDots(m, x, 10, 1, 8, 1);
    fillPoly(
      m,
      [
        [x - 3, 17],
        [x + 4, 17],
        [x + 8, 23],
        [x - 7, 23],
      ],
      -1,
    );
    lineDots(m, x - 3, 17, x + 3, 17, 1);
    lineDots(m, x - 3, 17, x - 7, 22, 1);
    lineDots(m, x + 3, 17, x + 7, 22, 1);
    rectDots(m, x - 7, 23, 15, 1, 1);
  }
  ink.mid = placed(m);

  // 전구: 켜졌을 때만 보인다
  LAMP_X.forEach((x, i) => {
    const s = makeSprite(5, 2);
    rectDots(s, 0, 0, 5, 2, 1);
    ink[`bulb${i}`] = placed(s, x - 2, 24);
  });

  // 게시판의 큰 시험지(오늘의 사건): 귀퉁이가 팔랑이는 세 장면, 해결하면 가위표가 쳐진다
  for (const solved of [false, true])
    for (let f = 0; f < 3; f++) {
      const s = makeSprite(26, 36);
      rectDots(s, 1, 1, 22, 31, 1);
      rectDots(s, 4, 4, 14, 2, -1);
      for (let j = 0; j < 6; j++) rectDots(s, 4, 9 + j * 3, j % 3 === 2 ? 9 : 16, 1, -1);
      putDot(s, 11, 1, -1);
      putDot(s, 12, 1, -1);
      if (f === 1) {
        putDot(s, 22, 31, 0);
        putDot(s, 23, 30, 1);
      } else if (f === 2) {
        rectDots(s, 21, 30, 2, 2, 0);
        putDot(s, 23, 29, 1);
        putDot(s, 24, 30, 1);
      }
      if (solved) {
        lineDots(s, 5, 22, 18, 29, -1);
        lineDots(s, 5, 23, 18, 30, -1);
        lineDots(s, 18, 22, 5, 29, -1);
        lineDots(s, 18, 23, 5, 30, -1);
      }
      ink[`paper${solved ? "S" : "N"}${f}`] = placed(s, bx + 5, by + 5);
    }

  // 닫힌 연습실 문짝: 유리 테, 아래 판, 손잡이
  {
    const s = makeSprite(pw, ph);
    rectDots(s, 5, 7, pw - 10, 1, 1);
    rectDots(s, 5, 28, pw - 10, 1, 1);
    rectDots(s, 5, 7, 1, 22, 1);
    rectDots(s, pw - 6, 7, 1, 22, 1);
    rectDots(s, 5, 36, pw - 10, 1, 1);
    rectDots(s, 5, ph - 7, pw - 10, 1, 1);
    rectDots(s, 5, 36, 1, ph - 42, 1);
    rectDots(s, pw - 6, 36, 1, ph - 42, 1);
    rectDots(s, pw - 5, 32, 2, 3, 1);
    ink.practiceClosed = placed(s, px, py);
  }
  // 열린 문짝: 안쪽으로 젖혀져 오른쪽 문틀에 가늘게 보인다
  {
    const s = makeSprite(6, ph);
    rectDots(s, 0, 0, 6, ph, -1);
    rectDots(s, 0, 0, 1, ph, 1);
    rectDots(s, 2, 30, 2, 3, 1);
    ink.practiceLeaf = placed(s, px + pw - 6, py);
  }

  // 사건 접수함: 받침대 위의 낡은 텔레비전. 화면은 켜짐(잡음 둘) · 토끼 가면이 스치는 장면 · 꺼짐 네 가지다.
  {
    const [cx, cy, cw, ch] = BOX.case;
    const body = (screen: (s: Sprite) => void) => {
      const s = makeSprite(cw, ch);
      // 안테나
      lineDots(s, 12, 4, 7, 0, 1);
      lineDots(s, 12, 4, 17, 0, 1);
      // 몸통
      rectDots(s, 1, 4, cw - 2, 16, 1);
      rectDots(s, 2, 5, cw - 4, 14, -1);
      // 화면(왼쪽)과 다이얼(오른쪽)
      rectDots(s, 3, 6, 14, 12, 1);
      rectDots(s, 4, 7, 12, 10, -1);
      putDot(s, 19, 8, 1);
      putDot(s, 19, 11, 1);
      rectDots(s, 18, 15, 3, 1, 1);
      screen(s);
      // 받침대
      rectDots(s, 0, 20, cw, 2, 1);
      rectDots(s, 3, 22, 1, ch - 22, 1);
      rectDots(s, cw - 4, 22, 1, ch - 22, 1);
      rectDots(s, 3, 24, cw - 6, 1, 1);
      return placed(s, cx, cy);
    };
    const noise = (seed: number) => (s: Sprite) => {
      for (let y = 0; y < 10; y++) for (let x = 0; x < 12; x++) if ((x * 7 + y * 13 + seed * 5 + ((x * y + seed) % 3)) % 4 === 0) putDot(s, 4 + x, 7 + y, 1);
    };
    ink.caseNoise0 = body(noise(0));
    ink.caseNoise1 = body(noise(1));
    // 잡음 사이로 스치는 것: 긴 귀 둘과 얼굴
    ink.caseMask = body((s) => {
      rectDots(s, 7, 8, 1, 4, 1);
      rectDots(s, 12, 8, 1, 4, 1);
      rectDots(s, 6, 12, 8, 4, 1);
      putDot(s, 8, 13, -1);
      putDot(s, 11, 13, -1);
    });
    // 꺼진 화면: 가운데에 남은 한 점
    ink.caseOff = body((s) => putDot(s, 10, 12, 1));
  }

  // 전경: 양 끝의 기둥. 카메라가 밀릴 때 복도보다 빨리 민다.
  for (const side of [0, 1]) {
    const s = makeSprite(40, WH);
    rectDots(s, 0, 0, 40, WH, -1);
    rectDots(s, side ? 0 : 39, 0, 1, WH, 1);
    rectDots(s, side ? 3 : 36, 0, 1, WH, 1);
    ink[side ? "pillarR" : "pillarL"] = placed(s, side ? WW - 10 : -30, 0);
  }

  return { tone, ink };
}
