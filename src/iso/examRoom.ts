// 쿼터뷰 시험실: 등불 아래 책상 하나. 그 위에 학원 인장으로 봉한 시험 봉투가 놓여 있다.
// 응시 전에는 봉투가 봉해져 있고, 열면 시험지가 올라온다. 조건을 채우지 못했으면 책상이 비어 있고, 시험이 끝나면 등이 꺼진다.
import { doorFlat, hitOf, type Blocker, type Lamp, type SpotDef } from "./hallArt";
import { Iso, Layer, box, stampFace, type Footprint, type Piece } from "./iso";
import { RoomScene, paintHangingLamp, paintShell, pieceOf, rectOf, type RoomDef, type RoomProp, type Shell } from "./room";

export type ExamSpot = "desk";

/** sealed 봉투가 놓여 있다 · opening 시험지를 꺼낸다 · empty 아직 열리지 않는다(책상이 비었다) · ended 시험이 끝났다(등이 꺼졌다) */
export type ExamPhase = "sealed" | "opening" | "empty" | "ended";

export interface ExamRoomState {
  phase: ExamPhase;
  mark?: ExamSpot | null;
}

const W = 196;
const H = 150;
const ISO = new Iso(98, 78);
const N = 4;
const LAMP: Lamp = { x: 2.0, y: 1.95, z: 3.5, floor: 1.1, floorR: 2.5, wall: 0.5, wallR: 3.2 };
const DESK: Footprint = { x0: 1.375, y0: 1.625, x1: 2.625, y1: 2.375 };
const CHAIR: Footprint = { x0: 1.75, y0: 2.625, x1: 2.25, y1: 3.0 };
const LECTERN: Footprint = { x0: 0.25, y0: 0.875, x1: 0.75, y1: 1.5 };
const DOOR = { x0: 2.625, w: 20, h: 54 };

/** 벽시계(15×15점): 실제 시각이 아니라 시험 시각을 가리키는 장식(바늘은 열 시 십 분) */
function clockFlat() {
  const L = new Layer(15, 15);
  for (let j = 0; j < 15; j++)
    for (let i = 0; i < 15; i++) {
      const d = Math.hypot(i - 7, j - 7);
      if (d <= 7.4) L.dot(i, j, d > 6.2 ? -1 : 1);
    }
  L.line(7, 7, 7, 2, -1);
  L.line(7, 7, 10, 5, -1);
  return L;
}

function paintDesk(L: Layer) {
  const f = DESK;
  box(L, ISO, f.x0 + 0.06, f.y0 + 0.06, 0, f.x0 + 0.3, f.y1 - 0.06, 0.85, { top: 0, left: 0.25, right: 0 });
  box(L, ISO, f.x1 - 0.3, f.y0 + 0.06, 0, f.x1 - 0.06, f.y1 - 0.06, 0.85, { top: 0, left: 0.25, right: 0 });
  box(L, ISO, f.x0, f.y0, 0.85, f.x1, f.y1, 1.0, { top: 0.6, left: 0.25, right: 0 });
}

/** 책상 위의 봉투: 흰 봉투에 검은 덮개 줄과 인장 */
function paintEnvelope(L: Layer, open: boolean) {
  const p = ISO.p(1.75, 1.8, 1.0);
  const quad: [number, number][] = [p, [p[0] + 12, p[1] + 6], [p[0] + 3, p[1] + 11], [p[0] - 9, p[1] + 5]];
  L.polyInk(quad, 1);
  L.outline(quad, -1);
  if (!open) {
    // 덮개의 두 줄과 가운데의 인장
    L.line(p[0], p[1] + 1, p[0] + 2, p[1] + 6, -1);
    L.line(p[0] + 11, p[1] + 6, p[0] + 2, p[1] + 6, -1);
    L.rectInk(p[0] + 1, p[1] + 5, 3, 3, -1);
  } else {
    // 꺼내 든 시험지: 봉투 위로 선 흰 종이와 검은 글줄
    L.rectInk(p[0] - 3, p[1] - 14, 11, 16, 1);
    L.frame(p[0] - 4, p[1] - 15, 13, 18, -1);
    for (let j = 0; j < 5; j++) L.rectInk(p[0] - 1, p[1] - 12 + j * 3, j % 2 ? 5 : 7, 1, -1);
  }
}

interface ExamArt {
  def: RoomDef<ExamSpot>;
  sealed: RoomProp;
  opened: RoomProp;
  lampOn: RoomProp;
  lampOff: RoomProp;
}

let cached: ExamArt | null = null;

function build(): ExamArt {
  const shadows: Blocker[] = [
    { ...DESK, h: 1 },
    { ...LECTERN, h: 1.5 },
    { ...CHAIR, h: 0.55 },
  ];
  const shell: Shell = {
    w: W,
    h: H,
    iso: ISO,
    nx: N,
    ny: N,
    wall: 3.5,
    lamps: [LAMP],
    shadows,
    solid: 36,
    decals: (albedo) => {
      stampFace(albedo, ISO, clockFlat(), "y", 0, 2.5, 2.0);
      stampFace(albedo, ISO, doorFlat(DOOR.w, DOOR.h, 1, 0, 0), "x", 0, DOOR.x0, 0);
      // 왼쪽 벽의 시험 규칙 한 장
      const note = new Layer(10, 13);
      note.rectInk(0, 0, 10, 13, 1);
      for (let j = 2; j < 11; j += 2) note.rectInk(2, j, 6, 1, -1);
      stampFace(albedo, ISO, note, "y", 0, 3.6, 1.6);
    },
  };
  const base = paintShell(shell);
  const desk: RoomProp = { foot: DESK, piece: pieceOf(shell, paintDesk) };
  const chair: RoomProp = { foot: CHAIR, piece: pieceOf(shell, (L) => box(L, ISO, CHAIR.x0, CHAIR.y0, 0, CHAIR.x1, CHAIR.y1, 0.55, { top: 0.5, left: 0, right: 0 })) };
  const lectern: RoomProp = { foot: LECTERN, piece: pieceOf(shell, (L) => box(L, ISO, LECTERN.x0, LECTERN.y0, 0, LECTERN.x1, LECTERN.y1, 1.5, { top: 0.6, left: 0.25, right: 0 })) };
  // 봉투는 책상보다 조금 앞에 놓인 것으로 쳐서 늘 책상 위에 그려지게 한다
  const onDesk: Footprint = { x0: DESK.x0 + 0.2, y0: DESK.y1 - 0.02, x1: DESK.x1 - 0.2, y1: DESK.y1 + 0.02 };
  const envelope = (open: boolean): RoomProp => ({ foot: onDesk, piece: pieceOf(shell, (L) => paintEnvelope(L, open)) });
  const lampFoot = { x0: LAMP.x - 0.1, y0: LAMP.y + 0.3, x1: LAMP.x + 0.1, y1: LAMP.y + 0.5 };
  const lamp = (on: boolean): RoomProp => ({ foot: lampFoot, piece: pieceOf(shell, (L) => paintHangingLamp(L, ISO, LAMP, on)) });
  const deskRect = rectOf(desk.piece);
  const spots: Record<ExamSpot, SpotDef> = {
    desk: { stand: [3.15, 2.0], look: [2.0, 2.0], hit: hitOf(deskRect, 3), frame: [deskRect.x - 3, deskRect.y - 3, deskRect.w + 6, deskRect.h + 6], tag: [Math.round(deskRect.x + deskRect.w / 2), deskRect.y], arrive: "examine" },
  };
  return {
    def: { w: W, h: H, iso: ISO, nx: N, ny: N, base, props: [desk, chair, lectern], spots, blocks: [DESK, CHAIR, LECTERN], home: [3.15, 0.95], facing: [0, 1], height: 48 },
    sealed: envelope(false),
    opened: envelope(true),
    lampOn: lamp(true),
    lampOff: lamp(false),
  };
}

/** 시험실의 장면 */
export function makeExamRoom(): RoomScene<ExamSpot, ExamRoomState> {
  const art = (cached ??= build());
  const dim = (frame: Layer, k: number) => {
    for (let i = 0; i < frame.tone.length; i++) frame.tone[i] *= k;
  };
  return new RoomScene<ExamSpot, ExamRoomState>(
    art.def,
    { phase: "sealed" },
    {
      key: (s) => s.phase,
      // 등이 꺼지면 방이 어둠에 잠긴다(뼈대의 흰 선과 물건의 테만 남는다)
      overlay: (frame, s) => {
        if (s.phase === "ended") dim(frame, 0.12);
        else if (s.phase === "empty") dim(frame, 0.45);
      },
      items: (s) => {
        const out: RoomProp[] = [s.phase === "ended" ? art.lampOff : art.lampOn];
        if (s.phase === "sealed") out.push(art.sealed);
        if (s.phase === "opening") out.push(art.opened);
        return out;
      },
    },
  );
}

export type { Piece };
