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
