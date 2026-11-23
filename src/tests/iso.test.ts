import { describe, expect, it } from "vitest";
import { H, ISO, NX, NY, W, paintHall, type HallSpot } from "../iso/hallArt";
import { HallScene, type HallState } from "../iso/hallScene";
import { Iso, drawOrder, toneLevel } from "../iso/iso";
import { WalkGrid, pathLength } from "../iso/path";
import { INK_RGB } from "../scene/dot";

const SPOTS: HallSpot[] = ["board", "practice", "exam", "archive", "case"];
const HOME: [number, number] = [3.9, 4.9];

describe("쿼터뷰: 투영과 밝기 단계", () => {
  it("바닥의 점을 방 좌표로 되돌리면 제자리다", () => {
    const iso = new Iso(98, 186);
    for (const [x, y] of [[0, 0], [1.5, 4.25], [6, 6], [5.75, 0.125]] as const) {
      const [px, py] = iso.p(x, y, 0);
      const [fx, fy] = iso.floor(px, py);
      expect(fx).toBeCloseTo(x, 6);
      expect(fy).toBeCloseTo(y, 6);
    }
  });

  it("밝기는 일곱 단계로만 끊기고, 밝을수록 단계가 내려가지 않는다", () => {
    const levels = new Set<number>();
    let last = 0;
    for (let t = -0.2; t <= 1.6; t += 0.001) {
      const k = toneLevel(t);
      expect(k).toBeGreaterThanOrEqual(last);
      last = k;
      levels.add(k);
    }
    expect([...levels].sort((a, b) => a - b)).toEqual([0, 1, 2, 4, 8, 12, 16]);
  });
});

describe("쿼터뷰: 깊이 정렬", () => {
  const foot = (x0: number, y0: number, x1: number, y1: number) => ({ x0, y0, x1, y1 });

  it("뒤에 있는 것을 먼저 그린다", () => {
    const cabinet = { id: "cabinet", foot: foot(0.5, 0.125, 2.0, 0.75) };
    const tv = { id: "tv", foot: foot(4.75, 2.75, 5.75, 3.375) };
    const me = (x: number, y: number) => ({ id: "me", foot: foot(x - 0.18, y - 0.18, x + 0.18, y + 0.18) });
    const order = (items: { id: string; foot: ReturnType<typeof foot> }[]) => drawOrder(items).map((i) => i.id);
    // 보관함 앞에 서면 보관함이 먼저, 탐정이 나중
    expect(order([me(1.3, 1.4), cabinet, tv]).indexOf("cabinet")).toBeLessThan(order([me(1.3, 1.4), cabinet, tv]).indexOf("me"));
    // 텔레비전 뒤(벽 쪽)에 서면 탐정이 먼저, 텔레비전이 나중
    expect(order([tv, me(5.2, 2.2), cabinet]).indexOf("me")).toBeLessThan(order([tv, me(5.2, 2.2), cabinet]).indexOf("tv"));
    // 텔레비전 앞(화면 쪽)에 서면 텔레비전이 먼저
    expect(order([me(4.4, 4.0), tv]).indexOf("tv")).toBeLessThan(order([me(4.4, 4.0), tv]).indexOf("me"));
  });

  it("넣은 것을 빠짐없이 한 번씩 돌려준다", () => {
    const items = Array.from({ length: 12 }, (_, i) => ({ id: i, foot: foot((i * 7) % 5, (i * 3) % 5, ((i * 7) % 5) + 0.6, ((i * 3) % 5) + 0.6) }));
    expect(drawOrder(items).map((i) => i.id).sort((a, b) => a - b)).toEqual(items.map((i) => i.id));
  });
});

describe("쿼터뷰: 학원 홀", () => {
  const art = paintHall();

  it("누르는 자리는 48px(24점) 이상이고 장면 안에 있으며 서로 겹치지 않는다", () => {
    for (const id of SPOTS) {
      const [x, y, w, h] = art.spots[id].hit;
      expect(w, id).toBeGreaterThanOrEqual(24);
      expect(h, id).toBeGreaterThanOrEqual(24);
      expect(x, id).toBeGreaterThanOrEqual(-2);
      expect(y, id).toBeGreaterThanOrEqual(0);
      expect(x + w, id).toBeLessThanOrEqual(W + 2);
      expect(y + h, id).toBeLessThanOrEqual(H);
    }
    for (let a = 0; a < SPOTS.length; a++)
      for (let b = a + 1; b < SPOTS.length; b++) {
        const [ax, ay, aw, ah] = art.spots[SPOTS[a]].hit;
        const [bx, by, bw, bh] = art.spots[SPOTS[b]].hit;
        const overlap = ax < bx + bw && bx < ax + aw && ay < by + bh && by < ay + ah;
        expect(overlap, `${SPOTS[a]} · ${SPOTS[b]}`).toBe(false);
      }
  });

  it("모든 곳에 걸어서 닿는다: 설 자리가 비어 있고, 길이 물건을 지나지 않는다", () => {
    for (const blocks of [art.blocks, art.blocks.filter((_, i) => i !== 1)]) {
      const grid = new WalkGrid(NX, NY, blocks);
      for (const id of SPOTS) {
        const stand = art.spots[id].stand;
        expect(grid.walkable(stand[0], stand[1]), `${id} 의 설 자리`).toBe(true);
        for (const from of [HOME, ...SPOTS.map((s) => art.spots[s].stand)]) {
          const path = grid.find(from, stand);
          expect(path, `${from} → ${id}`).not.toBeNull();
          // 길 위의 자리는 모두 설 수 있는 자리다
          for (let i = 1; i < path!.length; i++) {
            const [ax, ay] = path![i - 1];
            const [bx, by] = path![i];
            for (let k = 0; k <= 20; k++) expect(grid.walkable(ax + ((bx - ax) * k) / 20, ay + ((by - ay) * k) / 20)).toBe(true);
          }
          // 방을 가로질러도 터무니없이 돌지 않는다
          expect(pathLength(path!)).toBeLessThan(11);
        }
      }
    }
  });

  it("물건이 차지한 자리는 걸을 수 없다", () => {
    const grid = new WalkGrid(NX, NY, art.blocks);
    for (const b of art.blocks) expect(grid.walkable((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2)).toBe(false);
    expect(grid.nearest(1.25, 0.4)).not.toBeNull();
  });

  it("이름표는 장면 안에 놓인다", () => {
    for (const id of SPOTS) {
      const [x, y] = art.spots[id].tag;
      expect(x).toBeGreaterThan(8);
      expect(x).toBeLessThan(W - 8);
      expect(y).toBeGreaterThan(40);
    }
  });
});

describe("쿼터뷰: 장면", () => {
  const STATES: HallState[] = [
    { dailySolved: false, examRank: "D", examOpen: false, mark: "board", caseStatus: "locked" },
    { dailySolved: true, examRank: "C", examOpen: true, mark: "exam", caseStatus: "new" },
    { dailySolved: true, examRank: "S", examOpen: false, mark: null, caseStatus: "cleared" },
  ];

  it("어느 상태 · 어느 순간에도 화면은 두 색뿐이다", () => {
    const out = new Uint8ClampedArray(W * H * 4);
    for (const state of STATES) {
      const scene = new HallScene();
      scene.state = state;
      scene.go("practice");
      // 걷는 동안, 도착한 뒤, 번개가 치는 순간(16.0~16.4초), 전등이 깜빡이는 순간(8.0~8.3초)을 지나며 그린다
      for (let n = 0; n < 220; n++) {
        scene.update(0.08);
        if (n === 20) scene.go(state.caseStatus === "locked" ? "exam" : "case");
        if (n === 40) scene.tap(120, 250);
        scene.render(out);
        for (let i = 0; i < out.length; i += 4) {
          const black = out[i] === 0 && out[i + 1] === 0 && out[i + 2] === 0;
          const white = out[i] === INK_RGB[0] && out[i + 1] === INK_RGB[1] && out[i + 2] === INK_RGB[2];
          if (!black && !white) throw new Error(`두 색이 아닌 화소: ${out[i]},${out[i + 1]},${out[i + 2]} (장면 ${n})`);
        }
      }
    }
  });

  it("물건으로 걸어가면 1.1초 안에 도착해 알린다. 가는 중에 건너뛰면 곧바로 도착한다.", () => {
    const scene = new HallScene();
    const arrived: string[] = [];
    scene.onArrive = (id) => arrived.push(id);
    scene.go("exam");
    expect(scene.busy).toBe(true);
    expect(scene.heading).toBe("exam");
    for (let t = 0; t < 1.1 && scene.busy; t += 1 / 60) scene.update(1 / 60);
    expect(scene.busy).toBe(false);
    expect(scene.at).toBe("exam");
    expect(arrived).toEqual(["exam"]);
    scene.go("board");
    scene.update(0.05);
    scene.skip();
    expect(scene.at).toBe("board");
    expect(arrived).toEqual(["exam", "board"]);
    // 이미 그 앞이면 걷지 않고 곧바로 알린다
    scene.go("board");
    expect(arrived).toEqual(["exam", "board", "board"]);
  });

  it("바닥을 누르면 그리로 걷고 물건 앞을 떠났다고 알린다. 방 밖을 누르면 아무 일도 없다.", () => {
    const scene = new HallScene();
    let left = 0;
    scene.onLeave = () => left++;
    scene.go("board");
    scene.skip();
    expect(scene.at).toBe("board");
    const [px, py] = ISO.p(3.5, 4.5, 0);
    expect(scene.tap(px, py)).toEqual({ kind: "floor" });
    expect(left).toBe(1);
    expect(scene.at).toBeNull();
    expect(scene.heading).toBeNull();
    for (let t = 0; t < 1.2; t += 1 / 60) scene.update(1 / 60);
    expect(scene.busy).toBe(false);
    expect(scene.tap(4, 4)).toBeNull();
    expect(scene.tap(W / 2, H - 2)).toBeNull();
  });

  it("창 · 긴 의자 · 우산꽂이를 누르면 그 앞까지 걸어가 살펴본다(들어갈 곳은 아니다)", () => {
    const art = paintHall();
    for (const id of ["window", "bench", "stand"] as const) {
      const scene = new HallScene();
      const [x, y, w, h] = art.decor[id].hit;
      // 살펴볼 것의 영역은 들어갈 곳의 영역과 겹쳐도 된다(들어갈 곳이 먼저다). 겹치지 않는 자리를 찾아 누른다.
      let hit: ReturnType<HallScene["tap"]> = null;
      for (let py = y + 2; py < y + h && hit?.kind !== "decor"; py += 3) for (let px = x + 2; px < x + w && hit?.kind !== "decor"; px += 3) hit = scene.tap(px, py);
      expect(hit, id).toEqual({ kind: "decor", id });
      for (let t = 0; t < 1.2; t += 1 / 60) scene.update(1 / 60);
      expect(scene.busy).toBe(false);
      expect(scene.at).toBeNull();
    }
  });

  it("사건 접수함은 맡을 사건이 있을 때만 누를 수 있다", () => {
    const scene = new HallScene();
    const [x, y, w, h] = scene.hitRect("case");
    const cx = x + w / 2;
    const cy = y + h / 2;
    scene.state = { dailySolved: false, examRank: "D", examOpen: false, caseStatus: "locked" };
    expect(scene.tap(cx, cy)?.kind).not.toBe("spot");
    scene.state = { dailySolved: false, examRank: "C", examOpen: false, caseStatus: "new" };
    expect(scene.tap(cx, cy)).toEqual({ kind: "spot", id: "case" });
  });
});
