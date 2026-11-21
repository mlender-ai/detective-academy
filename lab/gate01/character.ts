// 탐정 캐릭터를 세 가지 방식으로 만들어 나란히 움직여 본다.
//  1. 직접 찍은 2D 스프라이트(문자 격자)  2. 코드 기반 관절 모형  3. 입체 모형을 구운 스프라이트(Ink Studio)
import "./shared/shell.css";
import { detectiveSprite, type Action } from "./shared/detective";
import { spriteCanvas, type Sprite } from "./shared/dot";
import { HAND_IDLE, HAND_WALK } from "./handsprite";
import inkUrl from "./assets/ink/detective-walk.png";
import inkMeta from "./assets/ink/detective-walk.json";

document.body.innerHTML = `
<style>
  main { max-width: 1180px; margin: 0 auto; padding: 16px 16px 40px; }
  h1 { font-size: 32px; font-weight: 400; margin: 0 0 4px; line-height: 40px; }
  h2 { font-size: 16px; font-weight: 400; margin: 28px 0 8px; padding: 0 6px; display: inline-block; color: #000; background: #f1f1ea; }
  p, li { margin: 0 0 6px; max-width: 72ch; }
  ul { margin: 0; padding-left: 20px; }
  canvas { display: block; image-rendering: pixelated; width: 100%; max-width: 1140px; border: 2px solid #f1f1ea; }
  .cap { font: 12px/1.5 "Galmuri11", monospace; margin-top: 6px; }
  a { color: inherit; }
</style>
<main>
  <p><a href="./index.html">← 실험 목록</a></p>
  <h1>탐정 캐릭터 · 세 가지 제작 방식</h1>
  <p>중절모와 긴 코트의 검은 실루엣. 같은 인물을 세 방식으로 만들어 같은 바탕(검정 · 점묘 · 흰색) 위에서 움직인다. 점 하나는 화면의 3px 로 키워 보였다(게임에서는 2px).</p>
  <h2>나란히 보기</h2>
  <canvas id="stage" width="380" height="232"></canvas>
  <p class="cap">왼쪽부터 ① 직접 찍은 16×28점(서기 2장면·걷기 4장면) · ② 관절 모형 32×48 칸 크기(키 44점) · ② 관절 모형 48×64 칸 크기(키 60점) · ③ 입체 모형을 구운 것(키 63점, 걷기 12장면). 윗줄은 서 있기, 가운데는 옆으로 걷기, 아랫줄은 멀어지며 걷기.</p>
  <h2>② 관절 모형 · 돌아서기와 동작</h2>
  <canvas id="moves" width="380" height="96"></canvas>
  <p class="cap">16방향으로 돌아서기 · 손 들어 짚기 · 턱에 손 대고 살피기 · 모자 인사 · 앉기. 어느 크기·각도로도 그 자리에서 찍는다(그림 파일이 없다).</p>
  <h2>③ 입체 모형 · 여덟 방향</h2>
  <canvas id="turn" width="380" height="80"></canvas>
  <p class="cap">Ink Studio 로 빚은 모형을 여덟 방향에서 구웠다. 빛은 인물의 앞·왼쪽·위에서 온다. 등을 보이면 테만 남는다.</p>
  <h2>판단</h2>
  <ul>
    <li><b>①</b> 손맛은 가장 좋지만 장면마다 사람이 찍어야 한다. 복도처럼 깊이에 따라 크기가 변하는 장면에는 크기별로 다시 찍어야 해서 맞지 않는다.</li>
    <li><b>②</b> 크기·각도·동작을 값으로 주면 되고 그림 파일이 없다. 실루엣이 가장 또렷하다. 복도 이동 데모는 이것을 쓴다.</li>
    <li><b>③</b> 부피감과 자동 음영이 장점이다. 다만 한 칸 크기로 구워야 하고(크기별로 다시 구움), 지금 모형은 코트가 둥글어 실루엣이 ②보다 무디다. 승급 휘장·금고처럼 돌려 보이는 물건에 더 어울린다.</li>
  </ul>
</main>`;

const ink = new Image();
ink.src = inkUrl;
await ink.decode();

function setup(id: string) {
  const c = document.getElementById(id) as HTMLCanvasElement;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  return { c, ctx };
}
const stage = setup("stage");
const moves = setup("moves");
const turn = setup("turn");

/** 바탕 세 가지: 검정 · 점묘 · 흰색 */
function backdrop(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  const third = Math.floor(w / 3);
  ctx.fillStyle = "#f1f1ea";
  for (let y = 0; y < h; y++) for (let x = third; x < third * 2; x++) if ((x + y) % 2 === 0) ctx.fillRect(x, y, 1, 1);
  ctx.fillRect(third * 2, 0, w - third * 2, h);
}
const put = (ctx: CanvasRenderingContext2D, s: Sprite, x: number, y: number) => ctx.drawImage(spriteCanvas(s), Math.round(x - s.ax), Math.round(y - s.ay));
const putInk = (ctx: CanvasRenderingContext2D, dir: number, frame: number, x: number, y: number) =>
  ctx.drawImage(ink, dir * inkMeta.tileW, frame * inkMeta.tileH, inkMeta.tileW, inkMeta.tileH, Math.round(x - inkMeta.tileW / 2), Math.round(y - inkMeta.feetY), inkMeta.tileW, inkMeta.tileH);

const P = Math.PI;
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let raf = 0;
function frame(now: number) {
  const t = reduce ? 0.3 : now / 1000;
  // 나란히 보기: 세 바탕 × (서기 / 옆 걷기 / 멀어지며 걷기)
  backdrop(stage.ctx, 380, 232);
  for (let band = 0; band < 3; band++) {
    const x0 = band * 127;
    const cols = [16, 44, 76, 108].map((x) => x0 + x);
    // 서 있기
    put(stage.ctx, HAND_IDLE[Math.floor(t / 0.9) % 2], cols[0], 72);
    put(stage.ctx, detectiveSprite(44, { action: "idle", t, facing: P / 2 }), cols[1], 72);
    put(stage.ctx, detectiveSprite(60, { action: "idle", t, facing: P / 2 }), cols[2], 72);
    putInk(stage.ctx, 2, 3, cols[3], 72);
    // 옆으로 걷기
    put(stage.ctx, HAND_WALK[Math.floor(t / 0.16) % 4], cols[0], 150);
    put(stage.ctx, detectiveSprite(44, { action: "walk", t: t * 1.5, facing: P / 2 }), cols[1], 150);
    put(stage.ctx, detectiveSprite(60, { action: "walk", t: t * 1.5, facing: P / 2 }), cols[2], 150);
    putInk(stage.ctx, 2, Math.floor(t * 1.5 * 12) % 12, cols[3], 150);
    // 멀어지며 걷기 (①은 옆모습만 있다)
    put(stage.ctx, detectiveSprite(44, { action: "walk", t: t * 1.5, facing: 0 }), cols[1], 226);
    put(stage.ctx, detectiveSprite(60, { action: "walk", t: t * 1.5, facing: 0 }), cols[2], 226);
    putInk(stage.ctx, 4, Math.floor(t * 1.5 * 12) % 12, cols[3], 226);
  }
  // 관절 모형: 돌아서기와 동작
  backdrop(moves.ctx, 380, 96);
  const actions: [Action, number][] = [["interact", P / 2], ["examine", P / 2], ["success", P], ["sit", P / 2]];
  put(moves.ctx, detectiveSprite(60, { action: "idle", t, facing: (Math.floor(t * 4) % 16) * (P / 8) }), 40, 86);
  actions.forEach(([action, facing], i) => put(moves.ctx, detectiveSprite(60, { action, t: (t * 0.7) % 1.4, facing }), 110 + i * 66, 86));
  // 입체 모형: 여덟 방향
  backdrop(turn.ctx, 380, 80);
  for (let d = 0; d < 8; d++) putInk(turn.ctx, d, Math.floor(t * 12) % 12, 26 + d * 46, 72);
  if (!reduce) raf = requestAnimationFrame(frame);
}
raf = requestAnimationFrame(frame);
document.addEventListener("visibilitychange", () => {
  cancelAnimationFrame(raf);
  if (!document.hidden) raf = requestAnimationFrame(frame);
});
