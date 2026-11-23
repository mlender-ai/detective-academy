// B안의 옆에서 본 복도를 통째로 본다(그림 검수용). 제품의 장면 코드를 그대로 쓴다.
import type { SpotId } from "../../src/scene/homeScene";
import { WH, WW } from "../../src/scene/sideArt";
import { SideScene } from "../../src/scene/sideScene";
import { Stage, runLoop } from "../../src/scene/stage";

const q = new URLSearchParams(location.search);
const canvas = document.getElementById("c") as HTMLCanvasElement;
const scene = new SideScene(WW);
scene.state = {
  dailySolved: q.get("solved") === "1",
  examRank: q.get("rank") ?? "D",
  examOpen: q.get("exam") === "1",
  mark: (q.get("mark") as SpotId | null) ?? null,
  // 사건 접수함(텔레비전): ?case=new · open · cleared 일 때만 놓인다
  caseStatus: (q.get("case") as "new" | "open" | "cleared" | null) ?? undefined,
  // 환경 애니메이션 실험: ?fx=ascii
  fx: q.get("fx") === "ascii",
};
const stage = new Stage(canvas, WW, WH);
canvas.style.width = `${WW * 3}px`;
canvas.style.height = `${WH * 3}px`;
scene.setView({ x0: 0, y0: 0, x1: WW, y1: WH });
const at = q.get("at") as SpotId | null;
if (at) {
  scene.go(at);
  scene.skip();
}
// ?bench=장면수 : 장면 하나를 계산하고 그리는 데 드는 시간을 잰다(환경 애니메이션을 켰을 때와 껐을 때를 견주는 데 쓴다)
if (q.has("bench")) {
  const frames = Number(q.get("bench")) || 300;
  for (let i = 0; i < 30; i++) {
    scene.update(1 / 60);
    stage.draw(scene.frame());
  }
  const times: number[] = [];
  for (let i = 0; i < frames; i++) {
    const a = performance.now();
    scene.update(1 / 60);
    stage.draw(scene.frame());
    times.push(performance.now() - a);
  }
  times.sort((x, y) => x - y);
  const mean = times.reduce((x, y) => x + y, 0) / frames;
  (window as unknown as { __bench: unknown }).__bench = { frames, mean, p50: times[frames >> 1], p99: times[Math.floor(frames * 0.99)], max: times[frames - 1] };
}
const freeze = q.get("freeze");
if (freeze !== null) {
  scene.update(Number(freeze));
  stage.draw(scene.frame());
} else {
  runLoop((dt) => {
    scene.update(dt);
    stage.draw(scene.frame());
  });
}
canvas.addEventListener("pointerdown", (e) => {
  const r = canvas.getBoundingClientRect();
  const id = scene.hit(((e.clientX - r.left) / r.width) * WW, ((e.clientY - r.top) / r.height) * WH);
  if (id) scene.go(id);
});
