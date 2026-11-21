// 복도 이동 데모의 "게임 쪽": 공간·물건·이동 지점을 데이터로 두고, 탐정의 상태와 환경의 변화를 시간에 따라 굴린다.
// 그리는 일은 하지 않는다. 매 장면마다 "무엇을 어디에 그릴지"(FrameOut)만 내놓고,
// 그리는 쪽(Canvas 2D · Phaser · PixiJS)은 그 목록을 그대로 그린다. 그래서 세 렌더러의 결과가 같아야 한다.

import { DOORS, H, LAMPS, VX, W, floorY, heightAt, paintCorridor, place, wallX, type CorridorArt, type Placed } from "./corridor";
import { detectiveSprite, shadowRadius, type Action } from "./detective";
import { spriteCanvas } from "./dot";

export { W, H };

export interface Spot {
  id: "board" | "practice" | "exam" | "archive";
  label: string;
  /** 도착해서 설 자리 */
  k: number;
  u: number;
  /** 도착해서 볼 쪽 */
  face: number;
  /** 누를 수 있는 영역(점 좌표): x, y, w, h */
  hit: [number, number, number, number];
  /** 도착한 뒤의 동작 */
  arrive: Action;
  /** 도착하면 뜨는 한 줄 */
  line: string;
}

/** 공간의 물건과 이동 지점. 나중에 다른 공간을 만들 때도 이 모양의 데이터만 바꾸면 된다. */
export const SPOTS: Spot[] = [
  { id: "board", label: "시험 게시판", k: 1.92, u: -0.56, face: -Math.PI / 2, hit: [58, 28, 42, 62], arrive: "interact", line: "게시판에 오늘의 사건이 붙어 있다." },
  { id: "practice", label: "연습실", k: 2.62, u: 0.6, face: Math.PI / 2, hit: [150, 26, 46, 104], arrive: "interact", line: "연습실 문이 열린다." },
  { id: "exam", label: "승급 시험실", k: 1.2, u: 0, face: 0, hit: [100, 38, 40, 56], arrive: "idle", line: "끝 방의 불이 켜져 있다. 누군가 기다린다." },
  { id: "archive", label: "기록 보관함", k: 2.78, u: -0.38, face: -Math.PI / 2, hit: [22, 92, 60, 52], arrive: "examine", line: "서랍마다 지난 사건의 기록이 들어 있다." },
];

export const HOME = { k: 2.62, u: 0.3 };

export interface ToneOp {
  key: string;
  alpha: number;
  op: "over" | "add" | "mul";
}

export interface InkOp {
  /** 같은 key 는 같은 그림이다(렌더러가 텍스처를 한 번만 만든다) */
  key: string;
  canvas: HTMLCanvasElement;
  x: number;
  y: number;
}

export interface FrameOut {
  /** 장면 전체의 좌우 밀림(점). 전경은 1.5배로 민다. */
  camX: number;
  tone: ToneOp[];
  shadows: { x: number; y: number; rx: number; ry: number }[];
  ink: InkOp[];
  fg: InkOp[];
}

export type GameEvent = { type: "depart"; spot: Spot } | { type: "arrive"; spot: Spot } | { type: "idle" };

const TAU = Math.PI * 2;
/** 복도의 실제 길이를 흉내 낸다: 화면의 k 는 거리의 역수다 */
const DEPTH = 15.8;
const worldOf = (k: number, u: number) => ({ x: u * 1.25, z: DEPTH / k });

function turnToward(from: number, to: number, max: number): number {
  let d = ((to - from + Math.PI) % TAU) - Math.PI;
  if (d < -Math.PI) d += TAU;
  if (Math.abs(d) <= max) return to;
  return from + Math.sign(d) * max;
}

export class CorridorGame {
  art: CorridorArt = paintCorridor();
  time = 0;
  k = HOME.k;
  u = HOME.u;
  facing = 0;
  action: Action = "idle";
  /** 걷는 위상 또는 동작의 경과 시간 */
  t = 0;
  camX = 0;
  target: Spot | null = null;
  /** 지금 서 있는 곳 */
  at: Spot | null = null;
  line = "복도에 섰다. 갈 곳을 누른다.";
  onEvent: (e: GameEvent) => void = () => {};

  private from = { k: HOME.k, u: HOME.u };
  private moveT = 0;
  private moveDur = 0;
  private doorOpen = 0;
  private spriteCache = new Map<string, HTMLCanvasElement>();

  /** 점 좌표를 눌렀을 때: 물건 위면 그리로 간다. 걷는 중에 다시 누르면 건너뛴다. */
  tap(x: number, y: number): Spot | null {
    if (this.target) {
      this.skip();
      return this.at;
    }
    const sx = x + this.camX;
    const spot = SPOTS.find((s) => sx >= s.hit[0] && sx < s.hit[0] + s.hit[2] && y >= s.hit[1] && y < s.hit[1] + s.hit[3]);
    if (spot) this.go(spot.id);
    return spot ?? null;
  }

  go(id: Spot["id"]) {
    const spot = SPOTS.find((s) => s.id === id)!;
    if (this.target) {
      this.skip();
      if (this.at === spot) return;
    }
    if (this.at === spot) return;
    this.target = spot;
    this.from = { k: this.k, u: this.u };
    const a = worldOf(this.k, this.u);
    const b = worldOf(spot.k, spot.u);
    const dist = Math.hypot(b.x - a.x, b.z - a.z);
    // 이동은 0.5~1.2초 안에 끝낸다. 매일 여는 화면이라 길게 걷게 하지 않는다.
    this.moveDur = Math.max(0.5, Math.min(1.2, 0.42 + dist * 0.11));
    this.moveT = 0;
    this.action = "walk";
    this.at = null;
    this.doorOpen = 0;
    this.line = `${spot.label}(으)로 간다.`;
    this.onEvent({ type: "depart", spot });
  }

  /** 걷는 중이면 곧바로 도착시킨다 */
  skip() {
    if (!this.target) return;
    this.moveT = this.moveDur;
    this.arrive();
  }

  private arrive() {
    const spot = this.target!;
    this.k = spot.k;
    this.u = spot.u;
    this.facing = spot.face;
    this.action = spot.arrive;
    this.t = 0;
    this.target = null;
    this.at = spot;
    this.line = spot.line;
    this.onEvent({ type: "arrive", spot });
  }

  /** 비교용: 시간을 멈춘다. 멈춘 동안에는 어느 렌더러든 같은 장면을 그려야 한다. */
  frozen = false;

  update(dt: number) {
    if (this.frozen) return;
    dt = Math.min(dt, 0.1);
    this.time += dt;
    if (this.target) {
      const spot = this.target;
      this.moveT += dt;
      const p = Math.min(1, this.moveT / this.moveDur);
      const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      const a = worldOf(this.from.k, this.from.u);
      const b = worldOf(spot.k, spot.u);
      const x = a.x + (b.x - a.x) * e;
      const z = a.z + (b.z - a.z) * e;
      this.k = DEPTH / z;
      this.u = x / 1.25;
      const want = Math.atan2(b.x - a.x, (b.z - a.z) * 0.5);
      this.facing = turnToward(this.facing, want, dt * 16);
      // 걸음: 초당 약 2.4바퀴(빠른 걸음). 거리와 딱 맞추지는 않는다.
      this.t += dt * 2.4;
      if (p >= 1) this.arrive();
    } else {
      this.t += dt;
      // 짚기·모자 인사는 잠깐 하고 서 있는 자세로 돌아간다
      if (this.action === "success" && this.t > 1.2) {
        this.action = "idle";
        this.t = 0;
      }
    }
    // 연습실 앞에 서면 문이 열린다
    const wantOpen = this.at?.id === "practice" ? 1 : 0;
    this.doorOpen += Math.sign(wantOpen - this.doorOpen) * Math.min(Math.abs(wantOpen - this.doorOpen), dt * 4);
    // 카메라: 가는 곳 쪽으로 조금 쏠린다 (점 단위로 끊어서)
    const focus = this.target ?? this.at;
    const wantCam = focus ? Math.max(-9, Math.min(9, (place(focus.k, focus.u).x - VX) * 0.16)) : 0;
    this.camX += (wantCam - this.camX) * Math.min(1, dt * 5);
  }

  /** 환경의 변화: 정해진 박자로 돈다(아무 때나 깜빡이지 않는다) */
  private ambient() {
    const t = this.time;
    // 가운데 등: 11초마다 두 번 짧게 꺼진다
    const a = t % 11;
    const lamp1 = (a > 7.0 && a < 7.07) || (a > 7.16 && a < 7.3) ? 0 : 1;
    // 가까운 등: 29초마다 한 번 길게 어두워진다
    const b = t % 29;
    const lamp2 = b > 19 && b < 19.4 ? 0 : 1;
    // 먼 오른쪽 문: 17초마다 2초 동안 열렸다 닫힌다
    const c = t % 17;
    const doorR0 = c > 9 && c < 11 ? 1 : 0;
    // 끝 방의 사람: 23초 가운데 13초는 문간에 서 있고, 지나가고, 비어 있다
    const d = t % 23;
    let figure: { x: number; facing: number; walk: boolean } | null = null;
    if (d < 13) figure = { x: 0, facing: Math.PI, walk: false };
    else if (d < 15) figure = { x: ((d - 13) / 2) * 12, facing: Math.PI / 2, walk: true };
    else if (d > 21) figure = { x: -12 + ((d - 21) / 2) * 12, facing: Math.PI / 2, walk: true };
    // 게시판 종이: 13초마다 한 번 팔랑인다
    const e = t % 13;
    const papers = e > 5 && e < 5.8 ? 1 + (Math.floor((e - 5) / 0.2) % 2) : 0;
    return { lamp1, lamp2, doorR0, figure, papers };
  }

  private sprite(h: number, action: Action, t: number, facing: number): InkOp & { ax: number; ay: number } {
    const s = detectiveSprite(h, { action, t, facing });
    const key = `det|${h}|${action}|${Math.round(((facing % TAU) + TAU) / (TAU / 16)) % 16}|${action === "walk" ? Math.floor((((t % 1) + 1) % 1) * 12) : Math.round(t * 12)}`;
    let canvas = this.spriteCache.get(key);
    if (!canvas) {
      canvas = spriteCanvas(s);
      if (this.spriteCache.size > 1500) this.spriteCache.clear();
      this.spriteCache.set(key, canvas);
    }
    return { key, canvas, x: 0, y: 0, ax: s.ax, ay: s.ay };
  }

  frame(): FrameOut {
    const { art } = this;
    const amb = this.ambient();
    const tone: ToneOp[] = [
      { key: "base", alpha: 1, op: "over" },
      { key: "lamp0", alpha: 1, op: "add" },
      { key: "lamp1", alpha: amb.lamp1, op: "add" },
      { key: "lamp2", alpha: amb.lamp2, op: "add" },
      { key: "far", alpha: 1, op: "add" },
      { key: "doorR0", alpha: amb.doorR0, op: "add" },
      { key: "doorR2", alpha: this.doorOpen > 0.5 ? 1 : 0, op: "add" },
      { key: "runner", alpha: 1, op: "mul" },
    ];
    const ink: InkOp[] = [];
    const put = (key: string) => {
      const p: Placed = art.ink[key];
      ink.push({ key, canvas: p.canvas, x: p.x, y: p.y });
    };
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

    const shadows: FrameOut["shadows"] = [];
    // 끝 방의 사람
    if (amb.figure) {
      const f = this.sprite(21, amb.figure.walk ? "walk" : "idle", amb.figure.walk ? this.time * 1.6 : this.time, amb.figure.facing);
      const x = Math.round(VX + amb.figure.x - f.ax);
      const y = Math.round(floorY(1) - f.ay);
      // 문 밖으로 나간 부분은 벽에 가려진다: 문 폭 안에서만 그린다
      if (Math.abs(amb.figure.x) < 9) ink.push({ ...f, x, y });
    }
    // 탐정
    const hgt = heightAt(this.k);
    const me = this.sprite(hgt, this.action, this.t, this.facing);
    const pos = place(this.k, this.u);
    const [rx, ry] = shadowRadius(hgt);
    shadows.push({ x: Math.round(pos.x), y: Math.round(pos.y), rx, ry });
    ink.push({ ...me, x: Math.round(pos.x - me.ax), y: Math.round(pos.y - me.ay) });

    const fgArt = art.ink.fg;
    return { camX: Math.round(this.camX), tone, shadows, ink, fg: [{ key: "fg", canvas: fgArt.canvas, x: fgArt.x, y: fgArt.y }] };
  }
}

/** 문 위치 등 다른 파일이 쓰는 값 */
export const GEOMETRY = { DOORS, LAMPS, wallX, floorY };
