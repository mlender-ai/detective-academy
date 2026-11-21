// 자료실 장면. 탐정이 문으로 들어와 책상(기록)과 금고 사이를 걷는다.
// 물건을 누르면 그 앞까지 걸어가(0.4~0.7초) 벽 쪽으로 돌아선다. 정답이면 금고가 열린다.
import { detectiveSprite, shadowRadius, type Action } from "./detective";
import { spriteCanvas } from "./dot";
import { easeInOut, turnToward, type Scene } from "./homeScene";
import { bracketSpots, cornerBrackets } from "./marks";
import type { Placed } from "./sideArt";
import type { InkOp, StageFrame, ToneOp } from "./stage";
import { V_BOX, V_WALK, VH, VW, paintVault, type VaultArt } from "./vaultArt";

/** 자료실에서 갈 수 있는 곳 */
export type VaultSpot = "desk" | "safe";

/** 장면에 반영되는 풀이 상태 */
export interface VaultState {
  /** 금고가 열렸는가 (정답) */
  open: boolean;
  /** 다음에 갈 곳. 그 물건에 모서리 괄호가 깜빡인다. */
  mark?: VaultSpot | null;
}

type Box = readonly [number, number, number, number];

interface Spot {
  x: number;
  hit: Box;
  frame: Box;
  arrive: Action;
}

const grow = (b: Box, pad: number): Box => [b[0] - pad, b[1] - pad, b[2] + pad * 2, b[3] + pad * 2];

/** 설 자리와 누를 영역. 책상에서는 기록지의 왼쪽에, 금고에서는 다이얼의 왼쪽에 서서 손을 뻗는다(물건을 가리지 않게). */
const SPOTS: Record<VaultSpot, Spot> = {
  desk: { x: V_BOX.sheet[0] - 10, hit: [54, 26, 68, 72], frame: grow([V_BOX.desk[0], V_BOX.sheet[1], V_BOX.desk[2], V_BOX.desk[1] + V_BOX.desk[3] - V_BOX.sheet[1]], 7), arrive: "interact" },
  safe: { x: V_BOX.safe[0] + 9, hit: [142, 16, 62, 82], frame: grow(V_BOX.safe, 8), arrive: "interact" },
};

/** 문 안쪽: 들어서는 자리 */
const DOOR_X = V_BOX.door[0] + 8;
const HEIGHT = 46;
const TAU = Math.PI * 2;

export class VaultScene implements Scene<VaultSpot, VaultState> {
  readonly w = VW;
  readonly h = VH;
  state: VaultState = { open: false };
  onArrive: (id: VaultSpot) => void = () => {};
  at: VaultSpot | null = null;

  private art: VaultArt = paintVault();
  private time = 0;
  private x = DOOR_X;
  private facing = Math.PI / 2;
  private action: Action = "idle";
  private t = 0;
  private target: VaultSpot | null = null;
  private fromX = DOOR_X;
  private moveT = 0;
  private moveDur = 0;
  /** 금고가 열리는 정도 0~1 */
  private openT = 0;
  private sprites = new Map<string, HTMLCanvasElement>();
  private brackets = cornerBrackets();

  get busy() {
    return this.target !== null;
  }

  setView() {
    // 방이 화면에 다 들어오므로 카메라를 옮기지 않는다
  }

  hit(x: number, y: number): VaultSpot | null {
    for (const id of Object.keys(SPOTS) as VaultSpot[]) {
      const [hx, hy, hw, hh] = SPOTS[id].hit;
      if (x >= hx && x < hx + hw && y >= hy && y < hy + hh) return id;
    }
    return null;
  }

  go(id: VaultSpot) {
    if (this.target === id) return;
    if (!this.target && this.at === id) {
      this.onArrive(id);
      return;
    }
    this.target = id;
    this.fromX = this.x;
    // 책상과 금고 사이는 자주 오간다: 0.4~0.7초 안에 끝낸다
    this.moveDur = Math.max(0.4, Math.min(0.7, 0.26 + Math.abs(SPOTS[id].x - this.x) * 0.005));
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
    this.facing = 0;
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
      this.t += Math.max(dt * 1.2, Math.abs(this.x - before) / 26);
      if (p >= 1) this.arrive();
    } else {
      this.t += dt;
      if (this.at && this.action !== "idle" && this.action !== "success" && this.t > 2.4) {
        this.action = "idle";
        this.t = 0;
      }
    }
    // 금고가 열린다: 문틈의 빛 → 활짝. 열리면 탐정이 모자에 손을 댄다.
    const want = this.state.open ? 1 : 0;
    const before = this.openT;
    this.openT += Math.sign(want - this.openT) * Math.min(Math.abs(want - this.openT), dt * 2.6);
    if (before < 0.6 && this.openT >= 0.6 && !this.target) {
      this.action = "success";
      this.t = 0;
    }
  }

  private sprite(action: Action, t: number, facing: number) {
    const s = detectiveSprite(HEIGHT, { action, t, facing });
    const dir = Math.round((((facing % TAU) + TAU) % TAU) / (TAU / 16)) % 16;
    const key = `${action}|${dir}|${action === "walk" ? Math.floor((((t % 1) + 1) % 1) * 12) : Math.round(t * 12)}`;
    let canvas = this.sprites.get(key);
    if (!canvas) {
      canvas = spriteCanvas(s);
      if (this.sprites.size > 400) this.sprites.clear();
      this.sprites.set(key, canvas);
    }
    return { canvas, ax: s.ax, ay: s.ay };
  }

  frame(): StageFrame {
    const { art, time } = this;
    const tone: ToneOp[] = [];
    const add = (key: string, alpha: number, op: ToneOp["op"]) => tone.push({ canvas: art.tone[key], alpha, op });
    const ajar = this.openT > 0.05 && this.openT < 0.6;
    const open = this.openT >= 0.6;

    // 환경의 박자: 금고 위의 등이 17초마다 두 번 깜빡인다
    const a = time % 17;
    const lamp1 = (a > 11.0 && a < 11.07) || (a > 11.2 && a < 11.36) ? 0 : 1;

    add("base", 1, "over");
    add("lamp0", 1, "add");
    add("lamp1", lamp1, "add");
    add("dark", 1, "mul");
    add("steel", open ? 0 : 1, "add");
    add("deskLamp", 1, "add");
    add("safeAjar", ajar ? 1 : 0, "add");
    add("safeOpen", open ? 1 : 0, "add");

    const ink: InkOp[] = [];
    const put = (p: Placed) => ink.push({ canvas: p.canvas, x: p.x, y: p.y });
    put(art.ink.mid);
    put(art.ink.bulb0);
    if (lamp1) put(art.ink.bulb1);
    put(art.ink.safeBody);
    put(open ? art.ink.safeOpen : art.ink.safeDoor);

    // 다음에 갈 곳: 모서리 괄호가 끊어서 깜빡인다
    const mark = this.state.mark;
    if (mark && this.at !== mark && this.target !== mark && time % 1.2 < 0.8) {
      bracketSpots(SPOTS[mark].frame).forEach(([x, y], i) => ink.push({ canvas: this.brackets[i], x, y }));
    }

    const me = this.sprite(this.action, this.t, this.facing);
    const [rx, ry] = shadowRadius(HEIGHT);
    ink.push({ canvas: me.canvas, x: Math.round(this.x - me.ax), y: V_WALK - me.ay });

    return { tone, shadows: [{ x: Math.round(this.x), y: V_WALK, rx, ry }], ink };
  }
}

export { VH as VAULT_H, VW as VAULT_W };
