// 쿼터뷰 홀의 그림만 크게 본다(검수용). ?k=3(배율) &solved=1 &exam=1 &case=new|open|cleared &at=board|practice|exam|archive|case &t=초(멈춘 장면) &mark=board
import { HallScene } from "../../src/iso/hallScene";
import type { HallSpot } from "../../src/iso/hallArt";
import { makeExamRoom } from "../../src/iso/examRoom";
import { makePracticeRoom } from "../../src/iso/practiceRoom";
import { makeVaultRoom } from "../../src/iso/vaultRoom";

const q = new URLSearchParams(location.search);
const k = Number(q.get("k") ?? 3);
// &room=vault 면 자료실을 본다(&open=1 금고 열림)
const room = q.get("room") ?? "hall";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let scene: any;
if (room === "exam") {
  scene = makeExamRoom();
  scene.state = { phase: q.get("phase") ?? "sealed" };
} else if (room === "practice") {
  scene = makePracticeRoom();
  scene.state = { locked: (q.get("locked") ?? "CBA").split(""), done: (q.get("done") ?? "").split(""), mark: q.get("mark") };
} else if (room === "vault") {
  scene = makeVaultRoom();
  scene.state = { open: q.get("open") === "1", mark: q.get("mark") };
} else {
  scene = new HallScene();
  scene.state = {
    dailySolved: q.get("solved") === "1",
    examOpen: q.get("exam") === "1",
    examRank: q.get("rank") ?? "D",
    caseStatus: (q.get("case") as "new" | "open" | "cleared" | null) ?? "locked",
    mark: (q.get("mark") as HallSpot | null) ?? null,
  };
}
const canvas = document.getElementById("c") as HTMLCanvasElement;
canvas.width = scene.w;
canvas.height = scene.h;
canvas.style.width = `${scene.w * k}px`;
canvas.style.height = `${scene.h * k}px`;
const ctx = canvas.getContext("2d")!;
const image = ctx.createImageData(scene.w, scene.h);
const info = document.getElementById("info")!;
const at = q.get("at");
if (at) scene.place(at);
const still = q.get("t");
const draw = () => {
  scene.render(image.data);
  ctx.putImageData(image, 0, 0);
};
canvas.addEventListener("pointerdown", (e) => {
  const r = canvas.getBoundingClientRect();
  const x = ((e.clientX - r.left) / r.width) * scene.w;
  const y = ((e.clientY - r.top) / r.height) * scene.h;
  if (scene.busy) scene.skip();
  const hit = scene.tap(x, y);
  if (hit?.kind === "spot") scene.go(hit.id);
  info.textContent = `${Math.round(x)}, ${Math.round(y)} → ${hit ? (hit.kind === "spot" ? hit.id : "바닥") : "-"}`;
});
scene.onArrive = (id: string) => (info.textContent = `도착: ${id}`);
if (still !== null) {
  scene.update(Number(still));
  draw();
  (window as unknown as { __ready: boolean }).__ready = true;
} else {
  let last = performance.now();
  const tick = (now: number) => {
    scene.update(Math.min(0.1, (now - last) / 1000));
    last = now;
    draw();
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
