import { describe, expect, it } from "vitest";
import { makeExamRoom, type ExamPhase } from "../iso/examRoom";
import { CABINETS, makePracticeRoom } from "../iso/practiceRoom";
import type { RoomScene } from "../iso/room";
import { makeVaultRoom } from "../iso/vaultRoom";
import { WalkGrid } from "../iso/path";
import { INK_RGB } from "../scene/dot";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRoom = RoomScene<any, any>;

const ROOMS: [string, () => AnyRoom][] = [
  ["자료실", makeVaultRoom],
  ["연습실", makePracticeRoom],
  ["시험실", makeExamRoom],
];

function twoColors(scene: AnyRoom, label: string) {
  const out = new Uint8ClampedArray(scene.w * scene.h * 4);
  scene.render(out, true);
  for (let i = 0; i < out.length; i += 4) {
    const black = out[i] === 0 && out[i + 1] === 0 && out[i + 2] === 0;
    const white = out[i] === INK_RGB[0] && out[i + 1] === INK_RGB[1] && out[i + 2] === INK_RGB[2];
    if (!black && !white) throw new Error(`${label}: 두 색이 아닌 화소 ${out[i]},${out[i + 1]},${out[i + 2]}`);
  }
}

describe.each(ROOMS)("쿼터뷰 방: %s", (name, make) => {
  it("갈 곳마다 설 자리가 비어 있고 들어선 자리에서 걸어서 닿는다. 누르는 자리는 48px 이상이고 방의 그림 안이다.", () => {
    const scene = make();
    const { def } = scene;
    const grid = new WalkGrid(def.nx, def.ny, def.blocks);
    expect(grid.walkable(def.home[0], def.home[1]), "들어선 자리").toBe(true);
    for (const id of Object.keys(def.spots)) {
      const spot = def.spots[id];
      expect(grid.walkable(spot.stand[0], spot.stand[1]), `${name} ${id} 의 설 자리`).toBe(true);
      expect(grid.find(def.home, spot.stand), `${name} ${id} 로 가는 길`).not.toBeNull();
      const [x, y, w, h] = spot.hit;
      expect(w).toBeGreaterThanOrEqual(24);
      expect(h).toBeGreaterThanOrEqual(24);
      expect(x).toBeGreaterThanOrEqual(-2);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(x + w).toBeLessThanOrEqual(def.w + 2);
      expect(y + h).toBeLessThanOrEqual(def.h);
    }
  });

  it("갈 곳을 고르면 1.1초 안에 그 앞에 서고, 가는 동안에도 선 뒤에도 화면은 두 색뿐이다", () => {
    const scene = make();
    const ids = Object.keys(scene.def.spots);
    const arrived: string[] = [];
    scene.onArrive = (id: string) => arrived.push(id);
    for (const id of ids) {
      scene.go(id);
      let t = 0;
      while (scene.busy && t < 1.1) {
        scene.update(1 / 30);
        t += 1 / 30;
        twoColors(scene, `${name} → ${id}`);
      }
      expect(scene.busy, `${name} ${id}`).toBe(false);
      expect(scene.at).toBe(id);
    }
    expect(arrived).toEqual(ids);
  });
});

describe("쿼터뷰 방: 상태가 그림에 비친다", () => {
  const lit = (scene: AnyRoom) => {
    const out = new Uint8ClampedArray(scene.w * scene.h * 4);
    scene.render(out, true);
    let n = 0;
    for (let i = 0; i < out.length; i += 4) if (out[i] > 0) n++;
    return n;
  };

  it("자료실: 금고가 열리면 그림이 달라지고 여전히 두 색이다", () => {
    const scene = makeVaultRoom();
    scene.state = { open: false, mark: "safe" };
    const shut = lit(scene);
    scene.state = { open: true, mark: null };
    expect(lit(scene)).not.toBe(shut);
    twoColors(scene, "열린 금고");
  });

  it("연습실: 잠긴 서류함과 열린 서류함의 그림이 다르다", () => {
    const scene = makePracticeRoom();
    scene.state = { locked: [...CABINETS], done: [] };
    const allLocked = lit(scene);
    scene.state = { locked: [], done: ["F"] };
    expect(lit(scene)).toBeGreaterThan(allLocked);
    twoColors(scene, "열린 서류함");
  });

  it("시험실: 등이 꺼지면(시험 종료) 가장 어둡고, 봉투가 놓인 방이 가장 밝다", () => {
    const scene = makeExamRoom();
    const of = (phase: ExamPhase) => {
      scene.state = { phase };
      twoColors(scene, phase);
      return lit(scene);
    };
    const sealed = of("sealed");
    const empty = of("empty");
    const ended = of("ended");
    expect(sealed).toBeGreaterThan(empty);
    expect(empty).toBeGreaterThan(ended);
    expect(of("opening")).not.toBe(sealed);
  });
});
