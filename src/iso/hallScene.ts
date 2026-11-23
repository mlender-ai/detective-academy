// 쿼터뷰 홈 · 학원 홀의 장면. 바닥을 누르면 탐정이 그리로 걷고, 물건을 누르면 그 앞까지 가서 살펴본다.
// 매 장면: 방의 바탕 → 상태에 따라 벽에 덧그리는 것(게시판의 도장, 열린 문, 켜진 유리, 표찰, 시계) → 창의 비
//          → 발밑 그림자와 누른 자리 표시 → 물건과 탐정을 뒤에서 앞으로 → 할 일 표시.
import { DotGrid } from "../fx/dots";
import { createRain } from "../fx/ascii/rain";
import { detectiveSprite, PITCH_ISO, type Action } from "../scene/detective";
import { easeInOut, turnToward } from "../scene/homeScene";
import { H, ISO, LAMPS, NX, NY, W, paintHall, type HallArt, type HallDecor, type HallSpot, type Patch, type Prop } from "./hallArt";
import { HH, HW, Layer, drawOrder, paintLayer, type Footprint, type Piece, type Pt } from "./iso";
import { WalkGrid, pathAt, pathLength } from "./path";

export interface HallState {
  dailySolved: boolean;
  /** 승급 시험실 문 위의 등급 글자 */
  examRank: string;
  /** 시험실에 들어가 할 일이 있는가(유리에 불이 켜진다) */
  examOpen: boolean;
  /** 지금 할 일이 있는 곳: 탐정이 다른 곳에 있으면 모서리 괄호가 깜빡인다 */
  mark?: HallSpot | null;
  /** 사건 접수함(텔레비전). 없거나 "locked" 면 놓이지 않는다. */
  caseStatus?: "locked" | "new" | "open" | "cleared";
}

/** 탐정의 키(점)와 걷는 빠르기 */
const HEIGHT = 52;
const TAU = Math.PI * 2;
const HOME: Pt = [3.9, 4.9];
const RATE = 12;

/** 벽을 눌렀을 때 바닥으로 받아 주는 높이(점): 문과 게시판이 있는 아랫부분까지 */
const WALL_REACH = 100;

/** 숨 쉬는 주기(초). 서 있는 모습은 이 주기로 되풀이해, 한 바퀴를 그린 뒤에는 새로 그리지 않는다. */
const BREATH = 3.4;

function add(tone: Float32Array, p: Patch, k: number) {
  const { at, by } = p;
  for (let n = 0; n < at.length; n++) tone[at[n]] += by[n] * k;
}

/** 방 좌표의 방향 → 탐정 모형이 향할 각도 (0 = 등을 보임, π = 정면) */
const facingOf = (dx: number, dy: number) => Math.atan2(dx - dy, -dx - dy);

export type Tap = { kind: "spot"; id: HallSpot } | { kind: "decor"; id: HallDecor } | { kind: "floor" } | null;

export class HallScene {
  readonly w = W;
  readonly h = H;
  state: HallState = { dailySolved: false, examRank: "D", examOpen: false };
  onArrive: (id: HallSpot) => void = () => {};
  /** 바닥을 눌러 물건 앞을 떠났을 때 */
  onLeave: () => void = () => {};
  at: HallSpot | null = null;

  private art: HallArt = paintHall();
  private frame = new Layer(W, H);
  private grids = new Map<boolean, WalkGrid>();
  private time = 0;
  private pos: Pt = [...HOME];
  private facing = 0;
  private action: Action = "idle";
  private t = 0;
  private target: HallSpot | null = null;
  private lookAt: Pt | null = null;
  private path: Pt[] | null = null;
  private pathLen = 0;
  private moveT = 0;
  private moveDur = 0;
  private doorOpen = 0;
  /** 바닥을 눌렀을 때 그 자리에 잠깐 뜨는 표시 */
  private ping: { at: Pt; t: number } | null = null;
  private rain = WINDOWS_RAIN.map((r, i) => ({ ...r, grid: new DotGrid(r.w, r.h), draw: createRain(r.w, r.h, { seed: 5 + i * 6, lights: 0, beads: 10, runners: 5 }) }));
  private rainStep = -1;
  private sprites = new Map<string, Piece>();

  get busy() {
    return this.path !== null;
  }

  /** 걸어가고 있는 곳(바닥의 한 자리로 가는 중이면 null) */
  get heading() {
    return this.path ? this.target : null;
  }

  /** 맡을 사건이 있어 텔레비전이 놓여 있는가 */
  get caseShown() {
    return this.hasCase;
  }

  private get hasCase() {
    return !!this.state.caseStatus && this.state.caseStatus !== "locked";
  }

  private grid() {
    const key = this.hasCase;
    let g = this.grids.get(key);
    if (!g) {
      g = new WalkGrid(NX, NY, key ? this.art.blocks : this.art.blocks.filter((b) => b !== this.art.blocks[1]));
      this.grids.set(key, g);
    }
    return g;
  }

  /** 점 좌표를 눌렀을 때: 물건이면 그 물건, 바닥이면 그 자리로 걷기 시작한다 */
  tap(px: number, py: number): Tap {
    for (const id of ["case", "archive", "board", "practice", "exam"] as HallSpot[]) {
      if (id === "case" && !this.hasCase) continue;
      const [x, y, w, h] = this.art.spots[id].hit;
      if (px >= x && px < x + w && py >= y && py < y + h) return { kind: "spot", id };
    }
    // 들어갈 곳은 아니지만 살펴볼 수 있는 것: 그 앞까지 걸어가 바라본다
    for (const id of ["bench", "stand", "window"] as HallDecor[]) {
      const d = this.art.decor[id];
      const [x, y, w, h] = d.hit;
      if (px >= x && px < x + w && py >= y && py < y + h) {
        this.walk(d.stand, null, d.look);
        return { kind: "decor", id };
      }
    }
    let [fx, fy] = ISO.floor(px, py);
    if (fx < 0 || fy < 0) {
      // 벽을 눌렀으면 그 벽 아래의 바닥으로 간다(방 밖의 어둠은 아무 일도 없다)
      const k = px - ISO.ox;
      const u = Math.abs(k) / HW;
      const height = ISO.oy + Math.abs(k) / 2 - py;
      if (u >= (k < 0 ? NY : NX) || height < 0 || height > WALL_REACH) return null;
      [fx, fy] = k < 0 ? [0.3, u] : [u, 0.3];
    }
    if (fx > NX + 0.2 || fy > NY + 0.2) return null;
    const to = this.grid().nearest(fx, fy, 1.2);
    if (!to) return null;
    this.walk(to, null);
    this.ping = { at: to, t: 0 };
    return { kind: "floor" };
  }

  /** 그곳으로 걸어간다. 이미 그 앞이면 곧바로 onArrive 가 불린다. */
  go(id: HallSpot) {
    if (this.target === id && this.path) return;
    if (!this.path && this.at === id) {
      this.onArrive(id);
      return;
    }
    this.walk(this.art.spots[id].stand, id);
  }

  /** look: 도착해서 바라볼 곳(물건이 아닌 것을 살펴볼 때) */
  private walk(to: Pt, target: HallSpot | null, look: Pt | null = null) {
    const path = this.grid().find(this.pos, to);
    const wasAt = this.at;
    this.target = target;
    this.lookAt = look;
    this.at = null;
    if (!path || pathLength(path) < 0.05) {
      this.path = [this.pos, to];
      this.pathLen = 0;
      this.arrive();
      return;
    }
    this.path = path;
    this.pathLen = pathLength(path);
    // 걷는 시간은 0.45~1.05초: 방을 가로질러도 1초 남짓이다
    this.moveDur = Math.max(0.45, Math.min(1.05, 0.32 + this.pathLen * 0.14));
    this.moveT = 0;
    this.action = "walk";
    if (wasAt && !target) this.onLeave();
  }

  skip() {
    if (this.path) this.arrive();
  }

  private arrive() {
    const path = this.path!;
    this.pos = [...path[path.length - 1]];
    this.path = null;
    this.t = 0;
    const id = this.target;
    this.target = null;
    if (id) {
      const s = this.art.spots[id];
      this.facing = facingOf(s.look[0] - s.stand[0], s.look[1] - s.stand[1]);
      this.action = s.arrive;
      this.at = id;
      this.onArrive(id);
    } else if (this.lookAt) {
      this.facing = facingOf(this.lookAt[0] - this.pos[0], this.lookAt[1] - this.pos[1]);
      this.action = "examine";
    } else {
      this.action = "idle";
    }
  }

  /** 처음 설 자리를 정한다(걷지 않고 그 앞에 세운다). 모션 줄이기에서 쓴다. */
  place(id: HallSpot) {
    this.path = [this.pos, this.art.spots[id].stand];
    this.target = id;
    this.arrive();
  }

  update(dt: number) {
    this.time += dt;
    if (this.path) {
      this.moveT += dt;
      const p = Math.min(1, this.moveT / this.moveDur);
      const before = this.pos;
      const { at, dir } = pathAt(this.path, this.pathLen * easeInOut(p));
      this.pos = at;
      if (dir[0] || dir[1]) this.facing = turnToward(this.facing, facingOf(dir[0], dir[1]), dt * 16);
      // 발이 미끄러지지 않게 걸음의 박자를 실제로 간 거리에 맞춘다(한 걸음 주기에 1.3칸쯤)
      this.t += Math.max(dt * 1.1, Math.hypot(at[0] - before[0], at[1] - before[1]) / 1.3);
      if (p >= 1) this.arrive();
    } else {
      this.t += dt;
      if (this.action !== "idle" && this.action !== "walk" && this.t > 2.4) {
        this.action = "idle";
        this.t = 0;
      }
    }
    if (this.ping) {
      this.ping.t += dt;
      if (this.ping.t > 0.7 && !this.path) this.ping = null;
    }
    const wantOpen = this.at === "practice" || this.target === "practice" ? 1 : 0;
    this.doorOpen += Math.sign(wantOpen - this.doorOpen) * Math.min(Math.abs(wantOpen - this.doorOpen), dt * 5);
  }

  /** 물건의 이름표가 놓일 자리(점) */
  tagAt(id: HallSpot): Pt {
    return this.art.spots[id].tag;
  }

  /** 누를 영역(점). 화면의 단추를 이 자리에 겹쳐 놓는다. */
  hitRect(id: HallSpot) {
    return this.art.spots[id].hit;
  }

  private detective(): { piece: Piece; foot: Footprint; key: string } {
    const t = this.action === "idle" ? this.t % BREATH : this.t;
    const s = detectiveSprite(HEIGHT, { action: this.action, t, facing: this.facing }, PITCH_ISO);
    const dir = Math.round((((this.facing % TAU) + TAU) % TAU) / (TAU / 16)) % 16;
    const key = `${this.action}|${dir}|${this.action === "walk" ? Math.floor((((t % 1) + 1) % 1) * 12) : Math.round(t * 12)}`;
    let layer = this.sprites.get(key)?.layer;
    if (!layer) {
      layer = new Layer(s.w, s.h);
      for (let i = 0; i < s.px.length; i++) {
        if (!s.px[i]) continue;
        layer.ink[i] = s.px[i] > 0 ? 1 : -1;
        layer.mask[i] = 1;
      }
      if (this.sprites.size > 600) this.sprites.clear();
      this.sprites.set(key, { layer, x: 0, y: 0 });
    }
    const [sx, sy] = ISO.p(this.pos[0], this.pos[1], 0);
    const r = 0.18;
    return {
      key,
      piece: { layer, x: Math.round(sx) - s.ax, y: Math.round(sy) - s.ay },
      foot: { x0: this.pos[0] - r, y0: this.pos[1] - r, x1: this.pos[0] + r, y1: this.pos[1] + r },
    };
  }

  private lastKey = "";

  /**
   * 한 장면을 그려 out(RGBA, w × h)에 쓴다. 앞 장면과 달라진 것이 없으면 그리지 않고 false 를 돌려준다
   * (서 있을 때는 비와 숨이 1초에 12번 바뀔 뿐이라, 대부분의 장면은 다시 그리지 않는다).
   */
  render(out: Uint8ClampedArray, force = false): boolean {
    const { art, frame, time } = this;
    const { tone, ink } = frame;

    // 문 옆의 벽등은 13초마다 두 번 깜빡인다. 번개가 치는 앞뒤 1초에는 건너뛴다(번쩍임이 겹치지 않게).
    const a = time % 13;
    const storm = time % 23;
    const lamp1 = storm > 15 && storm < 17.4 ? 1 : (a > 8.0 && a < 8.07) || (a > 8.18 && a < 8.34) ? 0 : 1;
    const me = this.detective();
    const st = this.state;
    const key = [
      Math.floor(time * RATE),
      lamp1,
      (time % 23) > 16.0 && (time % 23) < 16.4 ? Math.floor(time * 60) : 0,
      this.doorOpen > 0.5 ? 1 : 0,
      st.dailySolved ? 1 : 0,
      st.examOpen ? 1 : 0,
      st.examRank,
      st.caseStatus ?? "",
      st.mark ?? "",
      this.at ?? "",
      this.target ?? "",
      this.hasCase ? Math.floor(time * 5) : 0,
      Math.floor((time % 1.2) / 0.8),
      me.key,
      me.piece.x,
      me.piece.y,
      this.ping ? `${Math.floor(this.ping.t * 12)}${this.path ? "w" : ""}` : "",
    ].join("|");
    if (!force && key === this.lastKey) return false;
    this.lastKey = key;

    tone.set(art.base.tone);
    ink.set(art.base.ink);
    if (!lamp1) add(tone, art.lamp1, -1);

    if (this.hasCase) add(tone, art.tvShade, -1);

    // 번개: 23초마다 두 번 짧게. 창이 밝아지고 바닥에 누운 창빛이 세진다.
    const b = time % 23;
    const flash = (b > 16.0 && b < 16.09) || (b > 16.22 && b < 16.4);
    if (flash) add(tone, art.moon, 1);

    // 상태에 따라 벽에 덧그리는 것
    if (this.state.dailySolved) frame.blit(art.boardSolved.layer, art.boardSolved.x, art.boardSolved.y);
    const open = this.doorOpen > 0.5;
    if (open) {
      frame.blit(art.practiceOpen.layer, art.practiceOpen.x, art.practiceOpen.y);
      add(tone, art.practicePool, 1);
    }
    if (this.state.examOpen) {
      frame.blit(art.examLit.layer, art.examLit.x, art.examLit.y);
      add(tone, art.examPool, 1);
    }
    const plate = art.plate(this.state.examRank);
    frame.blit(plate.layer, plate.x, plate.y);
    const sconce = lamp1 ? art.sconceOn : art.sconceOff;
    frame.blit(sconce.layer, sconce.x, sconce.y);

    // 창의 비: 1초에 12장면으로 끊어 그린다. 평평하게 그린 뒤 벽의 기울기대로 유리 자리에만 얹는다.
    const step = Math.floor(time * RATE);
    for (const r of this.rain) {
      if (step !== this.rainStep) r.draw(r.grid, step / RATE);
      for (let i = 0; i < r.w; i++) {
        const sx = r.x + i;
        const top = r.y + Math.ceil((sx - ISO.ox) / 2);
        for (let j = 0; j < r.h; j++) {
          const d = (top + j) * W + sx;
          if (!art.glass[d]) continue;
          if (flash) {
            tone[d] = 0.9;
            continue;
          }
          if (r.grid.ink[j * r.w + i] > 0) ink[d] = 1;
        }
      }
    }
    this.rainStep = step;

    // 누른 자리의 표시: 마름모가 한 번 퍼진다
    if (this.ping) {
      const [cx, cy] = ISO.p(this.ping.at[0], this.ping.at[1], 0);
      const grow = this.path ? 1 : Math.max(0, 1 - (this.ping.t - 0.5) * 5);
      if (grow > 0 && (this.ping.t * 6) % 2 < 1.4) {
        const r = 7;
        for (let k = 0; k <= r; k++) {
          const dx = k * 2;
          const dy = r - k;
          for (const [qx, qy] of [[dx, dy], [-dx, dy], [dx, -dy], [-dx, -dy]] as const) frame.dot(Math.round(cx) + qx, Math.round(cy) + qy, 1);
        }
      }
    }

    // 탐정의 발밑 그림자: 바닥의 밝기를 누른다
    {
      const [cx, cy] = ISO.p(this.pos[0], this.pos[1], 0);
      for (let dy = -3; dy <= 3; dy++)
        for (let dx = -9; dx <= 9; dx++) {
          if ((dx / 9) ** 2 + (dy / 3.4) ** 2 > 1) continue;
          const x = Math.round(cx) + dx;
          const y = Math.round(cy) + dy;
          if (frame.inside(x, y)) tone[y * W + x] *= 0.22;
        }
    }

    // 물건과 탐정을 뒤에서 앞으로
    const items: { foot: Footprint; piece: Piece }[] = art.props.map((p: Prop) => ({ foot: p.foot, piece: p.piece }));
    if (this.hasCase) {
      const d = time % 7;
      const live = this.state.caseStatus !== "cleared";
      const tv = !live ? art.tv.off : d > 5.2 && d < 5.7 ? art.tv.mask : (Math.floor(time * 5) & 1) === 0 ? art.tv.noise0 : art.tv.noise1;
      items.push({ foot: tv.foot, piece: tv.piece });
    }
    items.push({ foot: art.lamp.foot, piece: art.lamp.piece });
    items.push(me);
    for (const it of drawOrder(items)) frame.blit(it.piece.layer, it.piece.x, it.piece.y);

    // 지금 할 일이 있는 곳: 모서리 괄호가 끊어서 깜빡인다(탐정이 그 앞에 있거나 가는 중이면 두르지 않는다)
    const mark = this.state.mark;
    if (mark && this.at !== mark && this.target !== mark && time % 1.2 < 0.8 && (mark !== "case" || this.hasCase)) {
      const [x, y, w, h] = art.spots[mark].frame;
      const n = 6;
      for (const [cx, cy, sx, sy] of [[x, y, 1, 1], [x + w - 1, y, -1, 1], [x, y + h - 1, 1, -1], [x + w - 1, y + h - 1, -1, -1]] as const) {
        for (let k = 0; k < n; k++) {
          for (const t of [0, 1]) {
            frame.dot(cx + sx * k, cy + sy * t, 1);
            frame.dot(cx + sx * t, cy + sy * k, 1);
          }
        }
        for (let k = 0; k <= n; k++) {
          frame.dot(cx + sx * k, cy + sy * 2, -1);
          frame.dot(cx + sx * 2, cy + sy * k, -1);
          frame.dot(cx - sx, cy + sy * k, -1);
          frame.dot(cx + sx * k, cy - sy, -1);
        }
      }
    }

    paintLayer(frame, out);
    return true;
  }
}

/** 창마다 비를 그릴 네모(점): 화면의 왼쪽 위 자리와 크기. 벽의 기울기는 그릴 때 준다. */
const WINDOWS_RAIN = [
  { x: ISO.ox + Math.round(0.75 * HW), y: ISO.oy - Math.round(5.75 * 16) - 4, w: 20, h: 66 },
  { x: ISO.ox + Math.round(2.5 * HW), y: ISO.oy - Math.round(5.75 * 16) - 4, w: 20, h: 66 },
];

void HH;
void LAMPS;
