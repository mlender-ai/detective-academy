// A안 · 시네마틱 복도의 장면. 깊이 방향으로 본 복도에 탐정이 서 있고,
// 갈 곳이 정해지면 그쪽으로 짧게 걸어간다(0.5~1.2초). 환경은 정해진 박자로 바뀐다.
import { VX, floorY, heightAt, paintCorridor, place, type CorridorArt } from "./depthArt";
import { detectiveSprite, shadowRadius, type Action } from "./detective";
import { spriteCanvas } from "./dot";
import { easeInOut, turnToward, type HomeScene, type SceneState, type SpotId } from "./homeScene";
import type { InkOp, StageFrame, ToneOp } from "./stage";

interface Spot {
  k: number;
  u: number;
  face: number;
  hit: [number, number, number, number];
  arrive: Action;
}

const SPOTS: Record<SpotId, Spot> = {
  board: { k: 1.92, u: -0.56, face: -Math.PI / 2, hit: [58, 28, 42, 62], arrive: "interact" },
  practice: { k: 2.62, u: 0.6, face: Math.PI / 2, hit: [150, 26, 46, 104], arrive: "interact" },
  exam: { k: 1.2, u: 0, face: 0, hit: [100, 38, 40, 56], arrive: "idle" },
  archive: { k: 2.78, u: -0.38, face: -Math.PI / 2, hit: [22, 92, 60, 52], arrive: "examine" },
};

const TAU = Math.PI * 2;
/** 복도의 실제 길이를 흉내 낸다: 화면의 k 는 거리의 역수다 */
const DEPTH = 15.8;
const worldOf = (k: number, u: number) => ({ x: u * 1.25, z: DEPTH / k });

export class DepthScene implements HomeScene {
  readonly w = 240;
  readonly h = 160;
  state: SceneState = { dailySolved: false, examRank: "D", examOpen: false };
  onArrive: (id: SpotId) => void = () => {};
  at: SpotId | null = null;

  private art: CorridorArt = paintCorridor();
  private time = 0;
  private k = 2.4;
  private u = 0.58;
  private facing = 0;
  private action: Action = "idle";
  private t = 0;
  private camX = 0;
  private target: SpotId | null = null;
  private from = { k: 2.4, u: 0.58 };
  private moveT = 0;
  private moveDur = 0;
  private doorOpen = 0;
  private sprites = new Map<string, HTMLCanvasElement>();
  /** 탐정이 서 있을 수 있는 가장 가까운 깊이(화면 아래로 잘리지 않게) */
  private nearK = 2.62;

  get busy() {
    return this.target !== null;
  }

  setView(view: { x0: number; y0: number; x1: number; y1: number }) {
    // 발이 보이는 영역 아래 끝에서 6점 위에 오도록 한다
    this.nearK = Math.max(1.5, Math.min(2.62, (view.y1 - 6 - floorY(0)) / (floorY(1) - floorY(0))));
    if (!this.target && !this.at) {
      this.k = this.nearK;
      this.from.k = this.nearK;
    }
  }

  private spot(id: SpotId): Spot {
    const s = SPOTS[id];
    // 가까운 자리는 화면에 맞춰 당긴다
    return { ...s, k: Math.min(s.k, this.nearK) };
  }

  hit(x: number, y: number): SpotId | null {
    const sx = x + Math.round(this.camX);
    for (const id of Object.keys(SPOTS) as SpotId[]) {
      const [hx, hy, hw, hh] = SPOTS[id].hit;
      if (sx >= hx && sx < hx + hw && y >= hy && y < hy + hh) return id;
    }
    return null;
  }

  go(id: SpotId) {
    if (this.target === id) return;
    if (!this.target && this.at === id) {
      this.onArrive(id);
      return;
    }
    const spot = this.spot(id);
    this.target = id;
    this.from = { k: this.k, u: this.u };
    const a = worldOf(this.k, this.u);
    const b = worldOf(spot.k, spot.u);
    this.moveDur = Math.max(0.5, Math.min(1.2, 0.42 + Math.hypot(b.x - a.x, b.z - a.z) * 0.11));
    this.moveT = 0;
    this.action = "walk";
    this.at = null;
  }

  skip() {
    if (this.target) this.arrive();
  }

  private arrive() {
    const id = this.target!;
    const spot = this.spot(id);
    this.k = spot.k;
    this.u = spot.u;
    this.facing = spot.face;
    this.action = spot.arrive;
    this.t = 0;
    this.target = null;
    this.at = id;
    this.onArrive(id);
  }

  update(dt: number) {
    this.time += dt;
    if (this.target) {
      const spot = this.spot(this.target);
      this.moveT += dt;
      const p = Math.min(1, this.moveT / this.moveDur);
      const e = easeInOut(p);
      const a = worldOf(this.from.k, this.from.u);
      const b = worldOf(spot.k, spot.u);
      this.k = DEPTH / (a.z + (b.z - a.z) * e);
      this.u = (a.x + (b.x - a.x) * e) / 1.25;
      this.facing = turnToward(this.facing, Math.atan2(b.x - a.x, (b.z - a.z) * 0.5), dt * 16);
      this.t += dt * 2.4;
      if (p >= 1) this.arrive();
    } else {
      this.t += dt;
    }
    const wantOpen = this.at === "practice" ? 1 : 0;
    this.doorOpen += Math.sign(wantOpen - this.doorOpen) * Math.min(Math.abs(wantOpen - this.doorOpen), dt * 4);
    const focus = this.target ?? this.at;
    const wantCam = focus ? Math.max(-9, Math.min(9, (place(SPOTS[focus].k, SPOTS[focus].u).x - VX) * 0.16)) : 0;
    this.camX += (wantCam - this.camX) * Math.min(1, dt * 5);
  }

  /** 환경의 변화: 정해진 박자로 돈다 (아무 때나 깜빡이지 않는다) */
  private ambient() {
    const t = this.time;
    const a = t % 11;
    const lamp1 = (a > 7.0 && a < 7.07) || (a > 7.16 && a < 7.3) ? 0 : 1;
    const b = t % 29;
    const lamp2 = b > 19 && b < 19.4 ? 0 : 1;
    const c = t % 17;
    const doorR0 = c > 9 && c < 11 ? 1 : 0;
    const d = t % 23;
    let figure: { x: number; facing: number; walk: boolean } | null = null;
    if (d < 13) figure = { x: 0, facing: Math.PI, walk: false };
    else if (d < 15) figure = { x: ((d - 13) / 2) * 12, facing: Math.PI / 2, walk: true };
    else if (d > 21) figure = { x: -12 + ((d - 21) / 2) * 12, facing: Math.PI / 2, walk: true };
    const e = t % 13;
    const papers = e > 5 && e < 5.8 ? 1 + (Math.floor((e - 5) / 0.2) % 2) : 0;
    return { lamp1, lamp2, doorR0, figure, papers };
  }

  private sprite(h: number, action: Action, t: number, facing: number) {
    const s = detectiveSprite(h, { action, t, facing });
    const dir = Math.round((((facing % TAU) + TAU) % TAU) / (TAU / 16)) % 16;
    const key = `${h}|${action}|${dir}|${action === "walk" ? Math.floor((((t % 1) + 1) % 1) * 12) : Math.round(t * 12)}`;
    let canvas = this.sprites.get(key);
    if (!canvas) {
      canvas = spriteCanvas(s);
      if (this.sprites.size > 600) this.sprites.clear();
      this.sprites.set(key, canvas);
    }
    return { canvas, ax: s.ax, ay: s.ay };
  }

  frame(): StageFrame {
    const { art } = this;
    const amb = this.ambient();
    const cam = Math.round(this.camX);
    const layer = (key: string, alpha: number, op: ToneOp["op"]): ToneOp => ({ canvas: art.tone[key], alpha, op, x: -cam });
    const tone: ToneOp[] = [
      layer("base", 1, "over"),
      layer("lamp0", 1, "add"),
      layer("lamp1", amb.lamp1, "add"),
      layer("lamp2", amb.lamp2, "add"),
      layer("far", 1, "add"),
      layer("doorR0", amb.doorR0, "add"),
      layer("doorR2", this.doorOpen > 0.5 ? 1 : 0, "add"),
      layer("runner", 1, "mul"),
    ];
    const ink: InkOp[] = [];
    const put = (key: string, shift = cam) => ink.push({ canvas: art.ink[key].canvas, x: art.ink[key].x - shift, y: art.ink[key].y });
    put("mid");
    if (this.doorOpen <= 0.5) put("doorR2closed");
    put(`papers${amb.papers}`);
    put(amb.lamp1 ? "lampOn1" : "lampOff1");
    put("lampOn0");
    put(amb.lamp2 ? "lampOn2" : "lampOff2");
    put("signBoard");
    put("signPractice");
    put("signExam");
    put("signArchive");
    // 탐정이 끝 방 앞으로 가면 방 안의 사람은 비켜 준다(두 실루엣이 겹치지 않게)
    const nearEnd = (this.target === "exam" || this.at === "exam") && this.k < 1.9;
    if (amb.figure && Math.abs(amb.figure.x) < 9 && !nearEnd) {
      const f = this.sprite(21, amb.figure.walk ? "walk" : "idle", amb.figure.walk ? this.time * 1.6 : this.time, amb.figure.facing);
      ink.push({ canvas: f.canvas, x: Math.round(VX + amb.figure.x - f.ax) - cam, y: Math.round(floorY(1) - f.ay) });
    }
    const hgt = heightAt(this.k);
    const me = this.sprite(hgt, this.action, this.t, this.facing);
    const pos = place(this.k, this.u);
    const [rx, ry] = shadowRadius(hgt);
    ink.push({ canvas: me.canvas, x: Math.round(pos.x - me.ax) - cam, y: Math.round(pos.y - me.ay) });
    put("fg", Math.round(cam * 1.5));
    return { tone, shadows: [{ x: Math.round(pos.x) - cam, y: Math.round(pos.y), rx, ry }], ink };
  }
}
