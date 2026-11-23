// 쿼터뷰 방의 공통 틀: 방의 바탕(바닥 · 벽 · 빛 · 그림자 · 뼈대 선)을 그리는 것과, 탐정이 걸어 다니는 장면.
// 학원 홀(hallArt · hallScene)에서 쓰던 방법을 방마다 다시 쓰지 않도록 묶었다. 홀은 비 · 번개 · 텔레비전 같은 제 것이 많아 따로 둔다.
import { detectiveSprite, PITCH_ISO, type Action } from "../scene/detective";
import { easeInOut, turnToward } from "../scene/homeScene";
import { lampLight, shaded, type Blocker, type Lamp, type SpotDef } from "./hallArt";
import { HW, Iso, Layer, drawOrder, paintLayer, type Footprint, type Piece, type Pt } from "./iso";
import { WalkGrid, pathAt, pathLength } from "./path";

/** 방의 생김새 */
export interface Shell {
  /** 캔버스의 크기(점) */
  w: number;
  h: number;
  iso: Iso;
  /** 방의 크기(칸)와 벽의 높이(칸) */
  nx: number;
  ny: number;
  wall: number;
  lamps: Lamp[];
  /** 빛이 닿지 않는 바닥의 밝기 */
  ambient?: number;
  /** 바닥에 그림자를 떨구는 상자들 */
  shadows?: Blocker[];
  /** 벽에 붙는 것(게시판, 문, 선반)을 재질 층에 붙인다. 빛은 그 뒤에 입힌다. */
  decals?: (albedo: Layer) => void;
  /** 벽의 세로 뼈대 선이 실선인 높이(점). 그 위로는 점선이 되어 어둠에 잠긴다. */
  solid?: number;
}

/** 방의 바탕을 그린다: 바둑판 바닥, 빛이 닿는 곳만 드러나는 벽, 벽에 붙은 것, 뼈대의 흰 선, 바닥 판의 두께 */
export function paintShell(sh: Shell): Layer {
  const { w: W, h: H, iso, nx, ny } = sh;
  const { ox, oy } = iso;
  const wallDots = sh.wall * 16;
  const solid = sh.solid ?? 40;
  const ambient = sh.ambient ?? 0.06;
  const shadows = sh.shadows ?? [];
  const albedo = new Layer(W, H);
  const light = new Float32Array(W * H);
  const kind = new Uint8Array(W * H);

  for (let sy = 0; sy < H; sy++)
    for (let sx = 0; sx < W; sx++) {
      const i = sy * W + sx;
      const [fx, fy] = iso.floor(sx + 0.5, sy + 0.5);
      if (fx >= 0 && fy >= 0 && fx < nx && fy < ny) {
        kind[i] = 1;
        albedo.put(sx, sy, (Math.floor(fx) + Math.floor(fy)) % 2 === 1 ? 0.5 : 1);
        let l = ambient;
        for (const lamp of sh.lamps) l += lampLight(lamp, fx, fy, 0) * (shadows.length && shaded(lamp, fx, fy, shadows) ? 0.12 : 1);
        light[i] = l;
        continue;
      }
      const left = sx < ox;
      const k = left ? ox - sx : sx - ox;
      const u = (left ? k - 0.5 : k + 0.5) / 16;
      if (u >= (left ? ny : nx)) continue;
      const zd = oy + (left ? Math.floor(k / 2) : Math.ceil(k / 2)) - 1 - sy;
      if (zd < 0 || zd >= wallDots) continue;
      kind[i] = 2;
      albedo.put(sx, sy, 1);
      const z = (zd + 0.5) / 16;
      let l = 0;
      for (const lamp of sh.lamps) l += lampLight(lamp, left ? 0 : u, left ? u : 0, z);
      light[i] = l;
    }

  sh.decals?.(albedo);

  const base = new Layer(W, H);
  for (let i = 0; i < W * H; i++) {
    if (!kind[i]) continue;
    base.mask[i] = 1;
    base.ink[i] = albedo.ink[i];
    base.tone[i] = albedo.tone[i] * light[i];
  }

  // 뼈대의 흰 선: 벽과 바닥이 만나는 줄
  for (let sx = 0; sx < W; sx++) {
    const left = sx < ox;
    const k = left ? ox - sx : sx - ox;
    if ((left ? k - 0.5 : k + 0.5) / 16 >= (left ? ny : nx)) continue;
    const y = oy + (left ? Math.floor(k / 2) : Math.ceil(k / 2)) - 1;
    if (y < 0 || y >= H) continue;
    const i = y * W + sx;
    if (albedo.ink[i] === 0) base.ink[i] = 1;
  }
  // 뒤 모서리와 벽의 잘린 끝: 위로 갈수록 성기다
  const post = (sx: number, baseY: number, reach: number) => {
    for (let zd = 1; zd < wallDots; zd++) {
      const y = baseY - zd;
      if (y < 0) break;
      if (zd < reach || (zd < reach + 16 && zd % 2 === 0) || (zd < reach + 28 && zd % 4 === 0)) {
        base.ink[y * W + sx] = 1;
        base.mask[y * W + sx] = 1;
      }
    }
  };
  post(ox, oy - 1, solid + 16);
  post(ox - ny * 16, oy + ny * 8 - 1, solid);
  post(ox + nx * 16 - 1, oy + nx * 8 - 1, solid);

  // 바닥 판의 앞 두 변과 두께
  const A = iso.p(0, ny, 0);
  const B = iso.p(nx, ny, 0);
  const C = iso.p(nx, 0, 0);
  base.poly([A, B, [B[0], B[1] + 6], [A[0], A[1] + 6]], 0.2);
  base.poly([B, C, [C[0], C[1] + 6], [B[0], B[1] + 6]], 0.07);
  base.line(A[0], A[1], B[0] - 1, B[1], 1);
  base.line(B[0], B[1], C[0] - 1, C[1], 1);
  base.line(A[0], A[1] + 6, B[0] - 1, B[1] + 6, 1, 1);
  base.line(B[0], B[1] + 6, C[0] - 1, C[1] + 6, 1, 1);
  base.line(A[0], A[1], A[0], A[1] + 6, 1);
  base.line(B[0] - 1, B[1], B[0] - 1, B[1] + 6, 1);
  base.line(C[0] - 1, C[1], C[0] - 1, C[1] + 6, 1);
  return base;
}

/** 그 자리 바닥에 드는 빛(0~1): 물건의 윗면을 얼마나 밝게 그릴지 어림한다 */
export function shellLight(sh: Shell, x: number, y: number) {
  let l = sh.ambient ?? 0.06;
  for (const lamp of sh.lamps) l += lampLight(lamp, x, y, 0);
  return Math.min(1, l);
}

/** 매달린 전등: 사슬과 갓, 갓 아래의 전구 */
export function paintHangingLamp(L: Layer, iso: Iso, lamp: Lamp, on = true) {
  const [x, y] = iso.p(lamp.x, lamp.y, lamp.z);
  for (let j = 8; j < 46; j++) if (j < 22 || (j < 34 ? j % 2 === 0 : j % 4 === 0)) L.dot(x, y - j, 1);
  for (let j = 0; j < 7; j++) {
    const half = 3 + j;
    for (let i = -half; i <= half; i++) L.dot(x + i, y - 7 + j, Math.abs(i) === half || j === 0 ? 1 : -1);
  }
  for (let i = -10; i <= 10; i++) L.dot(x + i, y, 1);
  if (on) {
    L.rectInk(x - 3, y + 1, 7, 2, 1);
    L.rectInk(x - 2, y + 3, 5, 1, 1);
  } else {
    L.rectInk(x - 1, y + 1, 3, 1, 1);
  }
}

/** 바닥에 놓인 것: 차지한 자리와 그림 */
export interface RoomProp {
  foot: Footprint;
  piece: Piece;
}

/** 캔버스 크기의 층에 그린 뒤 덮는 자리만 잘라 낸다 */
export function pieceOf(sh: { w: number; h: number }, draw: (L: Layer) => void): Piece {
  const L = new Layer(sh.w, sh.h);
  draw(L);
  return L.crop();
}

export const rectOf = (pc: Piece) => ({ x: pc.x, y: pc.y, w: pc.layer.w, h: pc.layer.h });

/** 방 하나: 바탕, 늘 놓여 있는 물건, 갈 수 있는 곳 */
export interface RoomDef<Id extends string> {
  w: number;
  h: number;
  iso: Iso;
  nx: number;
  ny: number;
  base: Layer;
  props: RoomProp[];
  spots: Record<Id, SpotDef>;
  /** 길을 막는 자리 */
  blocks: Footprint[];
  /** 들어섰을 때 탐정이 서 있는 자리와 바라보는 쪽(방 좌표의 방향) */
  home: Pt;
  facing?: Pt;
  /** 탐정의 키(점) */
  height?: number;
}

export interface RoomHooks<Id extends string, S extends { mark?: Id | null }> {
  /** 바탕을 깐 뒤, 물건보다 먼저 덧그리는 것(벽에 붙은 것의 상태, 바닥의 빛) */
  overlay?: (frame: Layer, state: S, time: number, scene: RoomScene<Id, S>) => void;
  /** 상태에 따라 놓이거나 모습이 바뀌는 물건 */
  items?: (state: S, time: number, scene: RoomScene<Id, S>) => RoomProp[];
  /** 다시 그려야 하는지를 가리는 값(상태와 박자). 같으면 다시 그리지 않는다. */
  key?: (state: S, time: number) => string;
  /** 탐정을 그릴 것인가 */
  actor?: (state: S) => boolean;
}

export type RoomTap<Id extends string> = { kind: "spot"; id: Id } | { kind: "floor" } | null;

const TAU = Math.PI * 2;
const BREATH = 3.4;
const facingOf = (dx: number, dy: number) => Math.atan2(dx - dy, -dx - dy);

/**
 * 방의 장면. 바닥을 누르면 탐정이 그리로 걷고, 갈 곳을 고르면 그 앞까지 가서 선다.
 * 상태에 mark 가 있으면 그곳에 모서리 괄호가 깜빡인다(탐정이 그 앞에 있거나 가는 중이면 두르지 않는다).
 */
export class RoomScene<Id extends string, S extends { mark?: Id | null }> {
  readonly w: number;
  readonly h: number;
  state: S;
  onArrive: (id: Id) => void = () => {};
  onLeave: () => void = () => {};
  at: Id | null = null;
  time = 0;

  private frame: Layer;
  private grid: WalkGrid;
  private pos: Pt;
  private facing: number;
  private action: Action = "idle";
  private t = 0;
  private target: Id | null = null;
  private path: Pt[] | null = null;
  private pathLen = 0;
  private moveT = 0;
  private moveDur = 0;
  private ping: { at: Pt; t: number } | null = null;
  private sprites = new Map<string, Layer>();
  private lastKey = "";
  private height: number;

  constructor(
    readonly def: RoomDef<Id>,
    state: S,
    private hooks: RoomHooks<Id, S> = {},
  ) {
    this.w = def.w;
    this.h = def.h;
    this.state = state;
    this.frame = new Layer(def.w, def.h);
    this.grid = new WalkGrid(def.nx, def.ny, def.blocks);
    this.pos = [...def.home];
    this.facing = def.facing ? facingOf(def.facing[0], def.facing[1]) : 0;
    this.height = def.height ?? 52;
  }

  get busy() {
    return this.path !== null;
  }

  get heading() {
    return this.path ? this.target : null;
  }

  private get spotIds() {
    return Object.keys(this.def.spots) as Id[];
  }

  tap(px: number, py: number): RoomTap<Id> {
    for (const id of this.spotIds) {
      const [x, y, w, h] = this.def.spots[id].hit;
      if (px >= x && px < x + w && py >= y && py < y + h) return { kind: "spot", id };
    }
    const { iso, nx, ny } = this.def;
    let [fx, fy] = iso.floor(px, py);
    if (fx < 0 || fy < 0) {
      const k = px - iso.ox;
      const u = Math.abs(k) / HW;
      const height = iso.oy + Math.abs(k) / 2 - py;
      if (u >= (k < 0 ? ny : nx) || height < 0 || height > 64) return null;
      [fx, fy] = k < 0 ? [0.3, u] : [u, 0.3];
    }
    if (fx > nx + 0.2 || fy > ny + 0.2) return null;
    const to = this.grid.nearest(fx, fy, 1.2);
    if (!to) return null;
    this.walk(to, null);
    this.ping = { at: to, t: 0 };
    return { kind: "floor" };
  }

  go(id: Id) {
    if (this.target === id && this.path) return;
    if (!this.path && this.at === id) {
      this.onArrive(id);
      return;
    }
    this.walk(this.def.spots[id].stand, id);
  }

  private walk(to: Pt, target: Id | null) {
    const path = this.grid.find(this.pos, to);
    const wasAt = this.at;
    this.target = target;
    this.at = null;
    if (!path || pathLength(path) < 0.05) {
      this.path = [this.pos, to];
      this.pathLen = 0;
      this.arrive();
      return;
    }
    this.path = path;
    this.pathLen = pathLength(path);
    this.moveDur = Math.max(0.4, Math.min(1.05, 0.3 + this.pathLen * 0.14));
    this.moveT = 0;
    this.action = "walk";
    if (wasAt && !target) this.onLeave();
  }

  skip() {
    if (this.path) this.arrive();
  }

  /** 걷지 않고 그 앞에 세운다 */
  place(id: Id) {
    this.path = [this.pos, this.def.spots[id].stand];
    this.target = id;
    this.arrive();
  }

  private arrive() {
    const path = this.path!;
    this.pos = [...path[path.length - 1]];
    this.path = null;
    this.t = 0;
    const id = this.target;
    this.target = null;
    if (id) {
      const s = this.def.spots[id];
      this.facing = facingOf(s.look[0] - s.stand[0], s.look[1] - s.stand[1]);
      this.action = s.arrive;
      this.at = id;
      this.onArrive(id);
    } else {
      this.action = "idle";
    }
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
  }

  hitRect(id: Id) {
    return this.def.spots[id].hit;
  }

  tagAt(id: Id): Pt {
    return this.def.spots[id].tag;
  }

  private detective() {
    const t = this.action === "idle" ? this.t % BREATH : this.t;
    const s = detectiveSprite(this.height, { action: this.action, t, facing: this.facing }, PITCH_ISO);
    const dir = Math.round((((this.facing % TAU) + TAU) % TAU) / (TAU / 16)) % 16;
    const key = `${this.action}|${dir}|${this.action === "walk" ? Math.floor((((t % 1) + 1) % 1) * 12) : Math.round(t * 12)}`;
    let layer = this.sprites.get(key);
    if (!layer) {
      layer = new Layer(s.w, s.h);
      for (let i = 0; i < s.px.length; i++) {
        if (!s.px[i]) continue;
        layer.ink[i] = s.px[i] > 0 ? 1 : -1;
        layer.mask[i] = 1;
      }
      if (this.sprites.size > 600) this.sprites.clear();
      this.sprites.set(key, layer);
    }
    const [sx, sy] = this.def.iso.p(this.pos[0], this.pos[1], 0);
    const r = 0.18;
    return {
      key,
      piece: { layer, x: Math.round(sx) - s.ax, y: Math.round(sy) - s.ay },
      foot: { x0: this.pos[0] - r, y0: this.pos[1] - r, x1: this.pos[0] + r, y1: this.pos[1] + r },
    };
  }

  /** 한 장면을 그려 out(RGBA)에 쓴다. 앞 장면과 달라진 것이 없으면 그리지 않고 false 를 돌려준다. */
  render(out: Uint8ClampedArray, force = false): boolean {
    const { def, frame, time, state } = this;
    const W = def.w;
    const actor = this.hooks.actor ? this.hooks.actor(state) : true;
    const me = this.detective();
    const mark = state.mark ?? null;
    const key = [
      this.hooks.key?.(state, time) ?? "",
      mark ?? "",
      Math.floor((time % 1.2) / 0.8),
      this.at ?? "",
      this.target ?? "",
      actor ? `${me.key}|${me.piece.x}|${me.piece.y}` : "",
      this.ping ? `${Math.floor(this.ping.t * 12)}${this.path ? "w" : ""}` : "",
    ].join("|");
    if (!force && key === this.lastKey) return false;
    this.lastKey = key;

    frame.tone.set(def.base.tone);
    frame.ink.set(def.base.ink);
    this.hooks.overlay?.(frame, state, time, this);

    if (this.ping) {
      const [cx, cy] = def.iso.p(this.ping.at[0], this.ping.at[1], 0);
      const grow = this.path ? 1 : Math.max(0, 1 - (this.ping.t - 0.5) * 5);
      if (grow > 0 && (this.ping.t * 6) % 2 < 1.4) {
        for (let k = 0; k <= 7; k++) {
          const dx = k * 2;
          const dy = 7 - k;
          for (const [qx, qy] of [[dx, dy], [-dx, dy], [dx, -dy], [-dx, -dy]] as const) frame.dot(Math.round(cx) + qx, Math.round(cy) + qy, 1);
        }
      }
    }

    const items: RoomProp[] = [...def.props, ...(this.hooks.items?.(state, time, this) ?? [])];
    if (actor) {
      const [cx, cy] = def.iso.p(this.pos[0], this.pos[1], 0);
      for (let dy = -3; dy <= 3; dy++)
        for (let dx = -9; dx <= 9; dx++) {
          if ((dx / 9) ** 2 + (dy / 3.4) ** 2 > 1) continue;
          const x = Math.round(cx) + dx;
          const y = Math.round(cy) + dy;
          if (frame.inside(x, y)) frame.tone[y * W + x] *= 0.22;
        }
      items.push(me);
    }
    for (const it of drawOrder(items)) frame.blit(it.piece.layer, it.piece.x, it.piece.y);

    if (mark && this.at !== mark && this.target !== mark && time % 1.2 < 0.8) {
      const [x, y, w, h] = def.spots[mark].frame;
      for (const [cx, cy, sx, sy] of [[x, y, 1, 1], [x + w - 1, y, -1, 1], [x, y + h - 1, 1, -1], [x + w - 1, y + h - 1, -1, -1]] as const) {
        for (let k = 0; k < 6; k++)
          for (const t of [0, 1]) {
            frame.dot(cx + sx * k, cy + sy * t, 1);
            frame.dot(cx + sx * t, cy + sy * k, 1);
          }
        for (let k = 0; k <= 6; k++) {
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
