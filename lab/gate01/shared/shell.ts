// 세 렌더러가 함께 쓰는 화면 틀: 장면 칸, 서술 한 줄, 명령 단추, 측정값.
// 렌더러는 mount() 가 돌려준 host 에 캔버스를 넣고, 매 장면마다 stats.tick() 을 부른다.
import "./shell.css";
import { CorridorGame, SPOTS, W, H } from "./game";

export interface Shell {
  game: CorridorGame;
  host: HTMLElement;
  /** 한 장면을 그리는 데 든 시간(ms)을 알려 준다. 화면의 측정값과 window.__stats 를 고친다. */
  tick(costMs: number): void;
}

export function mount(name: string, note: string): Shell {
  document.title = `복도 이동 · ${name}`;
  document.body.innerHTML = `
    <div class="phone">
      <div class="bar"><b>복도 이동 · ${name}</b><a href="./index.html">실험 목록</a></div>
      <div class="scene" data-testid="scene"><span class="scene__label"></span></div>
      <p class="narr" data-testid="narr"></p>
      <div class="cmds">${SPOTS.map((s) => `<button type="button" data-spot="${s.id}">${s.label}</button>`).join("")}</div>
      <p class="stats" data-testid="stats"></p>
    </div>`;
  const game = new CorridorGame();
  // 비교용 주소 값: ?freeze=초 (그 시각에서 멈춘다) · &spot=practice (그곳에 도착한 상태로 시작)
  const query = new URLSearchParams(window.location.search);
  const spot = query.get("spot");
  if (spot) {
    game.go(spot as (typeof SPOTS)[number]["id"]);
    game.skip();
    for (let i = 0; i < 30; i++) game.update(1 / 30);
  }
  if (query.has("freeze")) {
    game.time = Number(query.get("freeze"));
    game.frozen = true;
  }
  const host = document.querySelector<HTMLElement>(".scene")!;
  const narr = document.querySelector<HTMLElement>(".narr")!;
  const statsEl = document.querySelector<HTMLElement>(".stats")!;
  const buttons = [...document.querySelectorAll<HTMLButtonElement>(".cmds button")];

  // 장면을 직접 누른다: 화면 좌표 → 점 좌표
  host.addEventListener("pointerdown", (event) => {
    const box = host.getBoundingClientRect();
    const x = (event.clientX - box.left - box.width / 2 + 240) / 2;
    const y = (event.clientY - box.top) / 2;
    game.tap(x, y);
  });
  // 명령 단추로도 간다 (장면을 누르는 것과 같은 일을 한다)
  for (const b of buttons) b.addEventListener("click", () => game.go(b.dataset.spot as (typeof SPOTS)[number]["id"]));

  let last = "";
  let frames = 0;
  let cost = 0;
  let worst = 0;
  let since = performance.now();
  const stats = { name, fps: 0, costMs: 0, worstMs: 0, frames: 0 };
  (window as unknown as { __stats: typeof stats }).__stats = stats;
  (window as unknown as { __game: CorridorGame }).__game = game;

  return {
    game,
    host,
    tick(costMs: number) {
      frames++;
      cost += costMs;
      worst = Math.max(worst, costMs);
      stats.frames++;
      if (game.line !== last) {
        last = game.line;
        narr.textContent = last;
        for (const b of buttons) b.setAttribute("aria-current", String(game.at?.id === b.dataset.spot || game.target?.id === b.dataset.spot));
      }
      const now = performance.now();
      if (now - since >= 1000) {
        stats.fps = Math.round((frames * 1000) / (now - since));
        stats.costMs = Math.round((cost / frames) * 100) / 100;
        stats.worstMs = Math.round(worst * 100) / 100;
        statsEl.textContent = `${name}\n초당 ${stats.fps}장면 · 한 장면 ${stats.costMs}ms (최대 ${stats.worstMs}ms)\n${note}\n점 화면 ${W}×${H} → 2배`;
        frames = 0;
        cost = 0;
        worst = 0;
        since = now;
      }
    },
  };
}
