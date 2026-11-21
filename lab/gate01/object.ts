// 입체로 빚은 물건을 두 색의 도트로 돌려 본다.
//  - 승급 휘장: Ink Studio 로 빚어 16방향으로 구운 뒤, 법선과 빛으로 흰 점·검은 점을 정했다.
//  - 금고: pixelart-gaussiansplat 뷰어에서 두 색 + 점묘로 돌려 찍은 장면들(있을 때만 보인다).
// 둘 다 실시간 3D 가 아니라 미리 구운 그림을 차례로 보여 준다(휴대폰에서 가볍다).
import "./shared/shell.css";
import medalUrl from "./assets/ink/medal-turn.png";
import medalMeta from "./assets/ink/medal-turn.json";

const sequence = (files: Record<string, string>) =>
  Object.entries(files)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, url]) => url);
const safeFrames = sequence(import.meta.glob("./assets/gsplat/safe-[0-9]*.png", { eager: true, query: "?url", import: "default" }) as Record<string, string>);
const emblemFrames = sequence(import.meta.glob("./assets/gsplat/emblem-[0-9]*.png", { eager: true, query: "?url", import: "default" }) as Record<string, string>);

document.body.innerHTML = `
<style>
  main { max-width: 760px; margin: 0 auto; padding: 16px 16px 40px; }
  h1 { font-size: 32px; font-weight: 400; margin: 0 0 4px; line-height: 40px; }
  h2 { font-size: 16px; font-weight: 400; margin: 28px 0 8px; padding: 0 6px; display: inline-block; color: #000; background: #f1f1ea; }
  p { margin: 0 0 6px; }
  .row { display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-end; }
  canvas, .safe { image-rendering: pixelated; border: 2px solid #f1f1ea; background: #000; }
  .cap { font: 12px/1.5 "Galmuri11", monospace; margin-top: 6px; max-width: 70ch; }
  a { color: inherit; }
</style>
<main>
  <p><a href="./index.html">← 실험 목록</a></p>
  <h1>입체를 도트로</h1>
  <p>코드로 빚은 입체를 검정과 흰색 두 가지 점으로 찍어, 돌아가는 물건을 만든다.</p>
  <h2>승급 휘장 · Ink Studio</h2>
  <div class="row">
    <canvas id="medal2" width="58" height="66" style="width:116px;height:132px"></canvas>
    <canvas id="medal4" width="58" height="66" style="width:232px;height:264px"></canvas>
    <canvas id="medalSheet" width="${medalMeta.tileW * 8}" height="${medalMeta.tileH * 2}" style="width:${medalMeta.tileW * 8}px"></canvas>
  </div>
  <p class="cap">16방향으로 구운 한 바퀴(오른쪽은 구운 장면 전체). 빛은 보는 쪽에 고정해서, 돌 때 밝은 면이 흰색 → 점묘 → 검정으로 넘어간다. 왼쪽이 게임 크기(점 하나 2px).</p>
  <h2>금고와 엠블럼 · pixelart-gaussiansplat</h2>
  <div class="row" id="safe"></div>
  <p class="cap" id="safeCap"></p>
</main>`;

const medal = new Image();
medal.src = medalUrl;
await medal.decode();
const ctx = (id: string) => {
  const c = (document.getElementById(id) as HTMLCanvasElement).getContext("2d")!;
  c.imageSmoothingEnabled = false;
  return c;
};
const m2 = ctx("medal2");
const m4 = ctx("medal4");
const sheet = ctx("medalSheet");
for (let i = 0; i < medalMeta.directions; i++)
  sheet.drawImage(medal, i * medalMeta.tileW, 0, medalMeta.tileW, medalMeta.tileH, (i % 8) * medalMeta.tileW, Math.floor(i / 8) * medalMeta.tileH, medalMeta.tileW, medalMeta.tileH);

const safeHost = document.getElementById("safe")!;
const safeCap = document.getElementById("safeCap")!;
/** 장면들을 차례로 보여 주는 그림 하나 */
async function player(frames: string[], scale: number) {
  if (!frames.length) return null;
  const img = new Image();
  img.className = "safe";
  img.src = frames[0];
  await img.decode();
  img.style.width = `${img.naturalWidth * scale}px`;
  safeHost.append(img);
  return { img, frames, last: -1 };
}
const players = (await Promise.all([player(safeFrames, 2), player(safeFrames, 4), player(emblemFrames, 2), player(emblemFrames, 4)])).filter((p) => p !== null);
safeCap.textContent = players.length
  ? `45도씩 여덟 방향으로 찍은 한 바퀴(금고 ${safeFrames.length}장면, 엠블럼 ${emblemFrames.length}장면). 각각 왼쪽이 게임 크기. 빛은 물건에 구워져 있어 함께 돈다. 굽는 과정과 측정값은 assets/gsplat/NOTES.md.`
  : "아직 구운 장면이 없다.";

const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let raf = 0;
function frame(now: number) {
  const i = reduce ? 1 : Math.floor(now / 110) % medalMeta.directions;
  for (const c of [m2, m4]) {
    c.fillStyle = "#000";
    c.fillRect(0, 0, 58, 66);
    c.drawImage(medal, i * medalMeta.tileW, 0, medalMeta.tileW, medalMeta.tileH, 0, 0, medalMeta.tileW, medalMeta.tileH);
  }
  for (const p of players) {
    const k = reduce ? 0 : Math.floor(now / 260) % p.frames.length;
    if (k !== p.last) {
      p.img.src = p.frames[k];
      p.last = k;
    }
  }
  if (!reduce) raf = requestAnimationFrame(frame);
}
raf = requestAnimationFrame(frame);
document.addEventListener("visibilitychange", () => {
  cancelAnimationFrame(raf);
  if (!document.hidden) raf = requestAnimationFrame(frame);
});
