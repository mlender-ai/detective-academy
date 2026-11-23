// 쿼터뷰 자료실: 암호 해독을 푸는 방. 왼쪽 벽의 서류 선반, 그 앞의 책상(시도 기록과 메모), 오른쪽 벽의 금고(자물쇠).
// 책상과 금고 사이를 오가며 푼다. 정답이면 금고가 열린다. 풀이 화면의 위쪽 띠에 놓이므로 방이 작다(4×3 칸).
import { hitOf, type Blocker, type Lamp, type SpotDef } from "./hallArt";
import { Iso, Layer, box, stampFace, type Footprint, type Piece } from "./iso";
import { RoomScene, paintHangingLamp, paintShell, pieceOf, rectOf, type RoomDef, type RoomProp, type Shell } from "./room";

export type VaultSpot = "desk" | "safe";

export interface VaultState {
  /** 금고가 열렸는가 */
  open: boolean;
  mark?: VaultSpot | null;
}

const W = 196;
const H = 142;
const ISO = new Iso(90, 78);
const LAMPS: Lamp[] = [
  { x: 1.1, y: 1.8, z: 3.3, floor: 1.05, floorR: 2.0, wall: 0.55, wallR: 2.8 },
  { x: 3.0, y: 0.9, z: 3.3, floor: 0.85, floorR: 1.7, wall: 0.5, wallR: 2.4 },
];
const DESK: Footprint = { x0: 0.375, y0: 1.25, x1: 1.625, y1: 2.0 };
const SAFE = { x0: 2.25, x1: 3.75, h: 2.0 };
const SHADOWS: Blocker[] = [{ ...DESK, h: 1 }];

/** 서류 선반 (40×38점): 칸마다 꽂힌 서류철과 상자 */
function shelfFlat() {
  const L = new Layer(40, 38);
  L.rect(0, 0, 40, 38, 0);
  L.frame(0, 0, 40, 38, 1);
  for (const y of [12, 25]) L.rectInk(1, y, 38, 1, 1);
  // 서류철: 높이가 조금씩 다른 흰 등
  const row = (top: number, seed: number) => {
    let x = 3;
    for (let n = 0; x < 36; n++) {
      const tall = 6 + ((n * 7 + seed) % 4);
      const wide = 1 + ((n + seed) % 2);
      if ((n + seed) % 5 !== 3) L.rectInk(x, top + 11 - tall, wide, tall, 1);
      x += wide + 1 + ((n * 3 + seed) % 2);
    }
  };
  row(1, 1);
  row(13, 4);
  // 맨 아래 칸: 상자 둘
  L.frame(4, 29, 12, 8, 1);
  L.rectInk(8, 32, 4, 1, 1);
  L.frame(20, 30, 14, 7, 1);
  L.rectInk(25, 33, 4, 1, 1);
  return L;
}

/** 금고의 문 (24×32점). 열리면 안의 장부가 보인다. */
function safeFlat(open: boolean) {
  const L = new Layer(24, 32);
  if (open) {
    L.rectInk(0, 0, 24, 32, 1);
    L.rectInk(2, 2, 20, 28, -1);
    // 선반과 장부
    L.rectInk(2, 16, 20, 1, 1);
    L.rectInk(6, 19, 9, 10, 1);
    L.rectInk(8, 21, 5, 1, -1);
    L.rectInk(8, 23, 5, 1, -1);
    L.rectInk(5, 8, 4, 7, 1);
    L.rectInk(11, 10, 3, 5, 1);
    return L;
  }
  L.rectInk(0, 0, 24, 32, 1);
  L.rect(2, 2, 20, 28, 0.25);
  // 문의 테와 못
  L.frame(4, 4, 16, 24, -1);
  for (const [x, y] of [[3, 3], [20, 3], [3, 28], [20, 28]] as const) L.dot(x, y, -1);
  // 다이얼: 흰 고리와 눈금
  for (let j = -5; j <= 5; j++)
    for (let i = -5; i <= 5; i++) {
      const d = Math.hypot(i, j);
      if (d <= 5.3) L.dot(12 + i, 14 + j, d > 3.6 ? 1 : -1);
    }
  L.dot(12, 14, 1);
  L.rectInk(12, 10, 1, 2, -1);
  // 손잡이
  L.rectInk(8, 23, 8, 2, 1);
  return L;
}

function paintDesk(L: Layer) {
  const f = DESK;
  // 다리가 보이는 책상: 윗판과 양쪽 다리
  box(L, ISO, f.x0 + 0.06, f.y0 + 0.06, 0, f.x0 + 0.3, f.y1 - 0.06, 0.85, { top: 0, left: 0.25, right: 0 });
  box(L, ISO, f.x1 - 0.3, f.y0 + 0.06, 0, f.x1 - 0.06, f.y1 - 0.06, 0.85, { top: 0, left: 0.25, right: 0 });
  box(L, ISO, f.x0, f.y0, 0.85, f.x1, f.y1, 1.0, { top: 0.85, left: 0.25, right: 0 });
  // 위에 펼쳐 놓은 시도 기록: 흰 종이에 검은 글줄
  const p = ISO.p(0.75, 1.4, 1.0);
  L.polyInk([p, [p[0] + 10, p[1] + 5], [p[0] + 2, p[1] + 9], [p[0] - 8, p[1] + 4]], -1);
  L.line(p[0] - 5, p[1] + 4, p[0] + 5, p[1] + 5, 1);
  L.line(p[0] - 2, p[1] + 6, p[0] + 3, p[1] + 7, 1);
  // 연필꽂이
  const q = ISO.p(1.4, 1.45, 1.0);
  L.rectInk(q[0] - 1, q[1] - 5, 3, 5, -1);
  L.frame(q[0] - 2, q[1] - 5, 5, 6, 1);
  L.line(q[0], q[1] - 6, q[0] + 2, q[1] - 10, 1);
}

interface VaultArt {
  def: RoomDef<VaultSpot>;
  safeOpen: Piece;
  /** 열린 금고에서 바닥으로 번지는 빛 */
  glow: { at: Int32Array; by: Float32Array };
}

let cached: VaultArt | null = null;

function build(): VaultArt {
  const shell: Shell = {
    w: W,
    h: H,
    iso: ISO,
    nx: 4,
    ny: 3,
    wall: 3,
    lamps: LAMPS,
    shadows: SHADOWS,
    solid: 30,
    decals: (albedo) => {
      stampFace(albedo, ISO, shelfFlat(), "y", 0, 2.875, 0.5);
      stampFace(albedo, ISO, safeFlat(false), "x", 0, SAFE.x0, 0);
    },
  };
  const base = paintShell(shell);
  const desk: RoomProp = { foot: DESK, piece: pieceOf(shell, paintDesk) };
  const lamps: RoomProp[] = LAMPS.map((l) => ({ foot: { x0: l.x - 0.1, y0: l.y - 0.1, x1: l.x + 0.1, y1: l.y + 0.1 }, piece: pieceOf(shell, (L) => paintHangingLamp(L, ISO, l)) }));
  const safeOpen = pieceOf(shell, (L) => stampFace(L, ISO, safeFlat(true), "x", 0, SAFE.x0, 0));
  const safeRect = rectOf(safeOpen);
  const deskRect = rectOf(desk.piece);
  const pad = (r: { x: number; y: number; w: number; h: number }, n: number): [number, number, number, number] => [r.x - n, r.y - n, r.w + n * 2, r.h + n * 2];
  const spots: Record<VaultSpot, SpotDef> = {
    desk: { stand: [2.3, 2.3], look: [1.0, 1.6], hit: hitOf(deskRect, 4), frame: pad(deskRect, 3), tag: [Math.round(deskRect.x + deskRect.w / 2), deskRect.y], arrive: "examine" },
    safe: { stand: [2.3, 1.05], look: [3.0, 0], hit: hitOf(safeRect, 4), frame: pad(safeRect, 3), tag: [Math.round(safeRect.x + safeRect.w / 2), safeRect.y], arrive: "interact" },
  };
  // 금고가 열렸을 때 그 앞 바닥에 번지는 빛
  const at: number[] = [];
  const by: number[] = [];
  for (let sy = 0; sy < H; sy++)
    for (let sx = 0; sx < W; sx++) {
      const [fx, fy] = ISO.floor(sx + 0.5, sy + 0.5);
      if (fx < 0 || fy < 0 || fx >= 4 || fy >= 3) continue;
      const d = Math.hypot((fx - 3.0) / 1.0, (fy - 0.2) / 1.5);
      if (d < 1) {
        at.push(sy * W + sx);
        by.push(0.9 * (1 - d) * (1 - d));
      }
    }
  return {
    def: { w: W, h: H, iso: ISO, nx: 4, ny: 3, base, props: [desk, ...lamps], spots, blocks: [DESK], home: [3.3, 2.55], facing: [-1, -1], height: 44 },
    safeOpen,
    glow: { at: Int32Array.from(at), by: Float32Array.from(by) },
  };
}

/** 자료실의 장면 */
export function makeVaultRoom(): RoomScene<VaultSpot, VaultState> {
  const art = (cached ??= build());
  return new RoomScene<VaultSpot, VaultState>(
    art.def,
    { open: false },
    {
      key: (s) => (s.open ? "open" : "shut"),
      overlay: (frame, s) => {
        if (!s.open) return;
        frame.blit(art.safeOpen.layer, art.safeOpen.x, art.safeOpen.y);
        for (let n = 0; n < art.glow.at.length; n++) frame.tone[art.glow.at[n]] += art.glow.by[n];
      },
    },
  );
}
