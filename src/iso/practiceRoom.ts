// 쿼터뷰 연습실: 등급마다 서류함이 하나씩 벽을 따라 서 있다. 지금 등급까지의 서류함은 열려 있고 그 위의 것은 잠겨 있다.
// 가운데에는 등불 아래의 책상, 오른쪽 벽 끝에는 복도로 나가는 문.
import { GLYPH, doorFlat, hitOf, type Blocker, type Lamp, type SpotDef } from "./hallArt";
import { Iso, Layer, box, stampFace, type Footprint, type Piece } from "./iso";
import { RoomScene, paintHangingLamp, paintShell, pieceOf, rectOf, type RoomDef, type RoomProp, type Shell } from "./room";

/** 서류함 다섯(등급 글자)과 문 */
export type PracticeSpot = "F" | "D" | "C" | "B" | "A" | "door";
export const CABINETS = ["F", "D", "C", "B", "A"] as const;
type Rank = (typeof CABINETS)[number];

export interface PracticeState {
  /** 잠긴 서류함 */
  locked: Rank[];
  /** 과제를 모두 푼 서류함 */
  done: Rank[];
  mark?: PracticeSpot | null;
}

const W = 196;
const H = 190;
const ISO = new Iso(98, 100);
const N = 5;
const LAMPS: Lamp[] = [{ x: 2.6, y: 2.7, z: 4.4, floor: 1.1, floorR: 3.2, wall: 0.5, wallR: 4.4 }];

/** 서류함의 자리. 왼쪽 벽을 따라 셋(F · D · C), 오른쪽 벽을 따라 둘(B · A). side 는 기대선 벽. */
const PLACE: Record<Rank, { foot: Footprint; side: "L" | "R" }> = {
  F: { foot: { x0: 0.125, y0: 0.75, x1: 0.75, y1: 1.625 }, side: "L" },
  D: { foot: { x0: 0.125, y0: 1.875, x1: 0.75, y1: 2.75 }, side: "L" },
  C: { foot: { x0: 0.125, y0: 3.0, x1: 0.75, y1: 3.875 }, side: "L" },
  B: { foot: { x0: 1.0, y0: 0.125, x1: 1.875, y1: 0.75 }, side: "R" },
  A: { foot: { x0: 2.25, y0: 0.125, x1: 3.125, y1: 0.75 }, side: "R" },
};
const CAB_H = 2.25;
const TABLE: Footprint = { x0: 2.25, y0: 2.375, x1: 3.375, y1: 3.125 };
const DOOR = { x0: 3.625, w: 20, h: 54 };

/** 서류함의 앞면(14×36점): 등급 이름표와 서랍 셋. 잠긴 것은 점선으로만 그리고 자물쇠를 단다. */
function cabinetFace(rank: Rank, locked: boolean, done: boolean) {
  const L = new Layer(14, 36);
  L.rect(0, 0, 14, 36, locked ? 0 : 0.25);
  // 이름표: 열린 서류함은 흰 바탕에 검은 글자, 잠긴 것은 검은 바탕에 흰 글자
  if (!locked) L.rectInk(2, 2, 10, 11, 1);
  else L.frame(2, 2, 10, 11, 1);
  GLYPH[rank].forEach((row, y) => {
    for (let x = 0; x < 5; x++) if (row[x] === "#") L.dot(5 + x, 4 + y, locked ? 1 : -1);
  });
  for (let r = 0; r < 3; r++) {
    const y = 15 + r * 7;
    if (locked) {
      for (let x = 1; x < 13; x += 2) L.dot(x, y, 1);
    } else {
      L.rectInk(1, y, 12, 1, -1);
      L.rectInk(5, y + 3, 4, 2, 1);
    }
  }
  if (locked) {
    // 자물쇠
    L.frame(5, 21, 5, 4, 1);
    L.dot(6, 19, 1);
    L.dot(8, 19, 1);
    L.dot(6, 20, 1);
    L.dot(8, 20, 1);
    L.dot(7, 18, 1);
  } else if (done) {
    // 다 푼 서류함: 이름표 아래의 가위표 대신 굵은 밑줄
    L.rectInk(2, 14, 10, 1, 1);
  }
  return L;
}

function paintCabinet(L: Layer, rank: Rank, locked: boolean, done: boolean) {
  const { foot: f, side } = PLACE[rank];
  box(L, ISO, f.x0, f.y0, 0, f.x1, f.y1, CAB_H, { top: locked ? 0.12 : 0.8, left: side === "R" && !locked ? 0.25 : 0, right: side === "L" && !locked ? 0.25 : 0 });
  if (side === "L") {
    stampFace(L, ISO, cabinetFace(rank, locked, done), "y", f.x1, f.y1, 0);
    L.outline(ISO.faceY(f.x1, f.y0, f.y1, 0, CAB_H), 1, locked ? 1 : 0);
  } else {
    stampFace(L, ISO, cabinetFace(rank, locked, done), "x", f.y1, f.x0, 0);
    L.outline(ISO.faceX(f.y1, f.x0, f.x1, 0, CAB_H), 1, locked ? 1 : 0);
  }
}

function paintTable(L: Layer) {
  const f = TABLE;
  box(L, ISO, f.x0 + 0.06, f.y0 + 0.06, 0, f.x0 + 0.26, f.y1 - 0.06, 0.85, { top: 0, left: 0.25, right: 0 });
  box(L, ISO, f.x1 - 0.26, f.y0 + 0.06, 0, f.x1 - 0.06, f.y1 - 0.06, 0.85, { top: 0, left: 0.25, right: 0 });
  box(L, ISO, f.x0, f.y0, 0.85, f.x1, f.y1, 1.0, { top: 0.9, left: 0.25, right: 0 });
  // 펼쳐 놓은 과제지와 연필
  const p = ISO.p(2.6, 2.55, 1.0);
  L.polyInk([p, [p[0] + 9, p[1] + 5], [p[0] + 2, p[1] + 8], [p[0] - 7, p[1] + 4]], -1);
  L.line(p[0] - 4, p[1] + 4, p[0] + 4, p[1] + 5, 1);
  L.line(p[0] - 1, p[1] + 6, p[0] + 3, p[1] + 7, 1);
  // 등받이 없는 의자
  box(L, ISO, 2.6, 3.3, 0, 3.05, 3.7, 0.55, { top: 0.5, left: 0, right: 0 });
}

interface PracticeArt {
  def: RoomDef<PracticeSpot>;
  /** 서류함의 세 모습: 열림 · 다 풂 · 잠김 */
  cabinets: Record<Rank, { open: RoomProp; done: RoomProp; locked: RoomProp }>;
  doorOpen: Piece;
}

let cached: PracticeArt | null = null;

function build(): PracticeArt {
  const shadows: Blocker[] = [...CABINETS.map((r) => ({ ...PLACE[r].foot, h: CAB_H })), { ...TABLE, h: 1 }];
  const shell: Shell = {
    w: W,
    h: H,
    iso: ISO,
    nx: N,
    ny: N,
    wall: 4.5,
    lamps: LAMPS,
    shadows,
    solid: 44,
    decals: (albedo) => {
      stampFace(albedo, ISO, doorFlat(DOOR.w, DOOR.h, 1, 0, 0), "x", 0, DOOR.x0, 0);
      // 왼쪽 벽 위의 시간표 한 장
      const note = new Layer(12, 15);
      note.rectInk(0, 0, 12, 15, 1);
      for (let j = 3; j < 13; j += 3) note.rectInk(2, j, 8, 1, -1);
      stampFace(albedo, ISO, note, "y", 0, 4.75, 2.6);
    },
  };
  const base = paintShell(shell);
  const cab = (rank: Rank, locked: boolean, done: boolean): RoomProp => ({ foot: PLACE[rank].foot, piece: pieceOf(shell, (L) => paintCabinet(L, rank, locked, done)) });
  const cabinets = Object.fromEntries(CABINETS.map((r) => [r, { open: cab(r, false, false), done: cab(r, false, true), locked: cab(r, true, false) }])) as PracticeArt["cabinets"];
  const table: RoomProp = { foot: TABLE, piece: pieceOf(shell, paintTable) };
  const lamp: RoomProp = { foot: { x0: 2.5, y0: 2.6, x1: 2.7, y1: 2.8 }, piece: pieceOf(shell, (L) => paintHangingLamp(L, ISO, LAMPS[0])) };
  const doorOpen = pieceOf(shell, (L) => {
    const flat = new Layer(DOOR.w, DOOR.h);
    flat.rect(0, 0, DOOR.w, DOOR.h, 0);
    flat.frame(0, 0, DOOR.w, DOOR.h, 1);
    flat.rect(1, 1, DOOR.w - 2, DOOR.h - 1, 0.5);
    stampFace(L, ISO, flat, "x", 0, DOOR.x0, 0);
  });
  const doorRect = rectOf(doorOpen);

  const pad = (r: { x: number; y: number; w: number; h: number }, n: number): [number, number, number, number] => [r.x - n, r.y - n, r.w + n * 2, r.h + n * 2];
  const spots = {} as Record<PracticeSpot, SpotDef>;
  for (const r of CABINETS) {
    const { foot: f, side } = PLACE[r];
    const rect = rectOf(cabinets[r].open.piece);
    const mid = side === "L" ? (f.y0 + f.y1) / 2 : (f.x0 + f.x1) / 2;
    spots[r] = {
      stand: side === "L" ? [f.x1 + 0.55, mid] : [mid, f.y1 + 0.55],
      look: side === "L" ? [f.x1, mid] : [mid, f.y1],
      hit: hitOf(rect, 1),
      frame: pad(rect, 2),
      tag: [Math.round(rect.x + rect.w / 2), rect.y],
      arrive: "examine",
    };
  }
  spots.door = { stand: [4.25, 0.9], look: [4.25, 0], hit: hitOf(doorRect, 2), frame: pad(doorRect, 2), tag: [Math.round(doorRect.x + doorRect.w / 2), doorRect.y], arrive: "idle" };

  return {
    def: { w: W, h: H, iso: ISO, nx: N, ny: N, base, props: [table, lamp], spots, blocks: [...CABINETS.map((r) => PLACE[r].foot), TABLE, { x0: 2.6, y0: 3.3, x1: 3.05, y1: 3.7 }], home: [4.25, 1.3], facing: [-1, 1] },
    cabinets,
    doorOpen,
  };
}

/** 연습실의 장면 */
export function makePracticeRoom(): RoomScene<PracticeSpot, PracticeState> {
  const art = (cached ??= build());
  return new RoomScene<PracticeSpot, PracticeState>(
    art.def,
    { locked: [], done: [] },
    {
      key: (s) => `${s.locked.join("")}|${s.done.join("")}`,
      items: (s) => CABINETS.map((r) => (s.locked.includes(r) ? art.cabinets[r].locked : s.done.includes(r) ? art.cabinets[r].done : art.cabinets[r].open)),
      overlay: (frame, _s, _t, scene) => {
        // 문 앞에 서면 문이 열린다
        if (scene.at === "door" || scene.heading === "door") frame.blit(art.doorOpen.layer, art.doorOpen.x, art.doorOpen.y);
      },
    },
  );
}
