// 복도 이동 — Canvas 2D 로 그린다 (게임 엔진 없음).
// 밝기 층을 작은 캔버스에 더해 그린 뒤 화소를 읽어 점묘로 바꾸고, 그 위에 먹 층을 얹는다. 모두 CPU 에서 한다.
import { ditherInto } from "./shared/dot";
import { H, W, type FrameOut } from "./shared/game";
import { mount } from "./shared/shell";

const shell = mount("Canvas 2D", "게임 엔진 없이 캔버스만 씀 · 점묘는 CPU");
const { game } = shell;

const out = document.createElement("canvas");
out.width = W;
out.height = H;
shell.host.prepend(out);
const octx = out.getContext("2d")!;
octx.imageSmoothingEnabled = false;
const image = octx.createImageData(W, H);

const toneCanvas = document.createElement("canvas");
toneCanvas.width = W;
toneCanvas.height = H;
const tctx = toneCanvas.getContext("2d", { willReadFrequently: true })!;

const OP = { over: "source-over", add: "lighter", mul: "multiply" } as const;

function draw(f: FrameOut) {
  tctx.globalCompositeOperation = "source-over";
  tctx.globalAlpha = 1;
  tctx.fillStyle = "#000";
  tctx.fillRect(0, 0, W, H);
  for (const op of f.tone) {
    if (op.alpha <= 0) continue;
    tctx.globalCompositeOperation = OP[op.op];
    tctx.globalAlpha = op.alpha;
    tctx.drawImage(game.art.tone[op.key], -f.camX, 0);
  }
  tctx.globalCompositeOperation = "source-over";
  tctx.globalAlpha = 0.7;
  tctx.fillStyle = "#000";
  for (const s of f.shadows) {
    tctx.beginPath();
    tctx.ellipse(s.x - f.camX, s.y, s.rx, s.ry, 0, 0, Math.PI * 2);
    tctx.fill();
  }
  tctx.globalAlpha = 1;
  ditherInto(tctx.getImageData(0, 0, W, H).data, image.data, W, H);
  octx.putImageData(image, 0, 0);
  for (const i of f.ink) octx.drawImage(i.canvas, i.x - f.camX, i.y);
  const fgShift = Math.round(f.camX * 1.5);
  for (const i of f.fg) octx.drawImage(i.canvas, i.x - fgShift, i.y);
}

let last = performance.now();
let raf = 0;
function loop(now: number) {
  const t0 = performance.now();
  game.update((now - last) / 1000);
  last = now;
  draw(game.frame());
  shell.tick(performance.now() - t0);
  raf = requestAnimationFrame(loop);
}
raf = requestAnimationFrame(loop);
// 화면을 떠나면 그리기를 멈춘다
document.addEventListener("visibilitychange", () => {
  cancelAnimationFrame(raf);
  if (!document.hidden) {
    last = performance.now();
    raf = requestAnimationFrame(loop);
  }
});
