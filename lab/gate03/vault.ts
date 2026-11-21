// 자료실 장면을 크게 본다(그림 검수용). 제품의 장면 코드를 그대로 쓴다.
import { Stage, runLoop } from "../../src/scene/stage";
import { VaultScene, type VaultSpot } from "../../src/scene/vaultScene";

const q = new URLSearchParams(location.search);
const canvas = document.getElementById("c") as HTMLCanvasElement;
const scene = new VaultScene();
scene.state = { open: false, mark: (q.get("mark") as VaultSpot | null) ?? null };
const stage = new Stage(canvas, scene.w, scene.h);
canvas.style.width = `${scene.w * 4}px`;
canvas.style.height = `${scene.h * 4}px`;
const at = q.get("at") as VaultSpot | null;
if (at) {
  scene.go(at);
  scene.skip();
}
if (q.get("open") === "1") scene.state = { ...scene.state, open: true };
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
  const id = scene.hit(((e.clientX - r.left) / r.width) * scene.w, ((e.clientY - r.top) / r.height) * scene.h);
  if (id) scene.go(id);
});
