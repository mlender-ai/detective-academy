// B안 · 플레이 가능한 복도의 장면. 옆에서 본 복도를 탐정이 좌우로 걷는다.
// 물건을 누르면 그 앞까지 걸어가(0.45~0.9초) 벽 쪽으로 돌아서고, 카메라가 따라간다.
import { detectiveSprite, shadowRadius, type Action } from "./detective";
import { spriteCanvas } from "./dot";
import { easeInOut, turnToward, type HomeScene, type SceneState, type SpotId } from "./homeScene";
import { bracketSpots, cornerBrackets } from "./marks";
import { BOX, WALK, WH, WW, clockHands, paintSide, rankPlate, type Placed, type SideArt } from "./sideArt";
import { CorridorFx } from "../fx/corridorFx";
import type { InkOp, StageFrame, ToneOp } from "./stage";

type Box = readonly [number, number, number, number];

interface Spot {
  /** 설 자리(복도 좌표) */
  x: number;
  /** 누를 수 있는 영역: x, y, w, h. 손가락에 맞춰 물건보다 넉넉하게 잡는다. */
  hit: Box;
  /** 표시 괄호를 두를 네모: x, y, w, h */
  frame: Box;
  arrive: Action;
  /** 도착해서 바라보는 쪽. 0 은 벽(등을 보인다), -π/2 는 왼쪽. */
  face: number;
}

const grow = (b: Box, pad: number): Box => [b[0] - pad, b[1] - pad, b[2] + pad * 2, b[3] + pad * 2];

/** 복도의 네 곳. 공간·물건·설 자리를 데이터로 둔다: 곳을 늘릴 때는 여기와 sideArt 의 BOX 만 고친다. */
const SPOTS: Record<SpotId, Spot> = {
  // 보관함은 옆에 서서 들여다본다(서랍을 가리지 않게)
  archive: { x: BOX.archive[0] + BOX.archive[2] + 11, hit: [18, 22, 66, 86], frame: grow(BOX.archive, 8), arrive: "examine", face: -Math.PI / 2 },
  // 큰 시험지의 왼쪽에 서서 손을 뻗는다(시험지를 가리지 않게)
  board: { x: BOX.board[0] - 3, hit: [84, 16, 74, 92], frame: grow(BOX.board, 9), arrive: "interact", face: 0 },
  practice: { x: BOX.practice[0] + BOX.practice[2] / 2, hit: [166, 16, 52, 92], frame: grow(BOX.practice, 9), arrive: "idle", face: 0 },
  exam: { x: BOX.exam[0] + BOX.exam[2] / 2, hit: [234, 10, 60, 98], frame: grow(BOX.exam, 10), arrive: "idle", face: 0 },
  // 사건 접수함(텔레비전)은 왼쪽에 서서 들여다본다. 맡을 사건이 있을 때만 복도에 놓인다.
  case: { x: BOX.case[0] - 12, hit: [286, 72, 34, 36], frame: grow(BOX.case, 5), arrive: "examine", face: Math.PI / 2 },
};

const HOME_X = 152;
/** 화면에 그리는 폭(점). 휴대폰 폭 430px 까지 덮는다. */
const VIEW_W = 216;
const HEIGHT = 60;
const TAU = Math.PI * 2;

export class SideScene implements HomeScene {
  readonly w: number;
  readonly h = WH;
  state: SceneState = { dailySolved: false, examRank: "D", examOpen: false };
  onArrive: (id: SpotId) => void = () => {};
  at: SpotId | null = null;

  private art: SideArt = paintSide();
  private time = 0;
  private x = HOME_X;
  private facing = Math.PI;
  private action: Action = "idle";
  private t = 0;
  private cam = 0;
  private target: SpotId | null = null;
  private fromX = HOME_X;
  private moveT = 0;
  private moveDur = 0;
  private doorOpen = 0;
  private sprites = new Map<string, HTMLCanvasElement>();
  private plates = new Map<string, Placed>();
  private clock: { key: string; art: Placed } | null = null;
  private brackets = cornerBrackets();
  private glass = [document.createElement("canvas"), document.createElement("canvas")];
  /** 환경 애니메이션 실험(state.fx 가 참일 때만 만든다) */
  private fx: CorridorFx | null = null;
  /** 실제로 보이는 폭(점). 카메라가 이만큼의 가운데에 탐정을 둔다. */
  private visible: { x0: number; x1: number };

  /** viewW: 화면에 그리는 폭(점). 복도 전체를 볼 때는 WW 를 준다(그림 검수용). */
  constructor(viewW = VIEW_W) {
    this.w = viewW;
    this.visible = { x0: 0, x1: viewW };
    this.cam = this.wantCam(0);
  }

  get busy() {
    return this.target !== null;
  }

  /** 사건 접수함이 복도에 놓여 있는가 */
  private get hasCase() {
    return !!this.state.caseStatus && this.state.caseStatus !== "locked";
  }

  setView(view: { x0: number; y0: number; x1: number; y1: number }) {
    this.visible = { x0: view.x0, x1: view.x1 };
    // 아직 움직이기 전이면 카메라를 곧바로 제자리에 둔다(처음 그릴 때 밀리는 모습이 보이지 않게)
    if (!this.target && !this.at && this.time < 0.2) this.cam = this.wantCam(0);
  }

  /** 보이는 영역의 가운데에 탐정이 오는 카메라 자리. 복도 밖은 비추지 않는다. */
  private wantCam(lead: number) {
    const mid = (this.visible.x0 + this.visible.x1) / 2;
    return Math.max(-this.visible.x0, Math.min(WW - this.visible.x1, this.x + lead - mid));
  }

  hit(x: number, y: number): SpotId | null {
    const wx = x + Math.round(this.cam);
    for (const id of Object.keys(SPOTS) as SpotId[]) {
      if (id === "case" && !this.hasCase) continue;
      const [hx, hy, hw, hh] = SPOTS[id].hit;
      if (wx >= hx && wx < hx + hw && y >= hy && y < hy + hh) return id;
    }
    return null;
  }

  go(id: SpotId) {
    if (this.target === id) return;
    if (!this.target && this.at === id) {
      this.onArrive(id);
      return;
    }
    this.target = id;
    this.fromX = this.x;
    // 걷는 시간은 0.45~0.9초. 도착해서 살피는 짧은 박자(0.2초)까지 더해도 1.2초를 넘지 않게 한다.
    this.moveDur = Math.max(0.45, Math.min(0.9, 0.3 + Math.abs(SPOTS[id].x - this.x) * 0.0045));
    this.moveT = 0;
    this.action = "walk";
    this.at = null;
  }

  skip() {
    if (this.target) this.arrive();
  }

  private arrive() {
    const id = this.target!;
    this.x = SPOTS[id].x;
    this.facing = SPOTS[id].face; // 물건 쪽으로 돌아선다
    this.action = SPOTS[id].arrive;
    this.t = 0;
    this.target = null;
    this.at = id;
    this.onArrive(id);
  }

  update(dt: number) {
    this.time += dt;
    if (this.target) {
      const to = SPOTS[this.target].x;
      this.moveT += dt;
      const p = Math.min(1, this.moveT / this.moveDur);
      const before = this.x;
      this.x = this.fromX + (to - this.fromX) * easeInOut(p);
      this.facing = turnToward(this.facing, to > this.fromX ? Math.PI / 2 : -Math.PI / 2, dt * 18);
      // 발이 미끄러지지 않게, 걸음의 박자를 실제로 간 거리에 맞춘다(한 걸음 주기에 약 34점)
      this.t += Math.max(dt * 1.2, Math.abs(this.x - before) / 34);
      if (p >= 1) this.arrive();
    } else {
      this.t += dt;
      // 도착해서 잠깐 살핀 뒤에는 서 있는 자세로 돌아간다
      if (this.at && this.action !== "idle" && this.t > 2.4) {
        this.action = "idle";
        this.t = 0;
      }
    }
    const wantOpen = this.at === "practice" ? 1 : 0;
    this.doorOpen += Math.sign(wantOpen - this.doorOpen) * Math.min(Math.abs(wantOpen - this.doorOpen), dt * 6);
    const lead = this.target ? Math.sign(SPOTS[this.target].x - this.x) * 10 : 0;
    this.cam += (this.wantCam(lead) - this.cam) * Math.min(1, dt * 6);
  }

  private sprite(h: number, action: Action, t: number, facing: number) {
    const s = detectiveSprite(h, { action, t, facing });
    const dir = Math.round((((facing % TAU) + TAU) % TAU) / (TAU / 16)) % 16;
    const key = `${h}|${action}|${dir}|${action === "walk" ? Math.floor((((t % 1) + 1) % 1) * 12) : Math.round(t * 12)}`;
    let canvas = this.sprites.get(key);
    if (!canvas) {
      canvas = spriteCanvas(s);
      if (this.sprites.size > 500) this.sprites.clear();
      this.sprites.set(key, canvas);
    }
    return { canvas, ax: s.ax, ay: s.ay };
  }

  frame(): StageFrame {
    const { art, time } = this;
    const cam = Math.round(this.cam);
    const tone: ToneOp[] = [];
    const add = (key: string, alpha: number, op: ToneOp["op"], dx = 0) => tone.push({ canvas: art.tone[key], alpha, op, x: -cam + dx });

    // 환경의 박자(정해진 주기로만 바뀐다): 시험실 앞의 등이 13초마다 두 번 깜빡이고, 종이는 11초마다 팔랑인다
    const a = time % 13;
    const lamp2 = (a > 8.0 && a < 8.07) || (a > 8.18 && a < 8.34) ? 0 : 1;
    const b = time % 11;
    const flutter = b > 4 && b < 4.8 ? 1 + (Math.floor((b - 4) / 0.2) % 2) : 0;
    const open = this.doorOpen > 0.5;

    add("base", 1, "over");
    add("lamp0", 1, "add");
    add("lamp1", 1, "add");
    add("lamp2", lamp2, "add");
    // 문짝과 게시판의 판은 전등 빛을 받아도 어둡다. 그 위에 유리와 문틈의 불빛을 다시 얹는다.
    add("doors", 1, "mul");
    add("board", 1, "add");
    add(open ? "practiceOpen" : "practiceGlass", 1, "add");
    add(this.state.examOpen ? "examLit" : "examDim", 1, "add");
    // 환경 애니메이션 실험(state.fx): 블라인드를 걷어 비 내리는 창을 드러내므로, 살 모양의 달빛과 나뭇가지 그림자 대신
    // 그 창으로 든 빛(창살의 그림자로 두 쪽이 난다)을 바닥에 눕힌다. 나뭇가지 그림자를 겹치면 빛이 조각나 창의 모양이 읽히지 않는다.
    const fx = this.state.fx ? (this.fx ??= new CorridorFx()) : null;
    if (fx) {
      fx.update(time, cam);
      tone.push(fx.floor(cam));
    } else {
      add("moon", 1, "add");
      // 창밖 나뭇가지의 그림자가 천천히 흔들린다
      add("branch", 1, "mul", Math.round(Math.sin(time * 0.7) * 1.6));
    }
    // 환경 애니메이션 실험: 촛불의 빛을 벽에 더한다
    if (fx) tone.push(...fx.tone(cam));

    const ink: InkOp[] = [];
    const put = (p: Placed, shift = cam) => ink.push({ canvas: p.canvas, x: p.x - shift, y: p.y });
    put(art.ink.mid);
    put(art.ink.bulb0);
    put(art.ink.bulb1);
    if (lamp2) put(art.ink.bulb2);
    put(art.ink[`paper${this.state.dailySolved ? "S" : "N"}${flutter}`]);
    put(open ? art.ink.practiceLeaf : art.ink.practiceClosed);
    // 환경 애니메이션 실험: 비 내리는 창, 촛불
    if (fx) ink.push(...fx.ink(cam));

    // 사건 접수함: 새 사건·수사 중이면 잡음이 일고 7초마다 토끼 가면이 스친다. 해결한 뒤에는 꺼져 있다.
    if (this.hasCase) {
      const d = time % 7;
      const live = this.state.caseStatus !== "cleared";
      put(!live ? art.ink.caseOff : d > 5.2 && d < 5.7 ? art.ink.caseMask : art.ink[`caseNoise${Math.floor(time * 5) & 1}`]);
    }

    // 문 위의 등급 표찰
    let plate = this.plates.get(this.state.examRank);
    if (!plate) {
      plate = rankPlate(this.state.examRank);
      this.plates.set(this.state.examRank, plate);
    }
    put(plate);

    // 벽시계: 실제 시각
    const now = new Date();
    const clockKey = `${now.getHours()}:${now.getMinutes()}`;
    if (this.clock?.key !== clockKey) this.clock = { key: clockKey, art: clockHands(now.getHours(), now.getMinutes()) };
    put(this.clock.art);

    // 시험실 안의 사람: 불이 켜져 있을 때, 유리 뒤를 가끔 지나간다 (19초마다 3초). 두 유리창 안에서만 머리와 어깨가 보인다.
    const c = time % 19;
    if (this.state.examOpen && c > 12 && c < 15) {
      const [ex, ey, ew] = BOX.exam;
      const fx = Math.round(ex + 2 + ((c - 12) / 3) * (ew - 4));
      const f = this.sprite(40, "walk", time * 1.4, Math.PI / 2);
      for (const gx of [ex + 6, ex + ew - 16]) {
        const from = Math.max(gx, fx - 5);
        const to = Math.min(gx + 10, fx + 5);
        if (to <= from) continue;
        // 조각 캔버스는 유리창마다 하나를 두고 다시 쓴다(폭을 다시 주면 비워진다)
        const piece = this.glass[gx === ex + 6 ? 0 : 1];
        piece.width = to - from;
        piece.height = 23;
        piece.getContext("2d")!.drawImage(f.canvas, f.ax - (fx - from), 1, to - from, 23, 0, 0, to - from, 23);
        ink.push({ canvas: piece, x: from - cam, y: ey + 9 });
      }
    }

    // 지금 할 일이 있는 곳: 모서리 괄호가 끊어서 깜빡인다 (탐정이 그 앞에 있거나 가는 중이면 두르지 않는다)
    const mark = this.state.mark;
    if (mark && this.at !== mark && this.target !== mark && time % 1.2 < 0.8) {
      bracketSpots(SPOTS[mark].frame).forEach(([x, y], i) => ink.push({ canvas: this.brackets[i], x: x - cam, y }));
    }

    // 탐정
    const me = this.sprite(HEIGHT, this.action, this.t, this.facing);
    const [rx, ry] = shadowRadius(HEIGHT);
    ink.push({ canvas: me.canvas, x: Math.round(this.x - me.ax) - cam, y: WALK - me.ay });

    // 전경의 기둥은 복도보다 조금 빨리 민다
    const fgShift = Math.round(cam * 1.2 - (WW - this.w) * 0.1);
    put(art.ink.pillarL, fgShift);
    // 환경 애니메이션 실험에서는 오른쪽 기둥이 창을 가리지 않게 복도의 끝에 세운다(비 내리는 유리가 다 보이게)
    put(art.ink.pillarR, fx ? Math.min(fgShift, cam - 4) : fgShift);

    return { tone, shadows: [{ x: Math.round(this.x) - cam, y: WALK, rx, ry }], ink };
  }
}
